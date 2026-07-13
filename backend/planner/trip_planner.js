const knowledgeService = require("../knowledge/knowledge_service");

// Travel Intelligence OS - Trip Planner Engine
class TripPlanner {
  plan(context) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      // 1. Parse Context Inputs
      const normalized = context.state?.normalizedEntities ?? context.normalizedEntities ?? {};
      const request = context.request || {};
      const userPrefs = context.user?.preferences || {};

      const destinationId = normalized.destination || "goa";
      const durationDays = Number(normalized.durationDays || 2);
      const travelersType = normalized.travelersType || userPrefs.travelersType || "solo";
      const travelStyle = normalized.travelStyle || userPrefs.travelStyle || "budget";
      const userInterests = normalized.interests || userPrefs.interests || [];
      const travelDates = normalized.travelDates || null;

      // Extract month to check seasonality
      const seasonKey = this.getSeasonKey(travelDates);

      // Load destination node
      const destNode = knowledgeService.getNode(destinationId);
      if (!destNode) {
        throw new Error(`Destination '${destinationId}' not found in Knowledge Graph`);
      }

      // 2. Load all nodes for destination
      const queryRes = knowledgeService.query({ destinationId });
      if (!queryRes.success) {
        throw new Error(`Failed to load knowledge for destination: ${queryRes.errors.join(", ")}`);
      }

      const allNodes = queryRes.data;
      const attractions = allNodes.filter(n => n.type === "attraction");
      const restaurants = allNodes.filter(n => n.type === "restaurant");
      const hotels = allNodes.filter(n => n.type === "hotel");
      const transportOptions = allNodes.filter(n => n.type === "transport");
      const rules = allNodes.filter(n => n.type === "rule");

      if (attractions.length === 0) {
        warnings.push("No attractions found in Knowledge Graph for this destination");
      }

      // 3. Filter invalid attractions (Hard Constraints)
      const validAttractions = [];
      const excludedAttractions = [];

      // Determine budget daily activity cap based on style
      const dailyCap = this.getBudgetCap(travelStyle);

      for (const node of attractions) {
        // Season check
        if (node.weatherProfile && node.weatherProfile[seasonKey] !== undefined) {
          if (node.weatherProfile[seasonKey] < 20) {
            excludedAttractions.push({ id: node.id, reason: `Unsuitable season (${seasonKey} score: ${node.weatherProfile[seasonKey]} < 20)` });
            continue;
          }
        }

        // Accessibility checks
        if (userPrefs.wheelchairAccessible && node.wheelchairAccessible === false) {
          excludedAttractions.push({ id: node.id, reason: "Not wheelchair accessible" });
          continue;
        }

        // Budget check
        const cost = this.getNodeCost(node, travelStyle);
        if (cost > dailyCap) {
          excludedAttractions.push({ id: node.id, reason: `Exceeds budget cap (Cost: ${cost} > Cap: ${dailyCap})` });
          continue;
        }

        validAttractions.push(node);
      }

      // 4. Score every remaining attraction using Planner Scoring Strategy
      const scoreBreakdown = {};
      const scoredAttractions = [];

      for (const node of validAttractions) {
        const scoreData = this.calculateAttractionScore({
          node,
          travelersType,
          travelStyle,
          userInterests,
          seasonKey,
          dailyCap
        });

        scoreBreakdown[node.id] = scoreData;
        scoredAttractions.push({
          node,
          score: scoreData.finalScore
        });
      }

      // Rank by score descending
      scoredAttractions.sort((a, b) => b.score - a.score);

      // 5. Geographically Cluster and Assign across Days
      const dailyPlans = [];
      let remaining = [...scoredAttractions];
      let totalTravelTime = 0;
      let totalSpend = 0;
      let totalConfidenceSum = 0;
      let totalVisitedCount = 0;

      // Find primary hotel to anchor routes (default to first hotel)
      const anchorHotel = hotels[0] || null;

      for (let dayIdx = 1; dayIdx <= durationDays; dayIdx++) {
        if (remaining.length === 0) break;

        const dayPlan = {
          day: dayIdx,
          slots: [],
          metrics: {
            travelTimeMinutes: 0,
            spend: 0,
            fatigue: 0
          }
        };

        // Select the seed attraction for this day (highest ranked remaining)
        const seedIndex = 0;
        const seedItem = remaining[seedIndex];
        remaining.splice(seedIndex, 1);

        // Find nearby candidates
        const dayCandidates = [seedItem];
        const maxCandidates = 3; // morning, afternoon, evening slots

        // Sort rest of remaining by distance to seed
        remaining.sort((a, b) => {
          const distA = this.getDistance(seedItem.node, a.node);
          const distB = this.getDistance(seedItem.node, b.node);
          return distA - distB;
        });

        // Balance the load across remaining days to avoid overloaded days
        const remainingDays = durationDays - dayIdx + 1;
        const targetCountForDay = Math.ceil((remaining.length + 1) / remainingDays);
        const needed = Math.max(0, targetCountForDay - 1);
        const added = remaining.splice(0, Math.min(needed, remaining.length));
        dayCandidates.push(...added);

        // Schedule slots
        let currentLoc = anchorHotel;

        // Morning Slot (09:00 - 12:00)
        let morningItem = dayCandidates.find(item => {
          const isMorningFriendly = item.node.plannerHints?.visitBefore === "Morning" || 
                                   item.node.plannerHints?.idealVisitOrder === 1 ||
                                   item.node.adventureScore > 60;
          return isMorningFriendly;
        }) || dayCandidates[0];

        if (morningItem) {
          // Remove from day candidates
          const idx = dayCandidates.indexOf(morningItem);
          if (idx > -1) dayCandidates.splice(idx, 1);

          const { time: transitTime, distance } = this.getTravelTimeAndDistance(currentLoc, morningItem.node);
          
          dayPlan.slots.push({
            time: "09:00 AM - 12:00 PM",
            type: "activity",
            nodeId: morningItem.node.id,
            name: morningItem.node.name,
            transitFromPreviousMinutes: transitTime,
            score: morningItem.score
          });

          dayPlan.metrics.travelTimeMinutes += transitTime;
          dayPlan.metrics.spend += this.getNodeCost(morningItem.node, travelStyle);
          dayPlan.metrics.fatigue += morningItem.node.fatigueLevel || 2;
          totalConfidenceSum += morningItem.node.confidence || 1.0;
          totalVisitedCount++;
          currentLoc = morningItem.node;
        }

        // Lunch Buffer (12:00 - 13:30)
        // Find closest restaurant to current location
        let closestRest = null;
        if (restaurants.length > 0) {
          let minDist = Infinity;
          for (const rest of restaurants) {
            const d = this.getDistance(currentLoc, rest);
            if (d < minDist) {
              minDist = d;
              closestRest = rest;
            }
          }
        }

        if (closestRest) {
          const { time: transitTime } = this.getTravelTimeAndDistance(currentLoc, closestRest);
          dayPlan.slots.push({
            time: "12:00 PM - 01:30 PM",
            type: "lunch",
            nodeId: closestRest.id,
            name: closestRest.name,
            transitFromPreviousMinutes: transitTime
          });
          dayPlan.metrics.travelTimeMinutes += transitTime;
          dayPlan.metrics.spend += closestRest.averageMealCost || 400;
          currentLoc = closestRest;
        } else {
          dayPlan.slots.push({
            time: "12:00 PM - 01:30 PM",
            type: "lunch",
            name: "Local Food Spot Break",
            transitFromPreviousMinutes: 5
          });
          dayPlan.metrics.travelTimeMinutes += 5;
          dayPlan.metrics.spend += 300;
        }

        // Afternoon Slot (13:30 - 17:00)
        let afternoonItem = dayCandidates[0]; // pick first remaining candidate
        if (afternoonItem) {
          dayCandidates.splice(0, 1);
          const { time: transitTime } = this.getTravelTimeAndDistance(currentLoc, afternoonItem.node);

          dayPlan.slots.push({
            time: "01:30 PM - 05:00 PM",
            type: "activity",
            nodeId: afternoonItem.node.id,
            name: afternoonItem.node.name,
            transitFromPreviousMinutes: transitTime,
            score: afternoonItem.score
          });

          dayPlan.metrics.travelTimeMinutes += transitTime;
          dayPlan.metrics.spend += this.getNodeCost(afternoonItem.node, travelStyle);
          dayPlan.metrics.fatigue += afternoonItem.node.fatigueLevel || 2;
          totalConfidenceSum += afternoonItem.node.confidence || 1.0;
          totalVisitedCount++;
          currentLoc = afternoonItem.node;
        }

        // Evening/Sunset Slot (17:00 - 19:00)
        let eveningItem = dayCandidates[0];
        if (eveningItem) {
          dayCandidates.splice(0, 1);
          const { time: transitTime } = this.getTravelTimeAndDistance(currentLoc, eveningItem.node);

          dayPlan.slots.push({
            time: "05:00 PM - 07:00 PM",
            type: "activity",
            nodeId: eveningItem.node.id,
            name: eveningItem.node.name,
            transitFromPreviousMinutes: transitTime,
            score: eveningItem.score
          });

          dayPlan.metrics.travelTimeMinutes += transitTime;
          dayPlan.metrics.spend += this.getNodeCost(eveningItem.node, travelStyle);
          dayPlan.metrics.fatigue += eveningItem.node.fatigueLevel || 2;
          totalConfidenceSum += eveningItem.node.confidence || 1.0;
          totalVisitedCount++;
          currentLoc = eveningItem.node;
        }

        // Return to Hotel or Dinner
        if (anchorHotel) {
          const { time: transitTime } = this.getTravelTimeAndDistance(currentLoc, anchorHotel);
          dayPlan.slots.push({
            time: "07:00 PM onwards",
            type: "stay",
            nodeId: anchorHotel.id,
            name: anchorHotel.name,
            transitFromPreviousMinutes: transitTime
          });
          dayPlan.metrics.travelTimeMinutes += transitTime;
          dayPlan.metrics.spend += anchorHotel.averagePrice || 3000;
        }

        totalTravelTime += dayPlan.metrics.travelTimeMinutes;
        totalSpend += dayPlan.metrics.spend;
        dailyPlans.push(dayPlan);

        // Put back any unused candidates into remaining pool
        if (dayCandidates.length > 0) {
          remaining.push(...dayCandidates);
        }
      }

      // Calculate final average confidence
      const avgConfidence = totalVisitedCount > 0 ? Number((totalConfidenceSum / totalVisitedCount).toFixed(2)) : 1.0;

      // 6. Assemble Draft Itinerary response
      const plannerMetrics = {
        totalTravelTimeMinutes: totalTravelTime,
        totalSpend,
        totalVisitedCount,
        avgConfidence
      };

      const data = {
        draftItinerary: {
          destination: destNode.name,
          durationDays,
          travelersType,
          travelStyle,
          dailyPlans
        },
        dailyPlans,
        excludedAttractions,
        scoreBreakdown,
        plannerMetrics
      };

      return {
        success: true,
        data,
        errors,
        warnings,
        confidence: avgConfidence,
        processingTime: Date.now() - startTime,
        metadata: {
          destinationId,
          seasonKey
        }
      };

    } catch (err) {
      errors.push(err.message);
      return {
        success: false,
        data: null,
        errors,
        warnings,
        confidence: 0.0,
        processingTime: Date.now() - startTime,
        metadata: {}
      };
    }
  }

  // Helper: map dates to season key
  getSeasonKey(travelDates) {
    if (!travelDates) return "winter";
    let dateStr = "";
    if (typeof travelDates === "string") {
      dateStr = travelDates;
    } else if (travelDates.startDate) {
      dateStr = travelDates.startDate;
    }

    if (!dateStr) return "winter";

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "winter";

    const month = date.getMonth(); // 0-11
    if (month === 11 || month === 0 || month === 1) return "winter"; // Dec, Jan, Feb
    if (month >= 5 && month <= 8) return "rain"; // Jun, Jul, Aug, Sep
    if (month >= 2 && month <= 4) return "summer"; // Mar, Apr, May
    return "sunny"; // Oct, Nov
  }

  // Helper: get budget cap
  getBudgetCap(travelStyle) {
    if (travelStyle === "budget") return 500;
    if (travelStyle === "mid") return 2000;
    return 100000; // Luxury
  }

  // Helper: node cost
  getNodeCost(node, travelStyle) {
    if (!node.estimatedSpend) return 0;
    return node.estimatedSpend[travelStyle] !== undefined ? node.estimatedSpend[travelStyle] : node.estimatedSpend.budget || 0;
  }

  // Helper: distance between nodes
  getDistance(nodeA, nodeB) {
    if (!nodeA || !nodeB) return 0;
    const coordA = nodeA.coordinates || (nodeA.location && { latitude: nodeA.location.latitude, longitude: nodeA.location.longitude });
    const coordB = nodeB.coordinates || (nodeB.location && { latitude: nodeB.location.latitude, longitude: nodeB.location.longitude });
    if (!coordA || !coordB) return 0;

    const lat1 = coordA.latitude;
    const lon1 = coordA.longitude;
    const lat2 = coordB.latitude;
    const lon2 = coordB.longitude;

    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 0;

    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Helper: travel time and distance
  getTravelTimeAndDistance(nodeA, nodeB) {
    if (!nodeA || !nodeB) return { time: 0, distance: 0 };

    if (nodeA.edges && Array.isArray(nodeA.edges)) {
      const edge = nodeA.edges.find(e => e.target === nodeB.id);
      if (edge) {
        // Estimate time from weight. E.g., weight 0.95 -> 10 mins
        const distance = (1 - edge.weight) * 50;
        const time = Math.round(distance * 2) || 10;
        return { time, distance };
      }
    }

    const distance = this.getDistance(nodeA, nodeB);
    const time = Math.round(distance * 2); // 30 km/h
    return { time, distance };
  }

  // Helper: calculate attraction score based on spec
  calculateAttractionScore({ node, travelersType, travelStyle, userInterests, seasonKey, dailyCap }) {
    // 1. Set Profile Weights
    let w_interest = 0.25;
    let w_planner = 0.20;
    let w_budget = 0.15;
    let w_weather = 0.15;
    let w_crowd = 0.10;
    let w_pop = 0.15;

    let plannerScoreKey = "solo";

    if (travelersType === "solo") {
      w_interest = 0.25;
      w_planner = 0.30;
      w_budget = 0.15;
      w_weather = 0.15;
      w_crowd = 0.10;
      w_pop = 0.05;
      plannerScoreKey = "solo";
    } else if (travelersType === "couple") {
      w_interest = 0.25;
      w_planner = 0.30;
      w_budget = 0.15;
      w_weather = 0.15;
      w_crowd = 0.10;
      w_pop = 0.05;
      plannerScoreKey = "solo"; // fallback
    } else if (travelersType === "family") {
      w_interest = 0.25;
      w_planner = 0.35;
      w_budget = 0.10;
      w_weather = 0.15;
      w_crowd = 0.10;
      w_pop = 0.05;
      plannerScoreKey = "family";
    }

    if (travelStyle === "luxury") {
      w_budget = 0.0;
      w_planner = 0.30;
      w_pop = 0.15;
      plannerScoreKey = "luxury";
    } else if (travelStyle === "budget") {
      w_budget = 0.40;
      w_planner = 0.15;
      w_pop = 0.10;
      plannerScoreKey = "budget";
    }

    // 2. Base Factors
    // Interest Match
    let S_interest = 100;
    if (userInterests.length > 0) {
      const nodeTags = (node.tags || []).map(t => t.toLowerCase());
      const matches = userInterests.filter(tag => nodeTags.includes(tag.toLowerCase()));
      S_interest = Math.round((matches.length / userInterests.length) * 100);
    }

    // Planner Score
    let S_planner = 80;
    if (node.plannerScore) {
      if (travelersType === "couple" && node.coupleFriendly !== undefined) {
        S_planner = node.coupleFriendly ? 100 : 50;
      } else {
        S_planner = node.plannerScore[plannerScoreKey] !== undefined ? node.plannerScore[plannerScoreKey] : 80;
      }
    }

    // Budget Match
    const cost = this.getNodeCost(node, travelStyle);
    let S_budget = 100;
    if (cost > 0 && dailyCap > 0) {
      if (cost > dailyCap) {
        S_budget = Math.max(0, Math.round(100 * (1 - (cost - dailyCap) / dailyCap)));
      } else {
        S_budget = 100;
      }
    }

    // Weather Suitability
    let S_weather = 80;
    if (node.weatherProfile && node.weatherProfile[seasonKey] !== undefined) {
      S_weather = node.weatherProfile[seasonKey];
    }

    // Crowd Comfort (Default to 50, comfort = 100 - crowd)
    let S_crowd = 50;
    if (node.crowdProfile) {
      S_crowd = 100 - (node.crowdProfile.Evening || 50);
    }

    // Popularity
    const S_pop = node.priorityScore !== undefined ? node.priorityScore : 50;

    // Calculate Base Sum
    const S_base = Math.round(
      w_interest * S_interest +
      w_planner * S_planner +
      w_budget * S_budget +
      w_weather * S_weather +
      w_crowd * S_crowd +
      w_pop * S_pop
    );

    // 3. Bonuses
    let B_gem = 0;
    if (node.priorityScore < 40 && S_planner >= 85) {
      B_gem = travelersType === "solo" ? 25 : 15;
    }

    // 4. Combine
    let finalScore = S_base + B_gem;
    finalScore = Math.max(0, Math.min(100, finalScore));

    return {
      finalScore,
      factors: {
        interestMatch: S_interest,
        plannerScore: S_planner,
        budgetMatch: S_budget,
        weatherSuitability: S_weather,
        crowdComfort: S_crowd,
        popularity: S_pop
      },
      weights: {
        w_interest,
        w_planner,
        w_budget,
        w_weather,
        w_crowd,
        w_pop
      },
      bonuses: {
        hiddenGem: B_gem
      }
    };
  }
}

module.exports = new TripPlanner();

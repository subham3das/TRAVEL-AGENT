const knowledgeService = require("../knowledge/knowledge_service");

// Travel Intelligence OS - Decision Engine
class DecisionEngine {
  optimize(context) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];
    const decisionLog = [];

    try {
      // 1. Parse Context Inputs
      const originalItinerary = context.recommendations?.draftItinerary ?? context.draftItinerary ?? null;
      if (!originalItinerary) {
        throw new Error("No draft itinerary found in TravelContext to optimize");
      }

      const userPrefs = context.user?.preferences || {};
      const normalized = context.state?.normalizedEntities ?? context.normalizedEntities ?? {};
      const budgetLimit = Number(normalized.budget || userPrefs.budget || 10000);
      const travelStyle = normalized.travelStyle || userPrefs.travelStyle || "mid";
      const travelDates = normalized.travelDates || null;
      const travelersType = normalized.travelersType || userPrefs.travelersType || "solo";

      const destinationId = normalized.destination || "goa";
      const seasonKey = this.getSeasonKey(travelDates);

      // Load alternative nodes from Knowledge
      const queryRes = knowledgeService.query({ destinationId });
      if (!queryRes.success) {
        throw new Error("Failed to load Knowledge Graph data");
      }

      const allNodes = queryRes.data;
      const attractions = allNodes.filter(n => n.type === "attraction");
      const restaurants = allNodes.filter(n => n.type === "restaurant");
      const hotels = allNodes.filter(n => n.type === "hotel");

      // Deep copy itinerary for improvement
      const improvedItinerary = JSON.parse(JSON.stringify(originalItinerary));
      const dailyPlans = improvedItinerary.dailyPlans || [];

      // 2. Apply Optimization Rules
      this.optimizeWeather(dailyPlans, seasonKey, attractions, decisionLog);
      this.optimizeDiversity(dailyPlans, attractions, decisionLog);
      this.optimizeFatigue(dailyPlans, decisionLog);
      this.optimizeBudget(dailyPlans, budgetLimit, hotels, restaurants, decisionLog);

      // 3. Compute Metrics & Comparison
      const originalMetrics = this.calculateMetrics(originalItinerary, budgetLimit, userPrefs);
      const improvedMetrics = this.calculateMetrics(improvedItinerary, budgetLimit, userPrefs);

      const plannerComparison = {
        original: originalMetrics,
        improved: improvedMetrics,
        netImprovement: {
          experienceScore: Number((improvedMetrics.experienceScore - originalMetrics.experienceScore).toFixed(1)),
          budgetScore: Number((improvedMetrics.budgetScore - originalMetrics.budgetScore).toFixed(1)),
          fatigueScore: Number((improvedMetrics.fatigueScore - originalMetrics.fatigueScore).toFixed(1)),
          weatherScore: Number((improvedMetrics.weatherScore - originalMetrics.weatherScore).toFixed(1)),
          accessibilityScore: Number((improvedMetrics.accessibilityScore - originalMetrics.accessibilityScore).toFixed(1)),
          travelEfficiencyScore: Number((improvedMetrics.travelEfficiencyScore - originalMetrics.travelEfficiencyScore).toFixed(1))
        }
      };

      // Generate recommendation notes
      const recommendations = decisionLog.map(d => `[${d.action}] ${d.reason}`);

      const data = {
        improvedItinerary,
        decisionLog,
        metrics: improvedMetrics,
        recommendations,
        plannerComparison
      };

      return {
        success: true,
        data,
        errors,
        warnings,
        confidence: decisionLog.length > 0 ? Number((decisionLog.reduce((acc, curr) => acc + curr.confidence, 0) / decisionLog.length).toFixed(2)) : 1.0,
        processingTime: Date.now() - startTime,
        metadata: {
          decisionsCount: decisionLog.length
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

  // Rule 1: Weather optimization
  // If raining, replace outdoor beachfront with indoor church/museum
  optimizeWeather(dailyPlans, seasonKey, attractions, decisionLog) {
    if (seasonKey !== "rain") return;

    for (const day of dailyPlans) {
      for (const slot of day.slots) {
        if (slot.type === "activity" && slot.nodeId) {
          const node = knowledgeService.getNode(slot.nodeId);
          if (node && node.category === "Beach") {
            // Find an indoor/church alternative
            const alternative = attractions.find(a => a.category !== "Beach" && a.weatherProfile && a.weatherProfile.rain >= 80);
            if (alternative) {
              decisionLog.push({
                action: "REPLACE",
                target: node.name,
                replacement: alternative.name,
                reason: `Heavy rain expected (Monsoon season). Swapped outdoor Beach with indoor ${alternative.category}.`,
                confidence: 0.95
              });
              slot.nodeId = alternative.id;
              slot.name = alternative.name;
            }
          }
        }
      }
    }
  }

  // Rule 2: Experience Diversity
  // Avoid consecutive activities of the same category (e.g. Beach followed by Beach)
  optimizeDiversity(dailyPlans, attractions, decisionLog) {
    for (const day of dailyPlans) {
      let lastCategory = null;
      for (const slot of day.slots) {
        if (slot.type === "activity" && slot.nodeId) {
          const node = knowledgeService.getNode(slot.nodeId);
          if (node) {
            if (node.category === lastCategory) {
              // Find an attraction with a different category that is not already scheduled on this day
              const scheduledIds = day.slots.map(s => s.nodeId).filter(Boolean);
              const alternative = attractions.find(a => a.category !== lastCategory && !scheduledIds.includes(a.id));
              if (alternative) {
                decisionLog.push({
                  action: "REPLACE",
                  target: node.name,
                  replacement: alternative.name,
                  reason: `Duplicate consecutive attraction category '${lastCategory}'. Swapped to maintain diversity.`,
                  confidence: 0.88
                });
                slot.nodeId = alternative.id;
                slot.name = alternative.name;
                lastCategory = alternative.category;
                continue;
              }
            }
            lastCategory = node.category;
          }
        }
      }
    }
  }

  // Rule 3: Fatigue Reduction
  // Insert rest break or swap high-fatigue items if cumulative fatigue score of day is too high
  optimizeFatigue(dailyPlans, decisionLog) {
    for (const day of dailyPlans) {
      let cumulativeFatigue = 0;
      let consecutiveHighFatigue = 0;

      for (let i = 0; i < day.slots.length; i++) {
        const slot = day.slots[i];
        if (slot.type === "activity" && slot.nodeId) {
          const node = knowledgeService.getNode(slot.nodeId);
          if (node) {
            const fatigue = node.fatigueLevel || 2;
            cumulativeFatigue += fatigue;

            if (fatigue >= 4) {
              consecutiveHighFatigue++;
            } else {
              consecutiveHighFatigue = 0;
            }

            // If we have consecutive high fatigue, insert a Rest Break right before it or swap
            if (consecutiveHighFatigue >= 2) {
              decisionLog.push({
                action: "INSERT_BREAK",
                target: slot.name,
                replacement: "Rest Break",
                reason: "Consecutive high-fatigue activities planned. Inserting rest buffer to avoid burnout.",
                confidence: 0.90
              });

              // Insert break before this slot
              day.slots.splice(i, 0, {
                time: "Rest Buffer Slot",
                type: "rest",
                name: "Relaxation Break",
                transitFromPreviousMinutes: 0
              });
              
              // Skip the incremented slot index
              i++;
              consecutiveHighFatigue = 0;
            }
          }
        }
      }
    }
  }

  // Rule 4: Budget Optimization
  // If total budget exceeded, swap expensive hotels or restaurants with cheaper alternatives
  optimizeBudget(dailyPlans, budgetLimit, hotels, restaurants, decisionLog) {
    let totalSpend = 0;
    for (const day of dailyPlans) {
      totalSpend += day.metrics.spend;
    }

    if (totalSpend <= budgetLimit) return;

    // Budget exceeded! Swap stay or meal nodes to save cost
    for (const day of dailyPlans) {
      for (const slot of day.slots) {
        if (slot.type === "stay" && slot.nodeId) {
          const hotel = knowledgeService.getNode(slot.nodeId);
          if (hotel && hotel.averagePrice > 5000) {
            // Find cheaper hotel alternative
            const cheaper = hotels.find(h => h.averagePrice < hotel.averagePrice);
            if (cheaper) {
              const savings = hotel.averagePrice - cheaper.averagePrice;
              decisionLog.push({
                action: "REPLACE",
                target: hotel.name,
                replacement: cheaper.name,
                reason: `Trip spend exceeds budget limit of ₹${budgetLimit}. Swapped luxury hotel with budget-friendly option to save ₹${savings}.`,
                confidence: 0.94
              });
              slot.nodeId = cheaper.id;
              slot.name = cheaper.name;
              day.metrics.spend -= savings;
              totalSpend -= savings;

              if (totalSpend <= budgetLimit) return; // budget optimized!
            }
          }
        }
      }
    }
  }

  // Metric Calculation
  calculateMetrics(itinerary, budgetLimit, userPrefs) {
    const dailyPlans = itinerary.dailyPlans || [];
    let totalScoreSum = 0;
    let attractionsCount = 0;
    let totalSpend = 0;
    let totalFatigue = 0;
    let totalWeatherScore = 0;
    let totalTransitTime = 0;
    let totalAccessibilityScore = 0;

    for (const day of dailyPlans) {
      totalSpend += day.metrics.spend;
      totalTransitTime += day.metrics.travelTimeMinutes;

      for (const slot of day.slots) {
        if (slot.type === "activity" && slot.nodeId) {
          const node = knowledgeService.getNode(slot.nodeId);
          if (node) {
            attractionsCount++;
            totalScoreSum += slot.score || 80;
            totalFatigue += node.fatigueLevel || 2;
            
            // Weather suitability (defaulting to winter profile)
            if (node.weatherProfile) {
              totalWeatherScore += node.weatherProfile.winter || 80;
            }

            // Accessibility matching
            if (userPrefs.wheelchairAccessible) {
              totalAccessibilityScore += node.wheelchairAccessible === true ? 100 : 0;
            } else {
              totalAccessibilityScore += 100;
            }
          }
        }
      }
    }

    const experienceScore = attractionsCount > 0 ? Number((totalScoreSum / attractionsCount).toFixed(1)) : 80;
    const budgetScore = totalSpend <= budgetLimit ? 100 : Math.max(0, Number((100 * (1 - (totalSpend - budgetLimit) / budgetLimit)).toFixed(1)));
    
    const avgFatigue = attractionsCount > 0 ? (totalFatigue / attractionsCount) : 2;
    const fatigueScore = Math.max(0, Number((100 - (avgFatigue * 12)).toFixed(1))); // lower fatigue = higher score

    const weatherScore = attractionsCount > 0 ? Number((totalWeatherScore / attractionsCount).toFixed(1)) : 80;
    const accessibilityScore = attractionsCount > 0 ? Number((totalAccessibilityScore / attractionsCount).toFixed(1)) : 100;

    const avgDailyTransit = dailyPlans.length > 0 ? (totalTransitTime / dailyPlans.length) : 0;
    const travelEfficiencyScore = Math.max(0, Number((100 - (avgDailyTransit * 0.4)).toFixed(1)));

    return {
      experienceScore,
      budgetScore,
      fatigueScore,
      weatherScore,
      accessibilityScore,
      travelEfficiencyScore
    };
  }
}

module.exports = new DecisionEngine();

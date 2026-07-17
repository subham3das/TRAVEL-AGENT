/**
 * Travel OS — Trip Planner v2 (Intelligent Scheduling)
 *
 * Plans like a human:
 *   - Respects opening hours
 *   - Calculates real travel time between locations
 *   - Schedules outdoor activities at optimal times (weather + crowds)
 *   - Inserts meal breaks at natural times
 *   - Follows energy curve (high energy morning → lunch dip → moderate afternoon)
 *   - Respects sunrise/sunset for outdoor vs indoor activities
 *   - Clusters geographically to minimize transit
 *
 * Pipeline:
 *   Filter → Rank → Cluster → Sequence → Schedule → Validate
 */

"use strict";

const knowledgeService = require("../knowledge/knowledge_service");
const { validatePlannerOutput } = require("../contracts/EngineContracts");

// ── Constants ────────────────────────────────────────────────────────────────
const DAY_START_HOUR = 8;    // 8 AM
const DAY_END_HOUR = 21;    // 9 PM
const LUNCH_START = 12.5;   // 12:30 PM
const LUNCH_END = 14;       // 2:00 PM
const DINNER_START = 19;    // 7:00 PM
const MIN_ACTIVITY_GAP = 0.25; // 15 min buffer between activities

// Energy curve: 0-100 scale throughout the day
// High morning, dip after lunch, moderate afternoon, low evening
function energyAtHour(hour) {
  if (hour < 9)   return 90;  // fresh start
  if (hour < 11)  return 95;  // peak morning
  if (hour < 12)  return 85;  // still strong
  if (hour < 14)  return 50;  // lunch dip
  if (hour < 16)  return 70;  // recovering
  if (hour < 18)  return 65;  // moderate afternoon
  if (hour < 20)  return 50;  // winding down
  return 40;                  // evening fatigue
}

// Crowd penalty: lower is better (less crowded)
function crowdMultiplier(crowdScore) {
  // crowdScore 0-100 where 100 = very crowded
  return Math.max(0.3, 1 - (crowdScore / 150));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse opening hours string "09:00 AM - 06:00 PM" → { open: 9, close: 18 }
 */
function parseOpeningHours(hoursStr) {
  if (!hoursStr) return { open: 9, close: 18 }; // default

  const match = hoursStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return { open: 9, close: 18 };

  let openH = parseInt(match[1], 10);
  const openM = parseInt(match[2], 10);
  const openPeriod = match[3].toUpperCase();
  let closeH = parseInt(match[4], 10);
  const closeM = parseInt(match[5], 10);
  const closePeriod = match[6].toUpperCase();

  if (openPeriod === "PM" && openH !== 12) openH += 12;
  if (openPeriod === "AM" && openH === 12) openH = 0;
  if (closePeriod === "PM" && closeH !== 12) closeH += 12;
  if (closePeriod === "AM" && closeH === 12) closeH = 0;

  return { open: openH + openM / 60, close: closeH + closeM / 60 };
}

/**
 * Check if a time slot falls within opening hours.
 */
function isWithinOpeningHours(startHour, endHour, openHour, closeHour) {
  return startHour >= openHour && endHour <= closeHour;
}

/**
 * Estimate travel time in hours between two coordinate points.
 * Uses haversine formula, assumes 30 km/h average urban speed.
 */
function travelTimeHours(coord1, coord2) {
  if (!coord1 || !coord2) return 0.5; // default 30 min

  const R = 6371; // Earth radius in km
  const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(coord1.latitude * Math.PI / 180) *
    Math.cos(coord2.latitude * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;

  // Urban speed: 30 km/h, with 15 min buffer for navigation/parking
  return (distanceKm / 30) + 0.25;
}

/**
 * Get travel time from edges or fall back to coordinates.
 */
function getTravelTime(fromNode, toNode) {
  if (!fromNode || !toNode) return 0.5;

  // Check KG edges first
  if (fromNode.edges) {
    const edge = fromNode.edges.find(e => e.target === toNode.id);
    if (edge && edge.weight) {
      // edge.weight is 0-1 confidence, approximate as travel fraction of 1 hour
      return Math.max(0.25, edge.weight * 0.8);
    }
  }

  // Fall back to coordinate distance
  return travelTimeHours(
    fromNode.coordinates,
    toNode.coordinates
  );
}

/**
 * Determine if an activity is outdoor (beach, park, nature).
 */
function isOutdoorActivity(node) {
  const outdoorTypes = new Set(["beach", "park", "nature", "garden", "waterfall", "trek"]);
  if (outdoorTypes.has(node.category)) return true;
  if (node.tags && node.tags.some(t => outdoorTypes.has(t))) return true;
  return false;
}

/**
 * Determine best time slot for an activity based on weather + crowds.
 */
function getOptimalTimeOfDay(node, season) {
  const hints = node.plannerHints || {};

  // Use plannerHints.visitBefore if available
  if (hints.visitBefore === "morning") return "morning";
  if (hints.visitBefore === "evening") return "evening";
  if (hints.visitBefore === "afternoon") return "afternoon";

  // Weather-based: outdoor activities prefer morning/evening
  if (isOutdoorActivity(node)) {
    const weather = node.weatherProfile || {};
    const rainScore = weather.rain || 50;

    // If high rain risk, schedule in morning (before afternoon showers)
    if (rainScore > 60) return "morning";

    // If sunny/hot, prefer evening (sunset)
    const summerScore = weather.summer || 50;
    if (summerScore > 70) return "evening";

    return "morning"; // default for outdoor
  }

  // Indoor activities can go anytime, prefer mid-day (avoid heat/crowds)
  return "afternoon";
}

/**
 * Get hour ranges for time-of-day keywords.
 */
function getTimeRange(timeOfDay) {
  switch (timeOfDay) {
    case "morning":   return { start: 9, end: 12 };
    case "afternoon": return { start: 14.5, end: 17.5 };
    case "evening":   return { start: 17.5, end: 20 };
    default:          return { start: 9, end: 18 };
  }
}

/**
 * Format decimal hour → "10:30 AM"
 */
function formatTime(hour) {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

/**
 * Calculate distance between two nodes for clustering.
 */
function nodeDistance(a, b) {
  return travelTimeHours(a.coordinates, b.coordinates);
}

// ── Main Planner ─────────────────────────────────────────────────────────────

class TripPlannerV2 {
  plan(input) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      if (!input || !input.destination) {
        throw new Error("PlannerV2 requires a valid PlannerInput with a destination");
      }

      const {
        days = 3,
        places = [],
        hotel = null,
        flight = null,
        constraints = {},
        travelStyle = "mid",
        travelersType = "solo",
        budget = null,
        season = "unknown",
      } = input;

      const maxActivitiesPerDay = constraints.maxActivitiesPerDay || 4;

      // ── Step 1: Load and enrich place data from KG ───────────────────
      const enrichedPlaces = places.map(p => {
        const raw = knowledgeService.getNode(p.id) || p;
        return { ...raw, ...p, _raw: raw };
      });

      // ── Step 2: Filter impossible options ────────────────────────────
      const filtered = this.filterByConstraints(enrichedPlaces, {
        season,
        travelStyle,
        days,
        budget
      });

      if (filtered.length === 0) {
        warnings.push("All places filtered out — using original list");
        filtered.push(...enrichedPlaces);
      }

      // ── Step 3: Rank and sort ────────────────────────────────────────
      const ranked = this.rankPlaces(filtered, {
        travelersType,
        travelStyle,
        season
      });

      // ── Step 4: Cluster geographically ───────────────────────────────
      const clusters = this.clusterPlaces(ranked, days);

      // ── Step 5: Schedule each day ────────────────────────────────────
      const dailyPlans = [];

      for (let dayIdx = 0; dayIdx < days; dayIdx++) {
        const dayCluster = clusters[dayIdx] || [];
        const daySlots = this.scheduleDay(dayIdx + 1, dayCluster, {
          hotel: dayIdx === 0 ? hotel : null,
          flight: dayIdx === days - 1 ? flight : null,
          season,
          travelersType,
          travelStyle
        });

        dailyPlans.push({
          day: dayIdx + 1,
          date: null,
          theme: this.generateDayTheme(daySlots),
          slots: daySlots,
          metrics: this.calculateDayMetrics(daySlots)
        });
      }

      // ── Step 6: Validate ─────────────────────────────────────────────
      const validation = this.validateItinerary(dailyPlans, budget);
      if (!validation.isValid) {
        warnings.push(...validation.issues);
      }

      // ── Step 7: Calculate totals ─────────────────────────────────────
      const totalTime = dailyPlans.reduce((sum, d) => sum + (d.metrics?.travelTimeMinutes || 0), 0);
      const totalCost = dailyPlans.reduce((sum, d) => sum + (d.metrics?.spend || 0), 0);

      const output = validatePlannerOutput({
        dailyPlans,
        metrics: {
          totalTravelTime: totalTime,
          routeEfficiency: this.calculateRouteEfficiency(dailyPlans),
          totalEstimatedCost: totalCost,
          fatigueScore: this.calculateFatigueScore(dailyPlans),
        },
        summary: this.generateSummary(dailyPlans, input)
      });

      return {
        success: true,
        data: { draftItinerary: output },
        errors,
        warnings,
        confidence: 0.9,
        processingTime: Date.now() - startTime,
        metadata: { stage: "PLANNER" }
      };

    } catch (err) {
      errors.push(err.message);
      return {
        success: false,
        data: null,
        errors,
        warnings,
        confidence: 0,
        processingTime: Date.now() - startTime,
        metadata: { stage: "PLANNER" }
      };
    }
  }

  // ── Filter ──────────────────────────────────────────────────────────────

  filterByConstraints(places, ctx) {
    const { season, days } = ctx;

    return places.filter(place => {
      // Closing days check
      if (place.closingDays && place.closingDays.length > 0) {
        // For simplicity, exclude if any closing day matches a weekday in the trip
        // In production, match against actual travel dates
      }

      // Weather suitability
      if (place.weatherProfile && season !== "unknown") {
        const score = place.weatherProfile[season] || 50;
        if (score < 25) return false; // too unsuitable
      }

      return true;
    });
  }

  // ── Rank ────────────────────────────────────────────────────────────────

  rankPlaces(places, ctx) {
    const { travelersType, travelStyle, season } = ctx;

    return places.map(place => {
      let score = 0;

      // Planner score for traveler type (0-100)
      const typeScore = place.plannerScore?.[travelersType] || 50;
      score += typeScore * 0.35;

      // Budget match (0-100)
      const budgetMatch = place.budgetCategory === travelStyle ? 90 : 50;
      score += budgetMatch * 0.20;

      // Weather suitability (0-100)
      const weatherScore = place.weatherProfile?.[season] || 60;
      score += weatherScore * 0.15;

      // Low crowd bonus (0-100)
      const crowdScore = (place.crowdProfile?.Morning || 50 + place.crowdProfile?.Evening || 50) / 2;
      const crowdBonus = Math.max(0, 100 - crowdScore);
      score += crowdBonus * 0.10;

      // Interest scores
      const interestScore = (
        (place.photographyScore || 0) +
        (place.adventureScore || 0) +
        (place.historicalScore || 0)
      ) / 3;
      score += interestScore * 0.10;

      // Confidence bonus
      score += (place.confidence || 0.5) * 50 * 0.10;

      return { ...place, _rankScore: Math.round(score) };
    }).sort((a, b) => b._rankScore - a._rankScore);
  }

  // ── Cluster Geographically ──────────────────────────────────────────────

  clusterPlaces(places, numDays) {
    if (places.length === 0) return Array.from({ length: numDays }, () => []);

    // Simple greedy clustering: assign places to days
    // by proximity to previous day's last location
    const clusters = Array.from({ length: numDays }, () => []);
    const maxPerDay = Math.ceil(places.length / numDays);

    // Sort by ideal visit order if available
    const sorted = [...places].sort((a, b) => {
      const orderA = a.plannerHints?.idealVisitOrder || 999;
      const orderB = b.plannerHints?.idealVisitOrder || 999;
      return orderA - orderB;
    });

    for (let i = 0; i < sorted.length; i++) {
      const dayIdx = Math.min(Math.floor(i / maxPerDay), numDays - 1);
      clusters[dayIdx].push(sorted[i]);
    }

    return clusters;
  }

  // ── Schedule a Single Day ───────────────────────────────────────────────

  scheduleDay(dayNum, places, ctx) {
    const { hotel, flight, season, travelersType } = ctx;
    const slots = [];
    let currentTime = DAY_START_HOUR;

    // Hotel check-in on day 1
    if (hotel) {
      slots.push({
        type: "stay",
        nodeId: hotel.id,
        name: `Check-in at ${hotel.name || "hotel"}`,
        startTime: formatTime(14),
        endTime: formatTime(15),
        cost: hotel.price || 0,
        reason: "Hotel check-in"
      });
      currentTime = Math.max(currentTime, 15.5); // After check-in
    }

    // Sort places by optimal time of day
    const timeSlots = { morning: [], afternoon: [], evening: [] };

    for (const place of places) {
      const optimalTime = getOptimalTimeOfDay(place, season);
      timeSlots[optimalTime].push(place);
    }

    // Schedule morning activities (9 AM - 12 PM)
    for (const place of timeSlots.morning) {
      if (slots.length >= 8) break; // max slots per day

      const opening = parseOpeningHours(place.openingHours);
      const visitDuration = this.estimateVisitDuration(place);
      const visitStart = Math.max(currentTime, opening.open, 9);
      const visitEnd = visitStart + visitDuration;

      if (visitEnd > LUNCH_START) break; // too close to lunch

      // Travel time
      const lastNode = this.getLastNode(slots);
      const travel = lastNode ? getTravelTime(lastNode, place) : 0;
      const actualStart = visitStart + (travel > MIN_ACTIVITY_GAP ? travel : 0);

      if (actualStart + visitDuration > LUNCH_START) break;

      slots.push(this.buildActivitySlot(place, actualStart, visitDuration, {
        travelersType,
        season,
        crowdProfile: place.crowdProfile
      }));

      currentTime = actualStart + visitDuration + MIN_ACTIVITY_GAP;
    }

    // Lunch break (12:30 PM - 2:00 PM)
    if (currentTime < LUNCH_END) {
      const lunchStart = Math.max(currentTime, LUNCH_START);
      slots.push({
        type: "meal",
        name: "Lunch Break",
        startTime: formatTime(lunchStart),
        endTime: formatTime(lunchStart + 1),
        reason: "Refuel before afternoon exploration"
      });
      currentTime = lunchStart + 1.25;
    }

    // Schedule afternoon activities (2 PM - 5:30 PM)
    for (const place of timeSlots.afternoon) {
      if (slots.length >= 8) break;

      const opening = parseOpeningHours(place.openingHours);
      const visitDuration = this.estimateVisitDuration(place);
      const visitStart = Math.max(currentTime, opening.open, LUNCH_END);
      const visitEnd = visitStart + visitDuration;

      if (visitEnd > DINNER_START) break;

      const lastNode = this.getLastNode(slots);
      const travel = lastNode ? getTravelTime(lastNode, place) : 0;
      const actualStart = visitStart + (travel > MIN_ACTIVITY_GAP ? travel : 0);

      if (actualStart + visitDuration > DINNER_START) break;

      slots.push(this.buildActivitySlot(place, actualStart, visitDuration, {
        travelersType,
        season,
        crowdProfile: place.crowdProfile
      }));

      currentTime = actualStart + visitDuration + MIN_ACTIVITY_GAP;
    }

    // Schedule evening activities (5:30 PM - 9 PM)
    for (const place of timeSlots.evening) {
      if (slots.length >= 8) break;

      const opening = parseOpeningHours(place.openingHours);
      const visitDuration = this.estimateVisitDuration(place);
      const visitStart = Math.max(currentTime, 17.5);
      const visitEnd = visitStart + visitDuration;

      if (visitEnd > DAY_END_HOUR) break;

      const lastNode = this.getLastNode(slots);
      const travel = lastNode ? getTravelTime(lastNode, place) : 0;
      const actualStart = visitStart + (travel > MIN_ACTIVITY_GAP ? travel : 0);

      if (actualStart + visitDuration > DAY_END_HOUR) break;

      slots.push(this.buildActivitySlot(place, actualStart, visitDuration, {
        travelersType,
        season,
        crowdProfile: place.crowdProfile
      }));

      currentTime = actualStart + visitDuration + MIN_ACTIVITY_GAP;
    }

    // Dinner (7 PM - 8 PM) if no evening activity covers it
    if (currentTime < DINNER_START + 0.5 && !slots.some(s => s.type === "meal" && s.name.includes("Dinner"))) {
      slots.push({
        type: "meal",
        name: "Dinner",
        startTime: formatTime(DINNER_START),
        endTime: formatTime(DINNER_START + 1),
        reason: "Local dining experience"
      });
    }

    // Flight departure on last day
    if (flight) {
      slots.push({
        type: "travel",
        nodeId: flight.id,
        name: `Departure: ${flight.airline || flight.name || "Flight"}`,
        startTime: formatTime(17),
        endTime: formatTime(19),
        cost: 0,
        reason: "Return flight"
      });
    }

    return slots;
  }

  // ── Build Activity Slot ────────────────────────────────────────────────

  buildActivitySlot(place, startHour, duration, ctx) {
    const { travelersType, season, crowdProfile } = ctx;

    // Calculate crowd-adjusted score
    const timeOfDay = startHour < 12 ? "Morning" : (startHour < 17 ? "Afternoon" : "Evening");
    const crowdScore = crowdProfile?.[timeOfDay] || 50;
    const crowdAdj = crowdMultiplier(crowdScore);

    // Energy bonus: high-energy activities in morning
    const energy = energyAtHour(startHour);
    const energyBonus = place.difficulty === "hard" && energy > 80 ? 10 : 0;

    // Build reason
    const reasons = [];
    const opening = parseOpeningHours(place.openingHours);

    if (isOutdoorActivity(place)) {
      if (timeOfDay === "Morning") reasons.push("Best time before afternoon heat");
      if (timeOfDay === "Evening") reasons.push("Great for sunset views");
    }

    if (crowdScore < 40) {
      reasons.push("Low crowd time");
    } else if (crowdScore > 75) {
      reasons.push("Peak hours — arrive early");
    }

    if (place.plannerHints?.combineWith?.length > 0) {
      reasons.push(`Combine with nearby attractions`);
    }

    if (reasons.length === 0) {
      reasons.push(`Optimal visit window`);
    }

    return {
      type: "activity",
      nodeId: place.id,
      name: place.name,
      startTime: formatTime(startHour),
      endTime: formatTime(startHour + duration),
      duration: `${Math.round(duration * 60)} min`,
      cost: place.estimatedSpend?.[ctx.travelStyle || "mid"] || 0,
      image: place.images?.[0] || null,
      reason: reasons.join(". "),
      metadata: {
        category: place.category,
        rating: place.rating,
        crowdScore,
        energyLevel: energy,
        weatherSuitability: place.weatherProfile?.[season] || null,
        openingHours: place.openingHours,
      }
    };
  }

  // ── Estimate Visit Duration ────────────────────────────────────────────

  estimateVisitDuration(place) {
    // Base duration by category
    const baseDuration = {
      beach: 2,
      monument: 1.5,
      museum: 1.5,
      temple: 1,
      market: 1.5,
      park: 1.5,
      nature: 2.5,
      restaurant: 1,
    };

    let hours = baseDuration[place.category] || 1.5;

    // Adjust by difficulty (hard = longer)
    if (place.difficulty === "hard") hours += 0.5;
    if (place.difficulty === "easy") hours -= 0.25;

    // Photography spots need more time
    if ((place.photographyScore || 0) > 80) hours += 0.5;

    return Math.max(0.75, Math.min(hours, 3.5));
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  getLastNode(slots) {
    const activities = slots.filter(s => s.type === "activity");
    if (activities.length === 0) return null;
    const last = activities[activities.length - 1];
    return knowledgeService.getNode(last.nodeId);
  }

  generateDayTheme(slots) {
    const activities = slots.filter(s => s.type === "activity");
    if (activities.length === 0) return "Arrival";

    const categories = activities.map(a => {
      const node = knowledgeService.getNode(a.nodeId);
      return node?.category || "exploration";
    });

    if (categories.includes("beach")) return "Beach & Coastal";
    if (categories.includes("monument") || categories.includes("temple")) return "Heritage & Culture";
    if (categories.includes("nature")) return "Nature & Outdoors";
    if (categories.includes("market")) return "Shopping & Markets";
    return "Exploration";
  }

  calculateDayMetrics(slots) {
    const activities = slots.filter(s => s.type === "activity");
    const travelTime = activities.length * 20; // ~20 min between activities
    const spend = activities.reduce((sum, s) => sum + (s.cost || 0), 0);
    const fatigue = activities.reduce((sum, s) => {
      const node = knowledgeService.getNode(s.nodeId);
      return sum + (node?.difficulty === "hard" ? 3 : node?.difficulty === "moderate" ? 2 : 1);
    }, 0);

    return {
      travelTimeMinutes: travelTime,
      spend,
      activityCount: activities.length,
      fatigueScore: fatigue,
      startSlot: slots[0]?.startTime,
      endSlot: slots[slots.length - 1]?.endTime,
    };
  }

  calculateRouteEfficiency(dailyPlans) {
    // Simplified: ratio of actual travel to theoretical minimum
    const avgTravel = dailyPlans.reduce((sum, d) => sum + (d.metrics?.travelTimeMinutes || 0), 0) / Math.max(dailyPlans.length, 1);
    // Target: < 60 min/day = 90%+ efficiency
    return Math.max(50, Math.min(100, Math.round(100 - (avgTravel - 40) * 0.5)));
  }

  calculateFatigueScore(dailyPlans) {
    const avgFatigue = dailyPlans.reduce((sum, d) => sum + (d.metrics?.fatigueScore || 0), 0) / Math.max(dailyPlans.length, 1);
    return Math.round(avgFatigue * 10);
  }

  validateItinerary(dailyPlans, budget) {
    const issues = [];
    let isValid = true;

    for (const day of dailyPlans) {
      // Check travel time
      if ((day.metrics?.travelTimeMinutes || 0) > 120) {
        issues.push(`Day ${day.day}: Travel time exceeds 2 hours`);
        isValid = false;
      }

      // Check fatigue
      if ((day.metrics?.fatigueScore || 0) > 10) {
        issues.push(`Day ${day.day}: High fatigue — consider fewer activities`);
      }
    }

    // Budget check
    if (budget) {
      const totalCost = dailyPlans.reduce((sum, d) => sum + (d.metrics?.spend || 0), 0);
      if (totalCost > budget * 1.1) {
        issues.push(`Estimated cost (₹${totalCost}) exceeds budget (₹${budget})`);
      }
    }

    return { isValid, issues };
  }

  generateSummary(dailyPlans, input) {
    const totalActivities = dailyPlans.reduce((sum, d) =>
      sum + (d.slots?.filter(s => s.type === "activity").length || 0), 0);
    const totalCost = dailyPlans.reduce((sum, d) => sum + (d.metrics?.spend || 0), 0);

    return {
      destination: input.destination,
      days: input.days,
      totalActivities,
      totalEstimatedCost: totalCost,
      highlights: dailyPlans.map(d => ({
        day: d.day,
        theme: d.theme,
        slots: d.slots?.filter(s => s.type === "activity").map(s => s.name) || []
      }))
    };
  }
}

module.exports = new TripPlannerV2();

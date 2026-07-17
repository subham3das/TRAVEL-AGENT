const knowledgeService = require("../knowledge/knowledge_service");

// Abstract Distance Provider to allow future extensions (Google Maps, Mapbox, OSM)
class DistanceProvider {
  calculateDistance(coord1, coord2) {
    if (!coord1 || !coord2) return 0;
    const lat1 = coord1.latitude;
    const lon1 = coord1.longitude;
    const lat2 = coord2.latitude;
    const lon2 = coord2.longitude;

    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 0;

    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
  }

  getDistanceAndDuration(nodeA, nodeB, mode) {
    const coordA = nodeA.coordinates || (nodeA.location && { latitude: nodeA.location.latitude, longitude: nodeA.location.longitude });
    const coordB = nodeB.coordinates || (nodeB.location && { latitude: nodeB.location.latitude, longitude: nodeB.location.longitude });
    
    if (!coordA || !coordB) {
      return { distance: 0, durationMinutes: 0 };
    }

    const dist = this.calculateDistance(coordA, coordB);

    // Speed assumptions based on transport mode
    let speedKmh = 30; // default driving
    if (mode === "walking") speedKmh = 5;
    else if (mode === "transit") speedKmh = 20;

    const durationMinutes = Math.round((dist / speedKmh) * 60);
    return {
      distance: dist,
      durationMinutes
    };
  }
}

// Route Optimizer Engine
class RouteOptimizer {
  constructor() {
    this.distanceProvider = new DistanceProvider();
  }

  optimize(context) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];
    const feasibilityLog = [];

    try {
      const inputItinerary = context.recommendations?.improvedItinerary ?? context.improvedItinerary ?? context.draftItinerary ?? null;
      if (!inputItinerary) {
        warnings.push("No itinerary found — skipping route optimization");
        return {
          success: true,
          data: { optimizedItinerary: null },
          errors,
          warnings,
          confidence: 1.0,
          processingTime: Date.now() - startTime,
          metadata: { skipped: true, reason: "no_input_itinerary" }
        };
      }

      const userPrefs = context.user?.preferences || {};
      const normalized = context.state?.normalizedEntities ?? context.normalizedEntities ?? {};
      const budgetLimit = Number(normalized.budget || userPrefs.budget || 10000);
      const travelStyle = normalized.travelStyle || userPrefs.travelStyle || "mid";
      const travelersType = normalized.travelersType || userPrefs.travelersType || "solo";

      // Deep copy input
      const optimizedItinerary = JSON.parse(JSON.stringify(inputItinerary));
      const dailyPlans = optimizedItinerary.dailyPlans || [];

      let totalDistance = 0;
      let totalTime = 0;
      let totalWalking = 0;
      let totalCost = 0;
      let dailyFeasibility = true;

      // Process each day
      for (const day of dailyPlans) {
        // 1. Separate activities, hotel stays, and food nodes
        const slots = day.slots || [];
        const activitySlots = slots.filter(s => s.type === "activity" && s.nodeId);
        const staySlot = slots.find(s => s.type === "stay");
        
        if (activitySlots.length <= 1) {
          // No reordering needed. Recompute travel distances and insert travel slots
          this.rebuildDayItinerary(day, slots, staySlot, travelStyle, travelersType, budgetLimit, warnings, feasibilityLog);
          continue;
        }

        // 2. Resolve nodes in memory
        const nodes = activitySlots.map(s => {
          const node = knowledgeService.getNode(s.nodeId);
          return { slot: s, node };
        }).filter(item => item.node);

        const hotelNode = staySlot ? knowledgeService.getNode(staySlot.nodeId) : null;
        const startPoint = hotelNode || nodes[0].node;

        // 3. Find optimal permutation (TSP Solver)
        const bestPermutation = this.findOptimalRoute(nodes, startPoint);

        // 4. Reconstruct slots using the optimal ordering
        const orderedActivitySlots = bestPermutation.map(item => item.slot);
        const nonActivitySlots = slots.filter(s => s.type !== "activity");
        
        // Rebuild day slots
        const newSlots = [];
        let activityIdx = 0;

        for (const slot of slots) {
          if (slot.type === "activity") {
            newSlots.push(orderedActivitySlots[activityIdx++]);
          } else {
            newSlots.push(slot);
          }
        }

        day.slots = newSlots;

        // 5. Recompute travel durations & insert travel buffers
        this.rebuildDayItinerary(day, day.slots, staySlot, travelStyle, travelersType, budgetLimit, warnings, feasibilityLog);
      }

      // Aggregate global metrics
      for (const day of dailyPlans) {
        totalDistance += day.metrics.distanceKm || 0;
        totalTime += day.metrics.travelTimeMinutes || 0;
        totalWalking += day.metrics.walkingDistanceKm || 0;
        totalCost += day.metrics.transportCost || 0;
        if (day.metrics.feasible === false) {
          dailyFeasibility = false;
        }
      }

      // Round aggregated values
      totalDistance = Number(totalDistance.toFixed(2));
      totalWalking = Number(totalWalking.toFixed(2));

      const metrics = {
        totalDistanceKm: totalDistance,
        totalTravelTimeMinutes: totalTime,
        walkingDistanceKm: totalWalking,
        transportCost: totalCost,
        routeEfficiency: totalDistance > 0 ? Number((100 * (1 - (totalTime / 180))).toFixed(1)) : 100, // proxy formula
        dailyFeasibility
      };

      const originalMetrics = inputItinerary.plannerMetrics || {};
      const plannerComparison = {
        original: {
          travelTime: originalMetrics.totalTravelTimeMinutes || 120,
          spend: originalMetrics.totalSpend || 5000
        },
        optimized: {
          travelTime: totalTime,
          spend: (originalMetrics.totalSpend || 5000) + totalCost
        }
      };

      const data = {
        optimizedItinerary,
        metrics,
        feasibilityLog,
        plannerComparison
      };

      return {
        success: true,
        data,
        errors,
        warnings,
        confidence: 0.95,
        processingTime: Date.now() - startTime,
        metadata: {
          totalDays: dailyPlans.length
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

  // Permutation generator for Traveling Salesman Problem (Exact Search for small N)
  findOptimalRoute(nodes, startPoint) {
    const permutations = this.getPermutations(nodes);
    let bestRoute = null;
    let minDistance = Infinity;

    for (const perm of permutations) {
      let distance = 0;
      let prev = startPoint;

      for (const item of perm) {
        distance += this.distanceProvider.calculateDistance(prev.coordinates || prev.location, item.node.coordinates || item.node.location);
        prev = item.node;
      }

      // Add return to hotel/start point
      distance += this.distanceProvider.calculateDistance(prev.coordinates || prev.location, startPoint.coordinates || startPoint.location);

      if (distance < minDistance) {
        minDistance = distance;
        bestRoute = perm;
      }
    }

    return bestRoute || nodes;
  }

  getPermutations(array) {
    if (array.length === 0) return [[]];
    const first = array[0];
    const rest = array.slice(1);
    const subPerms = this.getPermutations(rest);
    const result = [];

    for (const sub of subPerms) {
      for (let i = 0; i <= sub.length; i++) {
        const copy = [...sub];
        copy.splice(i, 0, first);
        result.push(copy);
      }
    }
    return result;
  }

  // Re-evaluates travel timings and inserts explicit travel segments in daily plans
  rebuildDayItinerary(day, slots, staySlot, travelStyle, travelersType, budgetLimit, warnings, feasibilityLog) {
    const hotelNode = staySlot ? knowledgeService.getNode(staySlot.nodeId) : null;
    let currentLoc = hotelNode;
    
    let totalDist = 0;
    let totalTime = 0;
    let walkingDist = 0;
    let transportCost = 0;
    let feasible = true;

    const rebuiltSlots = [];

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];

      if (slot.type === "activity" || slot.type === "lunch" || slot.type === "stay") {
        const node = slot.nodeId ? knowledgeService.getNode(slot.nodeId) : null;

        if (node && currentLoc) {
          // 1. Select Transport Mode
          const distance = this.distanceProvider.calculateDistance(
            currentLoc.coordinates || currentLoc.location,
            node.coordinates || node.location
          );

          const mode = this.selectTransportMode(distance, travelStyle, travelersType);

          // 2. Fetch travel stats
          const travelStats = this.distanceProvider.getDistanceAndDuration(currentLoc, node, mode);
          const cost = this.calculateTransportCost(travelStats.distance, mode);

          // 3. Add explicit travel segment
          if (travelStats.distance > 0) {
            rebuiltSlots.push({
              time: "Transit Slot",
              type: "travel",
              name: `Travel via ${mode}`,
              transportMode: mode,
              distanceKm: travelStats.distance,
              durationMinutes: travelStats.durationMinutes,
              cost
            });

            totalDist += travelStats.distance;
            totalTime += travelStats.durationMinutes;
            transportCost += cost;

            if (mode === "walking") {
              walkingDist += travelStats.distance;
            }
          }
        }

        rebuiltSlots.push(slot);
        if (node) {
          currentLoc = node;
        }
      } else if (slot.type !== "travel") {
        rebuiltSlots.push(slot);
      }
    }

    // Check impossible schedule (e.g. daily travel time > 180 minutes)
    if (totalTime > 180) {
      feasible = false;
      feasibilityLog.push({
        day: day.day,
        reason: `Transit overload: daily travel time is ${totalTime} minutes (exceeds limit of 180 minutes)`
      });
      warnings.push(`Day ${day.day} itinerary transit exceeds feasibility thresholds`);
    }

    day.slots = rebuiltSlots;
    day.metrics = {
      distanceKm: Number(totalDist.toFixed(2)),
      travelTimeMinutes: totalTime,
      walkingDistanceKm: Number(walkingDist.toFixed(2)),
      transportCost,
      feasible
    };
  }

  selectTransportMode(distance, travelStyle, travelersType) {
    if (distance < 1.0) return "walking"; // Walking distance
    
    if (travelStyle === "budget" && travelersType === "solo") {
      return "transit"; // Bus/Metro
    }

    if (travelStyle === "luxury" || travelersType === "family") {
      return "driving"; // Cabs/Private transport
    }

    return "driving"; // default
  }

  calculateTransportCost(distance, mode) {
    if (mode === "walking") return 0;
    if (mode === "transit") return Math.round(distance * 10); // ₹10 per km
    return Math.round(distance * 25); // ₹25 per km (cab)
  }
}

module.exports = new RouteOptimizer();

const assert = require("assert").strict;
const knowledgeService = require("../knowledge/knowledge_service");
const routeOptimizer = require("../optimizer/route_optimizer");

// Load Knowledge Graph cache
console.log("Loading Knowledge Service cache...");
const loadRes = knowledgeService.loadKnowledge();
assert.ok(loadRes.success, "Failed to load Knowledge Graph");
console.log(`Loaded ${loadRes.loadedCount} nodes successfully.\n`);

function createMockImprovedItinerary(slots = [], spend = 5000) {
  return {
    destination: "Goa",
    durationDays: 1,
    travelersType: "solo",
    travelStyle: "mid",
    dailyPlans: [
      {
        day: 1,
        slots: slots,
        metrics: {
          travelTimeMinutes: 45,
          spend: spend,
          fatigue: 4
        }
      }
    ],
    plannerMetrics: {
      totalTravelTimeMinutes: 45,
      totalSpend: spend
    }
  };
}

async function testSoloTripLowBudget() {
  console.log("Running Test: Solo Trip / Low Budget (Should select transit)...");
  const draft = createMockImprovedItinerary([
    {
      time: "07:00 PM onwards",
      type: "stay",
      nodeId: "goa_hotel_taj", // South Goa, distance is > 30 km
      name: "Taj Exotica Resort & Spa"
    },
    {
      time: "09:00 AM - 12:00 PM",
      type: "activity",
      nodeId: "goa_attraction_baga_beach", 
      name: "Baga Beach"
    }
  ], 2000);

  const context = {
    improvedItinerary: draft,
    normalizedEntities: {
      budget: 1000,
      travelStyle: "budget",
      travelersType: "solo"
    }
  };

  const response = routeOptimizer.optimize(context);
  assert.ok(response.success);
  
  const travelSlot = response.data.optimizedItinerary.dailyPlans[0].slots.find(s => s.type === "travel");
  assert.ok(travelSlot);
  assert.strictEqual(travelSlot.transportMode, "transit", "Solo budget traveler should use transit");
  assert.strictEqual(travelSlot.cost, Math.round(travelSlot.distanceKm * 10), "Transit cost should be ₹10 per km");
  console.log("  => Solo Trip / Low Budget passed!");
}

async function testFamilyTrip() {
  console.log("Running Test: Family Trip (Should select driving)...");
  const draft = createMockImprovedItinerary([
    {
      time: "07:00 PM onwards",
      type: "stay",
      nodeId: "goa_hotel_taj", // South Goa, distance is > 30 km
      name: "Taj Exotica Resort & Spa"
    },
    {
      time: "09:00 AM - 12:00 PM",
      type: "activity",
      nodeId: "goa_attraction_baga_beach",
      name: "Baga Beach"
    }
  ], 2000);

  const context = {
    improvedItinerary: draft,
    normalizedEntities: {
      travelersType: "family",
      travelStyle: "mid"
    }
  };

  const response = routeOptimizer.optimize(context);
  assert.ok(response.success);
  
  const travelSlot = response.data.optimizedItinerary.dailyPlans[0].slots.find(s => s.type === "travel");
  assert.ok(travelSlot);
  assert.strictEqual(travelSlot.transportMode, "driving", "Family traveler should use driving");
  console.log("  => Family Trip passed!");
}

async function testWalkingOnlyItinerary() {
  console.log("Running Test: Walking-only Itinerary (< 1km)...");
  // Mock two nodes extremely close. Baga Beach and Baga Road hotel Goa Beach Inn are very close.
  const draft = createMockImprovedItinerary([
    {
      time: "07:00 PM onwards",
      type: "stay",
      nodeId: "goa_hotel_budget", // lat 15.5566, lon 73.7533
      name: "Goa Beach Inn"
    },
    {
      time: "09:00 AM - 12:00 PM",
      type: "activity",
      nodeId: "goa_attraction_baga_beach", // lat 15.5553, lon 73.7517 (~0.23 km)
      name: "Baga Beach"
    }
  ], 2000);

  const context = {
    improvedItinerary: draft,
    normalizedEntities: {
      travelersType: "solo",
      travelStyle: "mid"
    }
  };

  const response = routeOptimizer.optimize(context);
  assert.ok(response.success);
  
  const travelSlot = response.data.optimizedItinerary.dailyPlans[0].slots.find(s => s.type === "travel");
  assert.ok(travelSlot);
  assert.strictEqual(travelSlot.transportMode, "walking", "Short distances should use walking");
  console.log("  => Walking-only Itinerary passed!");
}

async function testImpossibleSchedule() {
  console.log("Running Test: Impossible Schedule (Transit overload)...");
  const draft = createMockImprovedItinerary([
    {
      time: "07:00 PM onwards",
      type: "stay",
      nodeId: "goa_hotel_taj", // South Goa
      name: "Taj"
    },
    {
      time: "09:00 AM",
      type: "activity",
      nodeId: "goa_attraction_baga_beach", // North Goa
      name: "Baga"
    },
    {
      time: "12:00 PM",
      type: "activity",
      nodeId: "goa_attraction_anjuna_beach", // North Goa
      name: "Anjuna"
    },
    {
      time: "03:00 PM",
      type: "activity",
      nodeId: "goa_attraction_bom_jesus", // Central Goa
      name: "Bom Jesus"
    },
    {
      time: "07:00 PM onwards",
      type: "stay",
      nodeId: "goa_hotel_taj", // Return to stay
      name: "Taj"
    }
  ], 2000);

  const context = {
    improvedItinerary: draft,
    normalizedEntities: {
      travelStyle: "budget",
      travelersType: "solo"
    }
  };

  const response = routeOptimizer.optimize(context);
  assert.ok(response.success);
  assert.strictEqual(response.data.metrics.dailyFeasibility, false, "Should flag feasibility as false due to transit overload");
  assert.ok(response.data.feasibilityLog.length > 0);
  console.log("  => Impossible Schedule passed!");
}

async function testLuxuryTrip() {
  console.log("Running Test: Luxury Trip...");
  const draft = createMockImprovedItinerary([
    {
      time: "07:00 PM onwards",
      type: "stay",
      nodeId: "goa_hotel_taj",
      name: "Taj"
    },
    {
      time: "09:00 AM - 12:00 PM",
      type: "activity",
      nodeId: "goa_attraction_baga_beach",
      name: "Baga Beach"
    }
  ], 2000);

  const context = {
    improvedItinerary: draft,
    normalizedEntities: {
      travelStyle: "luxury",
      travelersType: "solo"
    }
  };

  const response = routeOptimizer.optimize(context);
  assert.ok(response.success);
  
  const travelSlot = response.data.optimizedItinerary.dailyPlans[0].slots.find(s => s.type === "travel");
  assert.ok(travelSlot);
  assert.strictEqual(travelSlot.transportMode, "driving", "Luxury traveler should use driving");
  assert.strictEqual(travelSlot.cost, Math.round(travelSlot.distanceKm * 25), "Driving cost should be ₹25 per km");
  console.log("  => Luxury Trip passed!");
}

async function runAll() {
  console.log("=== STARTING ROUTE OPTIMIZER TESTS ===");
  await testSoloTripLowBudget();
  await testFamilyTrip();
  await testWalkingOnlyItinerary();
  await testImpossibleSchedule();
  await testLuxuryTrip();
  console.log("\n=== ALL ROUTE OPTIMIZER TESTS PASSED ===");
}

runAll().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

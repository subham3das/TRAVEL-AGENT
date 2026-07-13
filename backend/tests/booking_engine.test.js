const assert = require("assert").strict;
const knowledgeService = require("../knowledge/knowledge_service");
const bookingEngine = require("../booking/booking_engine");

// Load Knowledge Graph cache
console.log("Loading Knowledge Service cache...");
const loadRes = knowledgeService.loadKnowledge();
assert.ok(loadRes.success, "Failed to load Knowledge Graph");
console.log(`Loaded ${loadRes.loadedCount} nodes successfully.\n`);

function createMockOptimizedItinerary(slots = []) {
  return {
    destination: "Goa",
    durationDays: 1,
    travelersType: "solo",
    travelStyle: "mid",
    dailyPlans: [
      {
        day: 1,
        slots: slots
      }
    ]
  };
}

async function testStandardBookingMidStyle() {
  console.log("Running Test: Standard Booking Mid Style...");
  const itinerary = createMockOptimizedItinerary([
    { type: "stay", nodeId: "goa_hotel_budget", name: "Goa Beach Inn" },
    { type: "activity", nodeId: "goa_attraction_baga_beach", name: "Baga Beach" }
  ]);

  const context = {
    optimizedItinerary: itinerary,
    normalizedEntities: {
      budget: 10000,
      travelStyle: "mid",
      travelersType: "solo"
    }
  };

  const response = bookingEngine.recommendBookings(context);
  assert.ok(response.success);
  
  // Validations
  assert.ok(response.data.recommendedPlaces.length > 0);
  assert.ok(response.data.recommendedTransit.length > 0);
  assert.ok(response.data.recommendedRentals.length > 0);
  assert.ok(response.data.recommendedActivities.length > 0);

  // Verifies metrics
  assert.ok(response.data.budgetSummary.totalBookingCost > 0);
  assert.ok(response.data.budgetSummary.budgetImpactPercent > 0);
  assert.ok(response.data.budgetSummary.confidenceScore > 0);
  
  console.log("  => Standard Booking Mid Style passed!");
}

async function testBudgetBookingStyle() {
  console.log("Running Test: Budget Booking Style (Buses/Trains preferred)...");
  const itinerary = createMockOptimizedItinerary([
    { type: "stay", nodeId: "goa_hotel_budget", name: "Goa Beach Inn" }
  ]);

  const context = {
    optimizedItinerary: itinerary,
    normalizedEntities: {
      budget: 3000,
      travelStyle: "budget",
      travelersType: "solo"
    }
  };

  const response = bookingEngine.recommendBookings(context);
  assert.ok(response.success);

  // Budget lodging: Goa Beach Inn should score higher than Taj Exotica
  assert.strictEqual(response.data.recommendedPlaces[0].id, "book_hotel_goa_beach_inn");
  
  // Budget transit should select bus or train (Konkan sleeper / Paulo Travels volvo) rather than flights
  assert.ok(response.data.recommendedTransit[0].id.includes("bus") || response.data.recommendedTransit[0].id.includes("train"));
  console.log("  => Budget Booking Style passed!");
}

async function testLuxuryBookingStyle() {
  console.log("Running Test: Luxury Booking Style (Flights preferred)...");
  const itinerary = createMockOptimizedItinerary([
    { type: "stay", nodeId: "goa_hotel_taj", name: "Taj" }
  ]);

  const context = {
    optimizedItinerary: itinerary,
    normalizedEntities: {
      budget: 50000,
      travelStyle: "luxury",
      travelersType: "couple"
    }
  };

  const response = bookingEngine.recommendBookings(context);
  assert.ok(response.success);

  // Luxury lodging: Taj Exotica should score higher than Goa Beach Inn
  assert.strictEqual(response.data.recommendedPlaces[0].id, "book_hotel_taj_exotica");
  
  // Luxury transit: Flight preferred
  assert.ok(response.data.recommendedTransit[0].id.includes("flight"));
  console.log("  => Luxury Booking Style passed!");
}

async function runAll() {
  console.log("=== STARTING BOOKING INTELLIGENCE TESTS ===");
  await testStandardBookingMidStyle();
  await testBudgetBookingStyle();
  await testLuxuryBookingStyle();
  console.log("\n=== ALL BOOKING INTELLIGENCE TESTS PASSED ===");
}

runAll().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

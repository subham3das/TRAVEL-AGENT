const assert = require("assert").strict;
const knowledgeService = require("../knowledge/knowledge_service");
const recommendationEngine = require("../recommendation/recommendation_engine");

// Load Knowledge Graph cache
console.log("Loading Knowledge Service cache...");
const loadRes = knowledgeService.loadKnowledge();
assert.ok(loadRes.success, "Failed to load Knowledge Graph");
console.log(`Loaded ${loadRes.loadedCount} nodes successfully.\n`);

function createMockItinerary(slots = []) {
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

async function testWinterRecommendations() {
  console.log("Running Test: Winter Recommendations...");
  // Draft has Baga Beach scheduled
  const itinerary = createMockItinerary([
    { type: "stay", nodeId: "goa_hotel_budget", name: "Goa Beach Inn" },
    { type: "activity", nodeId: "goa_attraction_baga_beach", name: "Baga Beach" }
  ]);

  const context = {
    optimizedItinerary: itinerary,
    normalizedEntities: {
      travelersType: "solo",
      interests: ["beach"],
      travelDates: { startDate: "2026-12-15" } // Winter
    }
  };

  const response = recommendationEngine.recommend(context);
  assert.ok(response.success);
  
  // Checks
  assert.ok(response.data.packingSuggestions.includes("Comfortable walking shoes"));
  assert.ok(response.data.seasonalAdvice.toLowerCase().includes("pleasant winter weather"));
  assert.ok(response.data.recommendedRestaurants.length > 0);
  assert.ok(response.data.recommendedPlaces.length > 0);
  
  // Baga Beach is scheduled, so Anjuna Beach (also Beach category) should be suggested as an alternative!
  assert.ok(response.data.alternatives["goa_attraction_baga_beach"]);
  assert.strictEqual(response.data.alternatives["goa_attraction_baga_beach"].id, "goa_attraction_anjuna_beach");

  console.log("  => Winter Recommendations passed!");
}

async function testRainRecommendations() {
  console.log("Running Test: Rain Recommendations...");
  const itinerary = createMockItinerary([
    { type: "activity", nodeId: "goa_attraction_bom_jesus", name: "Bom Jesus" }
  ]);

  const context = {
    optimizedItinerary: itinerary,
    normalizedEntities: {
      travelDates: { startDate: "2026-07-15" } // July (Rain)
    }
  };

  const response = recommendationEngine.recommend(context);
  assert.ok(response.success);
  assert.ok(response.data.packingSuggestions.includes("Umbrella/Raincoat"));
  assert.ok(response.data.seasonalAdvice.includes("Monsoon rain"));
  console.log("  => Rain Recommendations passed!");
}

async function testEtiquetteAndSafety() {
  console.log("Running Test: Etiquette and Safety tips...");
  const itinerary = createMockItinerary([
    { type: "activity", nodeId: "goa_attraction_bom_jesus", name: "Bom Jesus" }
  ]);

  const context = {
    optimizedItinerary: itinerary
  };

  const response = recommendationEngine.recommend(context);
  assert.ok(response.success);
  assert.ok(response.data.culturalTips.some(t => t.includes("church") || t.includes("temples") || t.includes("dress")));
  assert.ok(response.data.safetyTips.some(t => t.includes("beach") || t.includes("alcohol")));
  console.log("  => Etiquette and Safety passed!");
}

async function runAll() {
  console.log("=== STARTING RECOMMENDATION ENGINE TESTS ===");
  await testWinterRecommendations();
  await testRainRecommendations();
  await testEtiquetteAndSafety();
  console.log("\n=== ALL RECOMMENDATION ENGINE TESTS PASSED ===");
}

runAll().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

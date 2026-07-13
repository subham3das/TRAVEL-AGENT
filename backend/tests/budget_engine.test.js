const assert = require("assert").strict;
const knowledgeService = require("../knowledge/knowledge_service");
const budgetEngine = require("../budget/budget_engine");

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

async function testLowRiskWithinBudget() {
  console.log("Running Test: Low Risk / Within Budget...");
  const itinerary = createMockOptimizedItinerary([
    { type: "stay", nodeId: "goa_hotel_budget", name: "Goa Beach Inn" }, // 2500
    { type: "lunch", nodeId: "goa_restaurant_britannia", name: "Britannia Shack" }, // 600
    { type: "activity", nodeId: "goa_attraction_baga_beach", name: "Baga Beach" }, // 800
    { type: "travel", cost: 100 }
  ]);

  const context = {
    optimizedItinerary: itinerary,
    normalizedEntities: {
      budget: 10000 // Limit 10000 (spent ~4400)
    }
  };

  const response = budgetEngine.calculate(context);
  assert.ok(response.success);
  assert.strictEqual(response.data.budgetSummary.overspent, false);
  assert.strictEqual(response.data.budgetRisk, "low");
  assert.ok(response.data.remainingBudget > 0);
  assert.strictEqual(response.data.costSavingSuggestions.length, 0);
  console.log("  => Low Risk / Within Budget passed!");
}

async function testHighRiskOverspent() {
  console.log("Running Test: High Risk / Overspent...");
  // Taj hotel stay is 18000 (exceeds budget 10000)
  const itinerary = createMockOptimizedItinerary([
    { type: "stay", nodeId: "goa_hotel_taj", name: "Taj" }, // 18000
    { type: "travel", cost: 500 }
  ]);

  const context = {
    optimizedItinerary: itinerary,
    normalizedEntities: {
      budget: 10000
    }
  };

  const response = budgetEngine.calculate(context);
  assert.ok(response.success);
  assert.strictEqual(response.data.budgetSummary.overspent, true);
  assert.strictEqual(response.data.budgetRisk, "high");
  assert.ok(response.data.remainingBudget < 0);
  assert.ok(response.data.costSavingSuggestions.length > 0);
  
  const hotelSaving = response.data.costSavingSuggestions.find(s => s.category === "hotel");
  assert.ok(hotelSaving);
  assert.ok(hotelSaving.impactEstimated > 0);
  console.log("  => High Risk / Overspent passed!");
}

async function testMediumRisk() {
  console.log("Running Test: Medium Risk...");
  // Spend is ~8800, limit is 10000 (ratio ~88% which is > 75%)
  const itinerary = createMockOptimizedItinerary([
    { type: "stay", nodeId: "goa_hotel_budget", name: "Goa Beach Inn" }, // 2500
    { type: "stay", nodeId: "goa_hotel_budget", name: "Goa Beach Inn" }, // 2500
    { type: "activity", nodeId: "goa_attraction_baga_beach", name: "Baga Beach" }, // 800
    { type: "activity", nodeId: "goa_attraction_anjuna_beach", name: "Anjuna Beach" }, // 500
    { type: "travel", cost: 1500 }
  ]);

  const context = {
    optimizedItinerary: itinerary,
    normalizedEntities: {
      budget: 10000
    }
  };

  const response = budgetEngine.calculate(context);
  assert.ok(response.success);
  assert.strictEqual(response.data.budgetSummary.overspent, false);
  assert.strictEqual(response.data.budgetRisk, "medium");
  console.log("  => Medium Risk passed!");
}

async function runAll() {
  console.log("=== STARTING BUDGET ENGINE TESTS ===");
  await testLowRiskWithinBudget();
  await testHighRiskOverspent();
  await testMediumRisk();
  console.log("\n=== ALL BUDGET ENGINE TESTS PASSED ===");
}

runAll().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

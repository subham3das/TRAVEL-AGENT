const assert = require("assert").strict;
const travelApp = require("../app/travel_app");
const knowledgeService = require("../knowledge/knowledge_service");

// Initialize Knowledge Graph
knowledgeService.loadKnowledge();

async function run() {
  console.log("=== STARTING FULL SEED PIPELINE VALIDATION ===");

  // 1. Build a valid TravelContext for a 5-day Goa trip
  const ctx = {
    originalQuery: "Plan me a 5 day Goa trip starting 20 August for 2 adults Budget 40000",
    request: {
      query: "Plan me a 5 day Goa trip starting 20 August for 2 adults Budget 40000"
    },
    state: {
      intent: "GENERATE_PLAN",
      normalizedEntities: {
        destination: "goa",
        durationDays: 5,
        travelStyle: "mid",
        travelersType: "couple",
        budget: 40000,
        travelDates: {
          startDate: "2026-08-20"
        }
      },
      entityConfidence: {
        destination: 1.0,
        durationDays: 1.0,
        travelDates: 1.0,
        travelersType: 1.0,
        travelStyle: 1.0,
        budget: 1.0
      }
    }
  };

  console.log("Executing end-to-end Planning Pipeline...");
  const res = await travelApp.processRequest(ctx);

  console.log("Validating pipeline response contract...");
  assert.ok(res, "Response should be truthy");
  assert.strictEqual(res.success, true, "Execution pipeline failed");
  assert.ok(res.data, "Response data should be present");
  
  // Verify planner results
  assert.ok(res.data.dailyPlan, "Daily plan must be generated");
  assert.strictEqual(res.data.dailyPlan.length, 5, "Daily plan should have exactly 5 days");
  
  // Verify stays (hotels) were selected
  const stays = res.data.dailyPlan.flatMap(d => d.slots || []).filter(s => s.type === "stay");
  assert.ok(stays.length > 0, "Stays must be selected for the itinerary");
  console.log(`✓ Selected stays: ${stays.map(s => s.name).join(", ")}`);

  // Verify food (restaurants) were selected
  const meals = res.data.dailyPlan.flatMap(d => d.slots || []).filter(s => s.type === "lunch");
  assert.ok(meals.length > 0, "Meals must be selected for the itinerary");
  console.log(`✓ Selected meals: ${meals.map(m => m.name).join(", ")}`);

  // Verify budget calculations
  assert.ok(res.data.budgetSummary, "Budget summary must be calculated");
  assert.ok(res.data.budgetSummary.totalCost > 0, "Total cost must be greater than zero");
  console.log(`✓ Total estimated cost: INR ${res.data.budgetSummary.totalCost}`);

  // Verify response composer output
  assert.ok(res.data.composedText || res.data.tripSummary, "Trip summary or composed text must exist");
  
  console.log("\n=== FULL SEED PIPELINE VALIDATION PASSED ===");
}

run().catch(err => {
  console.error("\n❌ PIPELINE VALIDATION FAILED:");
  console.error(err);
  process.exit(1);
});

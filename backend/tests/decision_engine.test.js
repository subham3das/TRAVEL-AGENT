const assert = require("assert").strict;
const knowledgeService = require("../knowledge/knowledge_service");
const decisionEngine = require("../decision/decision_engine");

// Load Knowledge Graph cache
console.log("Loading Knowledge Service cache...");
const loadRes = knowledgeService.loadKnowledge();
assert.ok(loadRes.success, "Failed to load Knowledge Graph");
console.log(`Loaded ${loadRes.loadedCount} nodes successfully.\n`);

function createMockDraftItinerary(slots = [], spend = 5000) {
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
    ]
  };
}

async function testNoChangesRequired() {
  console.log("Running Test: No Changes Required...");
  const draft = createMockDraftItinerary([
    {
      time: "09:00 AM - 12:00 PM",
      type: "activity",
      nodeId: "goa_attraction_bom_jesus",
      name: "Basilica of Bom Jesus",
      score: 95
    }
  ], 1000);

  const context = {
    draftItinerary: draft,
    normalizedEntities: {
      budget: 5000,
      travelDates: { startDate: "2026-12-01" } // Winter
    }
  };

  const response = decisionEngine.optimize(context);
  assert.ok(response.success);
  assert.strictEqual(response.data.decisionLog.length, 0, "Should have 0 optimization decisions");
  console.log("  => No Changes Required passed!");
}

async function testRainScenario() {
  console.log("Running Test: Rain Scenario (Swapping outdoor beachfront)...");
  // Draft has Baga Beach scheduled
  const draft = createMockDraftItinerary([
    {
      time: "05:00 PM - 07:00 PM",
      type: "activity",
      nodeId: "goa_attraction_baga_beach",
      name: "Baga Beach",
      score: 90
    }
  ], 1000);

  const context = {
    draftItinerary: draft,
    normalizedEntities: {
      budget: 5000,
      travelDates: { startDate: "2026-07-15" } // July (Rain)
    }
  };

  const response = decisionEngine.optimize(context);
  assert.ok(response.success);
  
  const weatherReplace = response.data.decisionLog.find(d => d.action === "REPLACE" && d.target === "Baga Beach");
  assert.ok(weatherReplace, "Should replace Baga Beach");
  assert.strictEqual(weatherReplace.replacement, "Basilica of Bom Jesus", "Should swap to indoor church");
  assert.strictEqual(response.data.improvedItinerary.dailyPlans[0].slots[0].nodeId, "goa_attraction_bom_jesus");
  console.log("  => Rain Scenario passed!");
}

async function testBudgetOptimization() {
  console.log("Running Test: Budget Optimization (Cheaper stay swap)...");
  // Total spend is 20000 (exceeds budget limit 10000)
  const draft = createMockDraftItinerary([
    {
      time: "07:00 PM onwards",
      type: "stay",
      nodeId: "goa_hotel_taj",
      name: "Taj Exotica Resort & Spa"
    }
  ], 20000);

  const context = {
    draftItinerary: draft,
    normalizedEntities: {
      budget: 10000 // Limit is 10000
    }
  };

  const response = decisionEngine.optimize(context);
  assert.ok(response.success);

  const budgetReplace = response.data.decisionLog.find(d => d.action === "REPLACE" && d.target === "Taj Exotica Resort & Spa");
  assert.ok(budgetReplace, "Should replace expensive stay");
  assert.ok(response.data.plannerComparison.improved.budgetScore > response.data.plannerComparison.original.budgetScore, "Budget score should improve");
  console.log("  => Budget Optimization passed!");
}

async function testFatigueRestInsertion() {
  console.log("Running Test: Fatigue Rest Insertion...");
  // Let's mock an itinerary with 2 consecutive high-fatigue activities
  // Baga Beach fatigue level is 2, but let's mock two nodeIds with high fatigue
  const draft = createMockDraftItinerary([
    {
      time: "09:00 AM - 12:00 PM",
      type: "activity",
      nodeId: "goa_attraction_baga_beach", // Beach
      name: "Baga Beach"
    },
    {
      time: "01:30 PM - 05:00 PM",
      type: "activity",
      nodeId: "goa_attraction_bom_jesus", // Church
      name: "Basilica of Bom Jesus"
    }
  ], 2000);

  // Set high fatigue on both nodes
  const baga = knowledgeService.getNode("goa_attraction_baga_beach");
  const bomJesus = knowledgeService.getNode("goa_attraction_bom_jesus");
  const origBagaFatigue = baga.fatigueLevel;
  const origBomFatigue = bomJesus.fatigueLevel;
  
  baga.fatigueLevel = 5;
  bomJesus.fatigueLevel = 5;

  const context = {
    draftItinerary: draft,
    normalizedEntities: {
      budget: 5000
    }
  };

  try {
    const response = decisionEngine.optimize(context);
    assert.ok(response.success);
    const breakInsertion = response.data.decisionLog.find(d => d.action === "INSERT_BREAK");
    assert.ok(breakInsertion, "Should insert rest break when consecutive fatigue is high");
    console.log("  => Fatigue Rest Insertion passed!");
  } finally {
    // Restore original fatigue levels
    baga.fatigueLevel = origBagaFatigue;
    bomJesus.fatigueLevel = origBomFatigue;
  }
}

async function testDiversityOptimization() {
  console.log("Running Test: Diversity Optimization...");
  const draft = createMockDraftItinerary([
    {
      time: "09:00 AM - 12:00 PM",
      type: "activity",
      nodeId: "goa_attraction_baga_beach", // category Beach
      name: "Baga Beach"
    },
    {
      time: "01:30 PM - 05:00 PM",
      type: "activity",
      nodeId: "goa_attraction_anjuna_beach", // category Beach
      name: "Anjuna Beach"
    }
  ], 2000);

  const context = {
    draftItinerary: draft,
    normalizedEntities: {
      budget: 5000
    }
  };

  const response = decisionEngine.optimize(context);
  assert.ok(response.success);
  const diversityReplace = response.data.decisionLog.find(d => d.action === "REPLACE" && d.reason.includes("Duplicate consecutive attraction category"));
  assert.ok(diversityReplace, "Should swap duplicate consecutive beach category to maintain diversity");
  console.log("  => Diversity Optimization passed!");
}

async function runAll() {
  console.log("=== STARTING DECISION ENGINE TESTS ===");
  await testNoChangesRequired();
  await testRainScenario();
  await testBudgetOptimization();
  await testFatigueRestInsertion();
  await testDiversityOptimization();
  console.log("\n=== ALL DECISION ENGINE TESTS PASSED ===");
}

runAll().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

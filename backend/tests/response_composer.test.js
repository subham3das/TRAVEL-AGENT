const assert = require("assert").strict;
const composer = require("../response/response_composer");

function createMockContext(recommendations = {}, stateObj = {}) {
  return {
    state: {
      conversationState: {
        currentState: "PLAN_COMPLETED",
        clarificationCount: 0,
        clarificationTarget: null,
        replanningCount: 0,
        ...stateObj
      }
    },
    recommendations: {
      draftItinerary: {
        destination: "Goa",
        durationDays: 3,
        travelStyle: "mid",
        travelersType: "solo",
        dailyPlans: [
          { day: 1, slots: [{ type: "stay", name: "Goa Beach Inn" }, { type: "activity", name: "Baga" }] }
        ],
        metrics: {
          totalDistanceKm: 15.0,
          totalTravelTimeMinutes: 45,
          walkingDistanceKm: 0.5,
          transportCost: 150
        }
      },
      optimizedItinerary: {
        destination: "Goa",
        durationDays: 3,
        travelStyle: "mid",
        travelersType: "solo",
        dailyPlans: [
          { day: 1, slots: [{ type: "stay", name: "Goa Beach Inn" }, { type: "activity", name: "Baga" }] }
        ],
        metrics: {
          totalDistanceKm: 15.0,
          totalTravelTimeMinutes: 45,
          walkingDistanceKm: 0.5,
          transportCost: 150
        }
      },
      budgetSummary: {
        totalCost: 5500,
        userLimit: 10000,
        remainingBudget: 4500,
        budgetRisk: "low",
        validation: { warnings: ["High resort tax applied"] }
      },
      bookingSuggestions: {
        recommendedPlaces: [{ price: 2500 }]
      },
      packingSuggestions: ["Sunscreen", "Shoes"],
      seasonalAdvice: "Sunny winter",
      safetyTips: ["Swim only inside pool"],
      culturalTips: ["Remove shoes"],
      ...recommendations
    }
  };
}

async function testCompleteItinerary() {
  console.log("Running Test: Complete Itinerary...");
  const ctx = createMockContext();
  const execResult = {
    success: true,
    data: {
      executionSummary: "Finished fully",
      executedStages: ["planner", "budget", "booking"]
    },
    warnings: ["High resort tax applied"] // duplicate warning
  };

  const res = composer.compose(ctx, execResult);
  assert.ok(res.success);
  
  // Structure checks
  assert.strictEqual(res.data.tripSummary.destination, "Goa");
  assert.strictEqual(res.data.tripSummary.totalCost, 5500);
  assert.strictEqual(res.data.stayPlan.hotelName, "Goa Beach Inn");
  assert.strictEqual(res.data.stayPlan.pricePerNight, 2500);

  // De-duplication check: "High resort tax applied" is in execResult and budgetSummary, should only appear once!
  const matchedWarnings = res.warnings.filter(w => w === "High resort tax applied");
  assert.strictEqual(matchedWarnings.length, 1, "Warnings must be de-duplicated");

  // Confidence check
  assert.ok(res.confidence > 0 && res.confidence <= 1.0);
  
  // Next actions check
  assert.deepEqual(res.data.nextActions, ["BOOK_TRIP", "MODIFY_PLAN"]);

  console.log("  => Complete Itinerary passed!");
}

async function testClarificationPending() {
  console.log("Running Test: Clarification Pending...");
  const ctx = createMockContext({}, { currentState: "WAITING_FOR_CLARIFICATION" });
  const execResult = {
    success: true,
    data: { executionSummary: "Waiting for clarification" }
  };

  const res = composer.compose(ctx, execResult);
  assert.ok(res.success);
  assert.strictEqual(res.data.conversationState, "WAITING_FOR_CLARIFICATION");
  assert.deepEqual(res.data.nextActions, ["PROVIDE_CLARIFICATION"]);
  console.log("  => Clarification Pending passed!");
}

async function testFailedExecution() {
  console.log("Running Test: Failed Execution...");
  const ctx = createMockContext();
  const execResult = {
    success: false,
    errors: ["Planner service disconnected"],
    data: { executionStatus: "FAILED" }
  };

  const res = composer.compose(ctx, execResult);
  assert.strictEqual(res.success, false);
  assert.ok(res.errors.includes("Planner service disconnected"));
  console.log("  => Failed Execution passed!");
}

async function testMissingComponents() {
  console.log("Running Test: Missing Components (Stays/Bookings/Recommendations)...");
  // Context with no budget, no booking suggestions, no recommendations
  const ctx = {
    state: { conversationState: { currentState: "PLAN_COMPLETED" } },
    recommendations: {
      optimizedItinerary: {
        destination: "Goa",
        durationDays: 3,
        dailyPlans: []
      }
    }
  };

  const res = composer.compose(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.budgetSummary, null);
  assert.strictEqual(res.data.bookingSummary, null);
  assert.strictEqual(res.data.stayPlan, null);
  assert.deepEqual(res.data.packingChecklist, []);
  console.log("  => Missing Components passed!");
}

async function testInvalidAndEmptyContext() {
  console.log("Running Test: Invalid and Empty Context...");
  
  const res = composer.compose(null);
  assert.strictEqual(res.success, false);
  assert.ok(res.errors.length > 0);
  console.log("  => Invalid and Empty Context passed!");
}

async function runAll() {
  console.log("=== STARTING RESPONSE COMPOSER TESTS ===");
  await testCompleteItinerary();
  await testClarificationPending();
  await testFailedExecution();
  await testMissingComponents();
  await testInvalidAndEmptyContext();
  console.log("\n=== ALL RESPONSE COMPOSER TESTS PASSED ===");
}

runAll().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

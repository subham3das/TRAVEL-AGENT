const assert = require("assert").strict;
const engine = require("../planner/replanning_engine");
const conversationState = require("../conversation/conversation_state");

function createMockContext(entities = {}, itineraryVal = true) {
  const context = {
    state: {
      normalizedEntities: {
        destination: "goa",
        durationDays: 3,
        budget: 15000,
        travelStyle: "mid",
        ...entities
      },
      conversationState: {
        currentState: "PLAN_COMPLETED",
        clarificationCount: 0,
        clarificationTarget: null,
        replanningCount: 0,
        requestId: "req-123",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }
  };

  if (itineraryVal) {
    context.recommendations = {
      optimizedItinerary: {
        destination: "Goa",
        dailyPlans: [
          { day: 1, slots: [{ type: "stay", nodeId: "goa_hotel_budget" }] },
          { day: 2, slots: [] },
          { day: 3, slots: [] }
        ]
      }
    };
  }

  return context;
}

async function testNoChanges() {
  console.log("Running Test: No Changes...");
  const curr = createMockContext();
  const prev = createMockContext();

  const res = engine.analyze(curr, prev);
  assert.ok(res.success);
  assert.strictEqual(res.data.requiresReplanning, false);
  assert.strictEqual(res.data.changeSeverity, "NONE");
  console.log("  => No Changes passed!");
}

async function testBudgetIncrease() {
  console.log("Running Test: Budget Increase...");
  const curr = createMockContext({ budget: 25000 });
  const prev = createMockContext({ budget: 15000 });

  const res = engine.analyze(curr, prev);
  assert.ok(res.success);
  assert.strictEqual(res.data.requiresReplanning, true);
  assert.strictEqual(res.data.changeSeverity, "MEDIUM");
  assert.ok(res.data.plannerInstructions.includes("REPLAN_BUDGET"));
  assert.ok(res.data.downstreamEngines.includes("budget"));
  console.log("  => Budget Increase passed!");
}

async function testBudgetDecrease() {
  console.log("Running Test: Budget Decrease...");
  const curr = createMockContext({ budget: 8000 });
  const prev = createMockContext({ budget: 15000 });

  const res = engine.analyze(curr, prev);
  assert.ok(res.success);
  assert.strictEqual(res.data.requiresReplanning, true);
  assert.strictEqual(res.data.changeSeverity, "MEDIUM");
  // Reduced budget requires stay checks in decision engine
  assert.ok(res.data.plannerInstructions.includes("REPLACE_HOTELS"));
  assert.ok(res.data.downstreamEngines.includes("decision"));
  console.log("  => Budget Decrease passed!");
}

async function testDurationChanges() {
  console.log("Running Test: Duration Changes...");
  
  // A. Increase
  let curr = createMockContext({ durationDays: 5 });
  let prev = createMockContext({ durationDays: 3 });
  let res = engine.analyze(curr, prev);
  assert.ok(res.success);
  assert.strictEqual(res.data.changeSeverity, "HIGH");
  assert.ok(res.data.plannerInstructions.includes("PLAN_NEW_DAYS_ONLY"));
  assert.deepEqual(res.data.preservedDays, [1, 2, 3]);
  assert.deepEqual(res.data.affectedDays, [4, 5]);

  // B. Decrease
  curr = createMockContext({ durationDays: 2 });
  prev = createMockContext({ durationDays: 3 });
  res = engine.analyze(curr, prev);
  assert.ok(res.success);
  assert.strictEqual(res.data.changeSeverity, "HIGH");
  assert.ok(res.data.plannerInstructions.includes("TRIM_EXTRA_DAYS"));
  assert.deepEqual(res.data.preservedDays, [1, 2]);
  assert.deepEqual(res.data.affectedDays, [3]);
  
  console.log("  => Duration Changes passed!");
}

async function testDestinationChange() {
  console.log("Running Test: Destination Change...");
  const curr = createMockContext({ destination: "mumbai" });
  const prev = createMockContext({ destination: "goa" });

  const res = engine.analyze(curr, prev);
  assert.ok(res.success);
  assert.strictEqual(res.data.changeSeverity, "CRITICAL");
  assert.strictEqual(res.data.replanningScope, "FULL");
  assert.ok(res.data.plannerInstructions.includes("FULL_REPLAN"));
  console.log("  => Destination Change passed!");
}

async function testHotelAndTransportChanges() {
  console.log("Running Test: Hotel & Transport Changes...");
  
  // Transport preference
  let curr = createMockContext({ transport: "transit" });
  let prev = createMockContext({ transport: "driving" });
  let res = engine.analyze(curr, prev);
  assert.ok(res.success);
  assert.strictEqual(res.data.changeSeverity, "LOW");
  assert.ok(res.data.plannerInstructions.includes("REPLAN_ROUTES"));
  assert.ok(res.data.downstreamEngines.includes("optimizer"));

  // Hotel accommodation
  curr = createMockContext({ accommodation: "hostel" });
  prev = createMockContext({ accommodation: "hotel" });
  res = engine.analyze(curr, prev);
  assert.ok(res.success);
  assert.strictEqual(res.data.changeSeverity, "LOW");
  assert.ok(res.data.plannerInstructions.includes("REPLAN_BOOKINGS"));
  
  console.log("  => Hotel & Transport Changes passed!");
}

async function testBookingPreservation() {
  console.log("Running Test: Booking Preservation...");
  const curr = createMockContext({ budget: 10000 });
  const prev = createMockContext({ budget: 15000 });

  // Add confirmed slot
  prev.recommendations.optimizedItinerary.dailyPlans[0].slots[0].confirmed = true;
  prev.recommendations.optimizedItinerary.dailyPlans[0].slots[0].bookingId = "book_stay_101";

  const res = engine.analyze(curr, prev);
  assert.ok(res.success);
  assert.deepEqual(res.data.preservedBookings, ["book_stay_101"]);
  console.log("  => Booking Preservation passed!");
}

async function testLoopPrevention() {
  console.log("Running Test: Loop Prevention...");
  const curr = createMockContext({ budget: 12000 });
  const prev = createMockContext({ budget: 15000 });

  // Set replanning count to 6
  curr.state.conversationState.replanningCount = 6;

  const res = engine.analyze(curr, prev);
  assert.strictEqual(res.success, false);
  assert.ok(res.errors[0].includes("limit exceeded"));
  assert.strictEqual(curr.state.conversationState.currentState, "ERROR");
  console.log("  => Loop Prevention passed!");
}

async function testEdgeAndInvalidContext() {
  console.log("Running Test: Edge and Invalid Context...");
  
  // A. Null current context
  let res = engine.analyze(null, null);
  assert.strictEqual(res.success, false);
  assert.ok(res.errors.length > 0);

  // B. Missing previous context (reverts to FULL_REPLAN)
  const curr = createMockContext();
  res = engine.analyze(curr, null);
  assert.ok(res.success);
  assert.strictEqual(res.data.replanningScope, "FULL");
  
  console.log("  => Edge and Invalid Context passed!");
}

async function runAll() {
  console.log("=== STARTING REPLANNING ENGINE TESTS ===");
  await testNoChanges();
  await testBudgetIncrease();
  await testBudgetDecrease();
  await testDurationChanges();
  await testDestinationChange();
  await testHotelAndTransportChanges();
  await testBookingPreservation();
  await testLoopPrevention();
  await testEdgeAndInvalidContext();
  console.log("\n=== ALL REPLANNING ENGINE TESTS PASSED ===");
}

runAll().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

const assert = require("assert").strict;
const engine = require("../conversation/clarification_engine");
const conversationState = require("../conversation/conversation_state");

function createMockContext(entities = {}, confidences = {}, stateVal = "IDLE") {
  return {
    state: {
      normalizedEntities: entities,
      entityConfidence: confidences,
      conversationState: {
        currentState: stateVal,
        clarificationCount: 0,
        clarificationTarget: null,
        replanningCount: 0,
        requestId: "req-123",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }
  };
}

async function testMissingDestination() {
  console.log("Running Test: Missing Destination...");
  const ctx = createMockContext({
    travelDates: { startDate: "2026-12-15" },
    durationDays: 3,
    travelersType: "solo"
  });

  const res = engine.evaluate(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.requiresClarification, true);
  assert.deepEqual(res.data.missingFields, ["destination"]);
  assert.strictEqual(res.data.questions[0].field, "destination");
  assert.ok(res.data.questions[0].question.includes("destination"));
  console.log("  => Missing Destination passed!");
}

async function testMissingDates() {
  console.log("Running Test: Missing Dates...");
  const ctx = createMockContext({
    destination: "goa",
    durationDays: 3,
    travelersType: "solo"
  });

  const res = engine.evaluate(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.requiresClarification, true);
  assert.deepEqual(res.data.missingFields, ["travelDates"]);
  assert.strictEqual(res.data.questions[0].field, "travelDates");
  console.log("  => Missing Dates passed!");
}

async function testMissingDuration() {
  console.log("Running Test: Missing Duration...");
  const ctx = createMockContext({
    destination: "goa",
    travelDates: { startDate: "2026-12-15" },
    travelersType: "solo"
  });

  const res = engine.evaluate(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.requiresClarification, true);
  assert.deepEqual(res.data.missingFields, ["durationDays"]);
  console.log("  => Missing Duration passed!");
}

async function testMissingTravelers() {
  console.log("Running Test: Missing Travelers...");
  const ctx = createMockContext({
    destination: "goa",
    travelDates: { startDate: "2026-12-15" },
    durationDays: 3
  });

  const res = engine.evaluate(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.requiresClarification, true);
  assert.deepEqual(res.data.missingFields, ["travelersType"]);
  console.log("  => Missing Travelers passed!");
}

async function testMultipleMissingFieldsPriority() {
  console.log("Running Test: Multiple Missing Fields (Priority checking)...");
  // Destination and durationDays missing
  const ctx = createMockContext({
    travelDates: { startDate: "2026-12-15" },
    travelersType: "solo"
  });

  const res = engine.evaluate(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.requiresClarification, true);
  assert.deepEqual(res.data.missingFields, ["destination", "durationDays"]);
  // Destination has higher priority than durationDays, so it should ask for destination first!
  assert.strictEqual(res.data.questions[0].field, "destination");
  console.log("  => Multiple Missing Fields passed!");
}

async function testLowConfidenceDestination() {
  console.log("Running Test: Low Confidence Destination (< 0.6)...");
  const ctx = createMockContext(
    {
      destination: "goa",
      travelDates: { startDate: "2026-12-15" },
      durationDays: 3,
      travelersType: "solo"
    },
    {
      destination: 0.4 // Low confidence!
    }
  );

  const res = engine.evaluate(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.requiresClarification, true);
  assert.deepEqual(res.data.missingFields, ["destination"]);
  console.log("  => Low Confidence Destination passed!");
}

async function testMediumConfidenceConfirmation() {
  console.log("Running Test: Medium Confidence Confirmation (0.6 - 0.9)...");
  const ctx = createMockContext(
    {
      destination: "goa",
      travelDates: { startDate: "2026-12-15" },
      durationDays: 3,
      travelersType: "solo"
    },
    {
      destination: 0.8 // Medium confidence!
    }
  );

  const res = engine.evaluate(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.requiresClarification, true, "Should require confirmation prompt");
  assert.ok(res.data.questions[0].question.includes("We set your destination"));
  assert.strictEqual(res.data.readyForExecution, true, "Ready for execution is true since value was accepted");
  console.log("  => Medium Confidence Confirmation passed!");
}

async function testRetryLimitExceeded() {
  console.log("Running Test: Retry Limit Exceeded...");
  const ctx = createMockContext({
    travelDates: { startDate: "2026-12-15" },
    durationDays: 3,
    travelersType: "solo"
  });

  // Set target and trigger 3 clarification increments
  ctx.state.conversationState.clarificationTarget = "destination";
  ctx.state.conversationState.clarificationCount = 3;

  const res = engine.evaluate(ctx);
  assert.strictEqual(res.success, false);
  assert.ok(res.errors[0].includes("Max clarification retries exceeded"));
  assert.strictEqual(ctx.state.conversationState.currentState, "ERROR");
  console.log("  => Retry Limit Exceeded passed!");
}

async function testReadyForExecution() {
  console.log("Running Test: Ready for Execution...");
  const ctx = createMockContext({
    destination: "goa",
    travelDates: { startDate: "2026-12-15" },
    durationDays: 3,
    travelersType: "solo"
  });

  const res = engine.evaluate(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.requiresClarification, false);
  assert.strictEqual(res.data.readyForExecution, true);
  assert.strictEqual(ctx.state.conversationState.currentState, "PLANNING");
  console.log("  => Ready for Execution passed!");
}

async function testEmptyAndInvalidContext() {
  console.log("Running Test: Empty and Invalid Context...");
  
  const res = engine.evaluate(null);
  assert.strictEqual(res.success, false);
  assert.ok(res.errors.length > 0);
  console.log("  => Empty and Invalid Context passed!");
}

async function runAll() {
  console.log("=== STARTING CLARIFICATION ENGINE TESTS ===");
  await testMissingDestination();
  await testMissingDates();
  await testMissingDuration();
  await testMissingTravelers();
  await testMultipleMissingFieldsPriority();
  await testLowConfidenceDestination();
  await testMediumConfidenceConfirmation();
  await testRetryLimitExceeded();
  await testReadyForExecution();
  await testEmptyAndInvalidContext();
  console.log("\n=== ALL CLARIFICATION ENGINE TESTS PASSED ===");
}

runAll().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

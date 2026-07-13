const assert = require("assert").strict;
const knowledgeService = require("../knowledge/knowledge_service");
const executionEngine = require("../execution/execution_engine");

// Load Knowledge Graph cache
console.log("Loading Knowledge Service cache...");
const loadRes = knowledgeService.loadKnowledge();
assert.ok(loadRes.success, "Failed to load Knowledge Graph");
console.log(`Loaded ${loadRes.loadedCount} nodes successfully.\n`);

function createMockContext(query, entities = {}, intent = "GENERATE_PLAN") {
  return {
    originalQuery: query,
    request: { query },
    state: {
      intent,
      normalizedEntities: {
        destination: "goa",
        durationDays: 3,
        travelersType: "solo",
        travelStyle: "mid",
        travelDates: { startDate: "2026-12-15" },
        ...entities
      },
      entityConfidence: {
        destination: 1.0,
        travelDates: 1.0,
        durationDays: 1.0,
        travelersType: 1.0
      },
      conversationState: {
        currentState: "IDLE",
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

async function testCompleteExecution() {
  console.log("Running Test: Complete Execution...");
  const ctx = createMockContext("I want to travel to Goa");
  
  const res = await executionEngine.execute(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.executionStatus, "COMPLETED");
  assert.ok(res.data.executedStages.includes("planner"));
  assert.ok(res.data.executedStages.includes("optimizer"));
  assert.ok(res.data.executedStages.includes("budget"));
  assert.ok(res.data.executedStages.includes("recommendation"));
  
  // Verify context merge output
  assert.ok(ctx.recommendations.optimizedItinerary);
  assert.ok(ctx.recommendations.budgetSummary);
  console.log("  => Complete Execution passed!");
}

async function testClarificationStop() {
  console.log("Running Test: Clarification Stop...");
  // Missing destination (triggers clarification prompt and halts downstream planner)
  const ctx = createMockContext("Plan a trip", { destination: null });

  const res = await executionEngine.execute(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.executionStatus, "WAITING_CLARIFICATION");
  assert.strictEqual(res.data.readyForExecution, undefined);
  assert.strictEqual(res.data.executedStages.includes("planner"), false, "Planner must be blocked on clarification");
  console.log("  => Clarification Stop passed!");
}

async function testReplanningPath() {
  console.log("Running Test: Replanning Path...");
  const prev = createMockContext("Plan Goa");
  
  // Initialize baseline plan on previous context
  await executionEngine.execute(prev);

  // Current has only budget changed (medium severity, runs budget and recs, skips planner/decision)
  const curr = createMockContext("Plan Goa", { budget: 25000 });
  curr.recommendations = prev.recommendations;
  const res = await executionEngine.execute(curr, prev);

  if (!res.success) {
    console.error("Replanning Path execution failed with errors:", res.errors);
  }
  assert.ok(res.success);
  assert.strictEqual(res.data.executionStatus, "COMPLETED");
  if (res.data.executedStages.includes("planner")) {
    console.error("Planner was executed! Executed stages were:", res.data.executedStages);
  }
  assert.strictEqual(res.data.executedStages.includes("planner"), false, "Planner should be skipped on simple budget increase");
  assert.ok(res.data.executedStages.includes("budget"));
  console.log("  => Replanning Path passed!");
}

async function testUnknownEngine() {
  console.log("Running Test: Unknown Engine...");
  const ctx = createMockContext("Plan");
  
  // Register hacky unknown engine to registry
  executionEngine.registerEngine("broken_engine", () => {
    throw new Error("Simulated crash");
  }, true);

  const res = await executionEngine.execute(ctx);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.data.executionStatus, "FAILED");
  assert.ok(res.errors[0].includes("Simulated crash"));
  
  // Clean up
  delete executionEngine.registry.broken_engine;
  executionEngine.sequence.pop();
  console.log("  => Unknown Engine passed!");
}

async function testRecoverableFailure() {
  console.log("Running Test: Recoverable Failure...");
  const ctx = createMockContext("Goa", {}, "BOOK_TRIP");

  // Modify booking engine runner to simulate failure (booking is non-critical)
  const originalBooking = executionEngine.registry.booking.run;
  executionEngine.registry.booking.run = () => {
    return { success: false, errors: ["Transient provider timeout"] };
  };

  const res = await executionEngine.execute(ctx);
  assert.ok(res.success, "Recoverable failure should not halt overall pipeline success");
  assert.strictEqual(res.data.executionStatus, "COMPLETED");
  assert.ok(res.data.failedStages.includes("booking"));
  
  // Restore booking engine
  executionEngine.registry.booking.run = originalBooking;
  console.log("  => Recoverable Failure passed!");
}

async function testLoggingAndTransitions() {
  console.log("Running Test: Logging and Transitions...");
  const ctx = createMockContext("Plan");
  const res = await executionEngine.execute(ctx);

  assert.ok(res.success);
  assert.ok(res.metadata.stageLogs.length > 0);
  
  const plannerLog = res.metadata.stageLogs.find(l => l.stage === "planner");
  assert.ok(plannerLog);
  assert.strictEqual(plannerLog.status, "COMPLETED");
  assert.ok(plannerLog.durationMs >= 0);
  console.log("  => Logging and Transitions passed!");
}

async function runAll() {
  console.log("=== STARTING EXECUTION ENGINE TESTS ===");
  await testCompleteExecution();
  await testClarificationStop();
  await testReplanningPath();
  await testUnknownEngine();
  await testRecoverableFailure();
  await testLoggingAndTransitions();
  console.log("\n=== ALL EXECUTION ENGINE TESTS PASSED ===");
}

runAll().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

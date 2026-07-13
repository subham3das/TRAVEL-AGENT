const assert = require("assert").strict;
const manager = require("../conversation/conversation_state");

// Helper to create empty mock context
function createMockContext() {
  return {
    state: {}
  };
}

async function testInitialization() {
  console.log("Running Test: State Initialization...");
  const context = createMockContext();
  const state = manager.getConversationState(context);

  assert.ok(state);
  assert.strictEqual(state.currentState, manager.STATES.IDLE);
  assert.strictEqual(state.clarificationCount, 0);
  assert.ok(state.requestId.startsWith("req-"));
  console.log("  => State Initialization passed!");
}

async function testValidTransitions() {
  console.log("Running Test: Valid Transitions...");
  const context = createMockContext();

  // IDLE -> COLLECTING_INFORMATION
  let res = manager.transitionConversationState(context, manager.STATES.COLLECTING_INFORMATION);
  assert.ok(res.success);
  assert.strictEqual(res.data.currentState, manager.STATES.COLLECTING_INFORMATION);

  // COLLECTING_INFORMATION -> WAITING_FOR_CLARIFICATION
  res = manager.transitionConversationState(context, manager.STATES.WAITING_FOR_CLARIFICATION);
  assert.ok(res.success);
  assert.strictEqual(res.data.currentState, manager.STATES.WAITING_FOR_CLARIFICATION);

  // WAITING_FOR_CLARIFICATION -> PLANNING
  res = manager.transitionConversationState(context, manager.STATES.PLANNING);
  assert.ok(res.success);
  assert.strictEqual(res.data.currentState, manager.STATES.PLANNING);

  // PLANNING -> COMPLETED
  res = manager.transitionConversationState(context, manager.STATES.COMPLETED);
  assert.ok(res.success);
  assert.strictEqual(res.data.currentState, manager.STATES.COMPLETED);
  
  console.log("  => Valid Transitions passed!");
}

async function testInvalidTransitions() {
  console.log("Running Test: Invalid Transitions...");
  const context = createMockContext();

  // IDLE -> COMPLETED (Invalid transition!)
  const res = manager.transitionConversationState(context, manager.STATES.COMPLETED);
  assert.strictEqual(res.success, false, "Should reject transition from IDLE to COMPLETED");
  assert.ok(res.errors.length > 0);
  assert.strictEqual(res.data.currentState, manager.STATES.IDLE);
  console.log("  => Invalid Transitions passed!");
}

async function testClarificationLoops() {
  console.log("Running Test: Clarification Loops & Resets...");
  const context = createMockContext();

  manager.transitionConversationState(context, manager.STATES.COLLECTING_INFORMATION);
  manager.transitionConversationState(context, manager.STATES.WAITING_FOR_CLARIFICATION);

  // Simulate repeated loops
  manager.incrementClarificationCount(context);
  manager.incrementClarificationCount(context);
  let state = manager.getConversationState(context);
  assert.strictEqual(state.clarificationCount, 2);

  // Reset
  manager.resetClarificationCount(context);
  state = manager.getConversationState(context);
  assert.strictEqual(state.clarificationCount, 0);
  console.log("  => Clarification Loops passed!");
}

async function testResetOnIdle() {
  console.log("Running Test: Reset Metrics on Idle transition...");
  const context = createMockContext();

  manager.transitionConversationState(context, manager.STATES.COLLECTING_INFORMATION);
  manager.transitionConversationState(context, manager.STATES.WAITING_FOR_CLARIFICATION);
  
  // Set counters
  manager.incrementClarificationCount(context);
  manager.transitionConversationState(context, manager.STATES.IDLE);
  
  const state = manager.getConversationState(context);
  assert.strictEqual(state.clarificationCount, 0, "Clarification count should reset to 0 on IDLE");
  console.log("  => Reset on Idle passed!");
}

async function testCompletionConvenience() {
  console.log("Running Test: Completion Convenience Method...");
  const context = createMockContext();

  // Set up planning state first
  manager.transitionConversationState(context, manager.STATES.COLLECTING_INFORMATION);
  manager.transitionConversationState(context, manager.STATES.PLANNING);

  const res = manager.markConversationCompleted(context);
  assert.ok(res.success);
  assert.strictEqual(res.data.currentState, manager.STATES.COMPLETED);
  console.log("  => Completion Convenience passed!");
}

async function runAll() {
  console.log("=== STARTING CONVERSATION STATE TESTS ===");
  await testInitialization();
  await testValidTransitions();
  await testInvalidTransitions();
  await testClarificationLoops();
  await testResetOnIdle();
  await testCompletionConvenience();
  console.log("\n=== ALL CONVERSATION STATE TESTS PASSED ===");
}

runAll().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

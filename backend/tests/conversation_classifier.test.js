const assert = require("assert").strict;
const classifier = require("../conversation/conversation_classifier");
const conversationState = require("../conversation/conversation_state");

function createMockContext(query, stateVal = "IDLE", hasPlan = false) {
  const context = {
    originalQuery: query,
    request: { query },
    state: {
      conversationState: {
        currentState: stateVal,
        clarificationCount: 0,
        clarificationTarget: null,
        replanningCount: 0
      }
    }
  };

  if (hasPlan) {
    context.recommendations = {
      optimizedItinerary: { destination: "Goa" }
    };
  }

  return context;
}

async function testGreetingsAndCancellations() {
  console.log("Running Test: Greetings and Cancellations...");
  
  // Greeting
  let ctx = createMockContext("Hello there!");
  let res = classifier.classifyConversation(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.detectedType, classifier.TYPES.GREETING);

  // Cancellation
  ctx = createMockContext("Cancel everything");
  res = classifier.classifyConversation(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.detectedType, classifier.TYPES.CANCEL);
  
  console.log("  => Greetings and Cancellations passed!");
}

async function testNewRequest() {
  console.log("Running Test: New Request...");
  const ctx = createMockContext("I want to travel to Goa for 5 days");
  const res = classifier.classifyConversation(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.detectedType, classifier.TYPES.NEW_REQUEST);
  console.log("  => New Request passed!");
}

async function testModifications() {
  console.log("Running Test: Modifications...");
  
  // Direct change keyword
  let ctx = createMockContext("Actually make it 3 days");
  let res = classifier.classifyConversation(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.detectedType, classifier.TYPES.MODIFICATION);

  // Budget change
  ctx = createMockContext("My budget is now 40k");
  res = classifier.classifyConversation(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.detectedType, classifier.TYPES.MODIFICATION);
  console.log("  => Modifications passed!");
}

async function testBookingRequests() {
  console.log("Running Test: Booking Requests...");
  const ctx = createMockContext("Please reserve this hotel now");
  const res = classifier.classifyConversation(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.detectedType, classifier.TYPES.BOOKING_REQUEST);
  console.log("  => Booking Requests passed!");
}

async function testStateDependentClarification() {
  console.log("Running Test: State Dependent Clarification Response...");
  
  // Case A: State is WAITING_FOR_CLARIFICATION
  let ctx = createMockContext("30000", conversationState.STATES.WAITING_FOR_CLARIFICATION);
  let res = classifier.classifyConversation(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.detectedType, classifier.TYPES.CLARIFICATION_RESPONSE, "Numeric input during WAITING_FOR_CLARIFICATION should classify as clarification response");

  // Case B: State is IDLE (should default to general or something else)
  ctx = createMockContext("30000", conversationState.STATES.IDLE);
  res = classifier.classifyConversation(ctx);
  assert.ok(res.success);
  assert.notStrictEqual(res.data.detectedType, classifier.TYPES.CLARIFICATION_RESPONSE, "Inputs outside WAITING_FOR_CLARIFICATION should not be clarification responses");
  
  console.log("  => State Dependent Clarification passed!");
}

async function testQuestionsAndFollowUps() {
  console.log("Running Test: Questions and Follow-ups...");
  
  // Question with active plan
  let ctx = createMockContext("Is Baga Beach family friendly?", "COMPLETED", true);
  let res = classifier.classifyConversation(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.detectedType, classifier.TYPES.QUESTION_ABOUT_PLAN);

  // Follow-up (non-question but active plan)
  ctx = createMockContext("Tell me about local fish curry", "COMPLETED", true);
  res = classifier.classifyConversation(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.detectedType, classifier.TYPES.FOLLOW_UP);

  // General chat (no plan)
  ctx = createMockContext("What is the weather like in Paris?", "IDLE", false);
  res = classifier.classifyConversation(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.detectedType, classifier.TYPES.GENERAL_CHAT);
  console.log("  => Questions and Follow-ups passed!");
}

async function testEmptyAndEdgeCases() {
  console.log("Running Test: Empty and Edge Cases...");
  
  // Empty message
  let ctx = createMockContext("");
  let res = classifier.classifyConversation(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.detectedType, classifier.TYPES.UNKNOWN);
  assert.ok(res.data.confidence === 0.0);

  // Invalid context (throws)
  res = classifier.classifyConversation(null);
  assert.strictEqual(res.success, false);
  assert.ok(res.errors.length > 0);
  console.log("  => Empty and Edge Cases passed!");
}

async function runAll() {
  console.log("=== STARTING CONVERSATION CLASSIFIER TESTS ===");
  await testGreetingsAndCancellations();
  await testNewRequest();
  await testModifications();
  await testBookingRequests();
  await testStateDependentClarification();
  await testQuestionsAndFollowUps();
  await testEmptyAndEdgeCases();
  console.log("\n=== ALL CONVERSATION CLASSIFIER TESTS PASSED ===");
}

runAll().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

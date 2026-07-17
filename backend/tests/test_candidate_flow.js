/**
 * Travel OS — Phase 6: Candidate Flow Strict Steps Verification Test
 *
 * Verifies strict state sequence:
 * DESTINATION → PLACES → BUDGET_ESTIMATE → BUDGET_INPUT → DAYS_INPUT → HOTEL → FLIGHT → READY
 */

"use strict";

const assert = require("assert");
const candidateFlow = require("../conversation/candidate_flow");
const conversationState = require("../conversation/conversation_state");
const knowledgeLoader = require("../knowledge/loader/knowledge_loader");

async function runTests() {
  console.log("=== STARTING PHASE 6 CANDIDATE FLOW TESTS ===");

  // Load Knowledge Graph for places & provider results
  knowledgeLoader.load();

  const context = {
    userId: "test-user-flow",
    sessionId: "test-session-flow",
    state: {
      normalizedEntities: {},
      conversationState: {
        journeyState: "START"
      }
    },
    recommendations: {
      budgetSummary: {
        minimumRequired: 18000,
        comfortable: 25000,
        luxury: 45000,
        minimumDays: 4
      }
    }
  };

  // Step 1: Destination
  console.log("Testing stage: DESTINATION");
  let res = await candidateFlow.evaluate(context);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.requiresClarification, true);
  const activeState = conversationState.getConversationState(context);
  assert.strictEqual(activeState.candidateFlow, "DESTINATION");
  
  // Set destination
  context.state.normalizedEntities.destination = "goa";
  
  // Step 2: Places
  console.log("Testing stage: PLACES");
  res = await candidateFlow.evaluate(context);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.requiresClarification, true);
  assert.strictEqual(activeState.candidateFlow, "PLACES");
  assert.ok(activeState.clarificationConfig.candidates.length > 0);
  
  // Select experiences
  context.state.normalizedEntities.selectedPlaces = ["goa_attraction_1"];
  
  // Step 3: Budget Estimate
  console.log("Testing stage: BUDGET_ESTIMATE");
  res = await candidateFlow.evaluate(context);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.requiresClarification, true);
  assert.strictEqual(activeState.candidateFlow, "BUDGET_ESTIMATE");
  assert.ok(activeState.clarificationConfig.prompt.includes("Comfortable"));

  // Confirm Comfortable budget
  context.state.normalizedEntities.budgetEstimateResponse = "Confirm Comfortable (₹25,000)";
  // Run evaluator to let it parse response and transition state
  res = await candidateFlow.evaluate(context);
  assert.strictEqual(context.state.normalizedEntities.budget, 25000, "Should automatically parse and set budget to 25000.");
  
  // Step 4: Days Input
  console.log("Testing stage: DAYS_INPUT");
  res = await candidateFlow.evaluate(context);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.requiresClarification, true);
  assert.strictEqual(activeState.candidateFlow, "DAYS_INPUT");
  
  // Set duration days
  context.state.normalizedEntities.durationDays = 5;

  // Step 5: Hotel Selection
  console.log("Testing stage: HOTEL");
  res = await candidateFlow.evaluate(context);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.requiresClarification, true);
  assert.strictEqual(activeState.candidateFlow, "HOTEL");
  assert.ok(activeState.clarificationConfig.candidates.length > 0, "Should load hotel candidates from SearchLayer.");

  // Set selected hotel
  context.state.normalizedEntities.selectedHotel = { id: "goa-hotel-opt1", name: "Taj Exotica" };

  // Step 6: Flight Selection
  console.log("Testing stage: FLIGHT");
  res = await candidateFlow.evaluate(context);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.requiresClarification, true);
  assert.strictEqual(activeState.candidateFlow, "FLIGHT");
  assert.ok(activeState.clarificationConfig.candidates.length > 0, "Should load flight candidates from SearchLayer.");

  // Set selected flight
  context.state.normalizedEntities.selectedFlight = { id: "goa-flight-opt1", name: "IndiGo 6E" };

  // Step 7: Ready / Planning release
  console.log("Testing stage: READY");
  res = await candidateFlow.evaluate(context);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.requiresClarification, false, "Ready state should not require clarification.");
  assert.strictEqual(activeState.candidateFlow, "READY");
  assert.strictEqual(activeState.currentState, conversationState.STATES.PLANNING, "Should transition conversationState to PLANNING.");

  console.log("=== ALL CANDIDATE FLOW SEQUENCE TESTS PASSED ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

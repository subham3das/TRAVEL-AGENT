const assert = require("assert").strict;
const knowledgeService = require("../knowledge/knowledge_service");
const travelApp = require("../app/travel_app");
const memoryEngine = require("../memory/memory_engine");

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
      userId: "usr-e2e-123",
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

async function testNewTripPlanning() {
  console.log("Running Scenario: New Trip Planning (Goa)...");
  const ctx = createMockContext("I want to travel to Goa");

  const res = await travelApp.processRequest(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.tripSummary.destination, "Goa");
  assert.ok(res.data.dailyPlan.length > 0);
  assert.ok(res.data.budgetSummary.totalCost > 0);
  console.log("  => New Trip Planning passed!");
}

async function testBudgetTrip() {
  console.log("Running Scenario: Budget Trip...");
  const ctx = createMockContext("Plan a budget trip", { travelStyle: "budget", budget: 8000 });

  const res = await travelApp.processRequest(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.tripSummary.travelStyle, "budget");
  console.log("  => Budget Trip passed!");
}

async function testLuxuryTrip() {
  console.log("Running Scenario: Luxury Trip...");
  const ctx = createMockContext("Plan a luxury trip to Goa", { travelStyle: "luxury", budget: 90000 });

  const res = await travelApp.processRequest(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.tripSummary.travelStyle, "luxury");
  console.log("  => Luxury Trip passed!");
}

async function testFamilyTrip() {
  console.log("Running Scenario: Family Trip...");
  const ctx = createMockContext("Family trip to Goa", { travelersType: "family" });

  const res = await travelApp.processRequest(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.tripSummary.travelersType, "family");
  console.log("  => Family Trip passed!");
}

async function testSoloTrip() {
  console.log("Running Scenario: Solo Trip...");
  const ctx = createMockContext("Solo trip to Goa", { travelersType: "solo" });

  const res = await travelApp.processRequest(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.tripSummary.travelersType, "solo");
  console.log("  => Solo Trip passed!");
}

async function testMissingDestinationClarification() {
  console.log("Running Scenario: Missing Destination Clarification...");
  // Destination missing
  const ctx = createMockContext("Plan a trip", { destination: null });

  const res = await travelApp.processRequest(ctx);
  assert.ok(res.success);
  assert.strictEqual(res.data.conversationState, "WAITING_FOR_CLARIFICATION");
  assert.strictEqual(res.data.tripSummary, null);
  console.log("  => Missing Destination Clarification passed!");
}

async function testTripModificationAndReplanning() {
  console.log("Running Scenario: Trip Modification and Replanning...");
  const prev = createMockContext("Plan Goa");
  
  // 1. Initial Plan
  const prevRes = await travelApp.processRequest(prev);
  assert.ok(prevRes.success);

  // 2. Modifying budget (updates budget summary without rerunning planner)
  const curr = createMockContext("Plan Goa", { budget: 25000 });
  curr.recommendations = prev.recommendations;

  const res = await travelApp.processRequest(curr, prev);
  assert.ok(res.success);
  assert.strictEqual(res.data.tripSummary.totalCost, 12244);
  console.log("  => Trip Modification and Replanning passed!");
}

async function testBookingFlow() {
  console.log("Running Scenario: Booking Flow...");
  const ctx = createMockContext("Book Goa stays", {}, "BOOK_TRIP");

  const res = await travelApp.processRequest(ctx);
  assert.ok(res.success);
  assert.ok(res.data.bookingSummary);
  assert.ok(res.data.bookingSummary.recommendedPlaces.length > 0);
  console.log("  => Booking Flow passed!");
}

async function testMemoryIntegration() {
  console.log("Running Scenario: Memory Integration...");
  const ctx = createMockContext("Plan Goa", { travelStyle: "luxury" });

  // Luxury preference should trigger memory store operation inside App flow
  const res = await travelApp.processRequest(ctx);
  assert.ok(res.success);

  // Retrieve memory to verify it saved luxury preference
  const memRes = memoryEngine.retrieveMemory("usr-e2e-123", "Travel Style");
  assert.ok(memRes.success);
  const values = memRes.data.map(m => m.value);
  assert.ok(values.includes("luxury"));
  console.log("  => Memory Integration passed!");
}

async function testRainScenarioSwapping() {
  console.log("Running Scenario: Rain Scenario Swapping...");
  // Monsoon dates in July (rainy season)
  const ctx = createMockContext("Plan rainy Goa", { travelDates: { startDate: "2026-07-10" } });

  const res = await travelApp.processRequest(ctx);
  assert.ok(res.success);
  
  // Verify Baga beach is removed from day slots (swapped due to heavy rain warnings)
  const allSlots = res.data.dailyPlan.flatMap(d => d.slots);
  const bagaBeach = allSlots.find(s => s.nodeId === "goa_attraction_baga_beach");
  assert.strictEqual(bagaBeach, undefined, "Baga Beach attraction must be swapped out during rainy season");
  console.log("  => Rain Scenario Swapping passed!");
}

async function testInvalidAndEmptyRequests() {
  console.log("Running Scenario: Invalid and Empty Requests...");
  
  const resEmpty = await travelApp.processRequest(null);
  assert.strictEqual(resEmpty.success, false);
  assert.ok(resEmpty.errors.length > 0);
  console.log("  => Invalid and Empty Requests passed!");
}

async function runAll() {
  console.log("=== STARTING END-TO-END SYSTEM TESTS ===");
  await testNewTripPlanning();
  await testBudgetTrip();
  await testLuxuryTrip();
  await testFamilyTrip();
  await testSoloTrip();
  await testMissingDestinationClarification();
  await testTripModificationAndReplanning();
  await testBookingFlow();
  await testMemoryIntegration();
  await testRainScenarioSwapping();
  await testInvalidAndEmptyRequests();
  console.log("\n=== ALL END-TO-END SYSTEM TESTS PASSED ===");
}

runAll().catch(err => {
  console.error("Scenario execution failed:", err);
  process.exit(1);
});

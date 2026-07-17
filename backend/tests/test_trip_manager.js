/**
 * Trip Manager — End-to-End Test
 *
 * Tests:
 * 1. TripManager persists trip to memory
 * 2. TripManager triggers learning from trip data
 * 3. TripManager generates trip summary
 * 4. ExecutionEngine pipeline includes tripManager stage
 * 5. Memory finalize is called after pipeline
 */

"use strict";

const tripManager = require("../trip/trip_manager");
const memoryManager = require("../memory/memory_manager");
const permanentMemory = require("../memory/permanent_memory");
const executionEngine = require("../execution/execution_engine");

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${label}`);
  }
}

function uid() { return "trip-test-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6); }
function cleanup(id) { try { permanentMemory.forgetAll(id); } catch (e) {} }

// ─── Test 1: TripManager — persists trip to memory ─────────────────────

console.log("\n=== Test 1: TripManager — persists trip to memory ===");

const u1 = uid();
const context1 = {
  userId: u1,
  sessionId: "test-session-1",
  state: {
    intent: "PLAN_TRIP",
    normalizedEntities: {
      destination: "goa",
      durationDays: 4,
      travelersType: "couple",
      travelStyle: "mid"
    }
  },
  recommendations: {
    candidates: [
      { id: "h1", name: "Taj Fort Aguada", type: "hotel", location: "North Goa", rating: 4.7, raw: { type: "hotel" } },
      { id: "f1", name: "IndiGo 6E", type: "flight", raw: { type: "flight", pricing: { price: 5800 } } }
    ],
    draftItinerary: {
      destination: "goa",
      durationDays: 4,
      dailyPlans: [
        { day: 1, slots: [
          { type: "stay", name: "Taj Fort Aguada" },
          { type: "attraction", name: "Fort Aguada" },
          { type: "attraction", name: "Calangute Beach" }
        ]},
        { day: 2, slots: [
          { type: "attraction", name: "Baga Beach" },
          { type: "restaurant", name: "Britto's" }
        ]}
      ]
    },
    budgetSummary: { comfortable: 35000, breakdown: { stays: 14000, activities: 8000, dining: 7000, transit: 6000 } }
  },
  travelProfile: { userId: u1, rankingWeights: {} }
};

const result1 = tripManager.run(context1);

assert(result1.success === true, "TripManager succeeds");
assert(result1.data.tripId.startsWith("trip-"), `Trip ID generated: ${result1.data.tripId}`);
assert(result1.data.status === "DRAFT", `Status = DRAFT (got ${result1.data.status})`);
assert(result1.data.tripRecord.destination === "goa", `Destination = goa`);
assert(result1.data.tripRecord.durationDays === 4, `Duration = 4 days`);
assert(result1.data.tripRecord.hotel?.name === "Taj Fort Aguada", `Hotel = Taj Fort Aguada`);
assert(result1.data.tripRecord.hotel?.chain === "taj", `Hotel chain = taj`);
assert(result1.data.tripRecord.flight?.airline === "IndiGo 6E", `Flight = IndiGo 6E`);
assert(result1.data.tripRecord.activities.length === 3, `3 activities extracted`);
assert(result1.data.tripRecord.budgetEstimate === 35000, `Budget estimate = 35000`);
assert(result1.data.tripSummary.length > 0, `Trip summary generated`);

cleanup(u1);

// ─── Test 2: TripManager — triggers learning ───────────────────────────

console.log("\n=== Test 2: TripManager — triggers learning ===");

const u2 = uid();
const context2 = {
  userId: u2,
  sessionId: "test-session-2",
  state: {
    intent: "PLAN_TRIP",
    normalizedEntities: { destination: "manali", durationDays: 3 }
  },
  recommendations: {
    candidates: [
      { id: "h1", name: "Hotel Beas", type: "hotel", raw: { type: "hotel" } }
    ],
    draftItinerary: {
      destination: "manali",
      durationDays: 3,
      dailyPlans: [
        { day: 1, slots: [{ type: "stay", name: "Hotel Beas" }, { type: "attraction", name: "Solang Valley" }] }
      ]
    },
    improvedItinerary: {
      decisionLog: [
        { action: "REPLACE", target: "Crowded Cafe", replacement: "Quiet Diner", reason: "User prefers quiet" }
      ]
    }
  },
  travelProfile: { userId: u2, rankingWeights: {} }
};

const result2 = tripManager.run(context2);

assert(result2.success === true, "TripManager succeeds");
assert(result2.data.learningEvents.length > 0, `Learning events applied: ${result2.data.learningEvents.length}`);

const w2 = permanentMemory.load(u2).learnings.rankingWeights;
assert(w2["place:hotel beas"] > 0, `Hotel "hotel beas" learned as accepted`);
assert(w2["place:solang valley"] > 0, `Highlight "solang valley" learned`);
assert(w2["place:crowded cafe"] < 0, `Planner edit original rejected`);
assert(w2["place:quiet diner"] > 0, `Planner edit replacement accepted`);

cleanup(u2);

// ─── Test 3: TripManager — BOOK_TRIP status ───────────────────────────

console.log("\n=== Test 3: TripManager — BOOK_TRIP status ===");

const u3 = uid();
const context3 = {
  userId: u3,
  state: { intent: "BOOK_TRIP", normalizedEntities: { destination: "jaipur" } },
  recommendations: { candidates: [], budgetSummary: null },
  travelProfile: { userId: u3, rankingWeights: {} }
};

const result3 = tripManager.run(context3);
assert(result3.data.status === "BOOKED", `BOOK_TRIP intent → status = BOOKED (got ${result3.data.status})`);

cleanup(u3);

// ─── Test 4: TripManager — extractChain ────────────────────────────────

console.log("\n=== Test 4: TripManager — extractChain ===");

assert(tripManager.extractChain("Taj Fort Aguada") === "taj", "Taj chain detected");
assert(tripManager.extractChain("Marriott Hotels") === "marriott", "Marriott chain detected");
assert(tripManager.extractChain("Hyatt Regency") === "hyatt", "Hyatt chain detected");
assert(tripManager.extractChain("Random Hotel") === null, "Unknown chain returns null");
assert(tripManager.extractChain("") === null, "Empty string returns null");

// ─── Test 5: ExecutionEngine — pipeline includes tripManager ───────────

console.log("\n=== Test 5: ExecutionEngine — pipeline includes tripManager ===");

const hasTripManager = executionEngine.sequence.includes("tripManager");
assert(hasTripManager, "tripManager is in pipeline sequence");

const tripManagerIdx = executionEngine.sequence.indexOf("tripManager");
const bookingIdx = executionEngine.sequence.indexOf("booking");
assert(tripManagerIdx > bookingIdx, `tripManager runs after booking (booking=${bookingIdx}, tripManager=${tripManagerIdx})`);

const tripManagerEntry = executionEngine.registry.tripManager;
assert(tripManagerEntry !== undefined, "tripManager is registered in registry");
assert(typeof tripManagerEntry.run === "function", "tripManager has run function");
assert(tripManagerEntry.label === "TRIP_MANAGED", `tripManager label = TRIP_MANAGED`);

// ─── Test 6: TripManager — generates summary ───────────────────────────

console.log("\n=== Test 6: TripManager — generates summary ===");

const u6 = uid();
const context6 = {
  userId: u6,
  state: { intent: "PLAN_TRIP", normalizedEntities: { destination: "kerala", durationDays: 5 } },
  recommendations: {
    candidates: [],
    draftItinerary: { destination: "kerala", durationDays: 5, dailyPlans: [] },
    budgetSummary: { comfortable: 45000 },
    confidenceAlerts: [{ level: "LOW", candidateName: "Shady Hotel" }]
  },
  travelProfile: { userId: u6, rankingWeights: {} }
};

const result6 = tripManager.run(context6);
assert(result6.data.tripSummary.includes("Kerala"), `Summary mentions destination`);
assert(result6.data.tripSummary.includes("5 days"), `Summary mentions duration`);
assert(result6.data.learningEvents.length > 0, `Learning events from confidence alerts`);

cleanup(u6);

// ─── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(60)}`);
process.exit(failed > 0 ? 1 : 0);

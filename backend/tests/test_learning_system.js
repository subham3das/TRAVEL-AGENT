/**
 * Learning System — End-to-End Test
 *
 * Tests:
 * 1. TripLearner — extracts events from completed trip data
 * 2. Weight decay — prevents unbounded growth
 * 3. Expanded event types — budget, planner edit
 * 4. LearningEngine — getBoost with accumulated weights
 * 5. TripLearner — learnFromFeedback
 * 6. TripLearner — learnFromPlannerEdits
 * 7. TripLearner — learnFromSkippedActivities
 * 8. Batch learning
 * 9. LearningEngine — learn() method
 */

"use strict";

const tripLearner = require("../learning/trip_learner");
const learningEngine = require("../learning/learning_engine");
const memoryManager = require("../memory/memory_manager");
const permanentMemory = require("../memory/permanent_memory");

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

function uid() { return "test-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6); }
function cleanup(id) { try { permanentMemory.forgetAll(id); } catch (e) {} }
function weights(id) { return permanentMemory.load(id).learnings.rankingWeights; }

// ─── Test 1: TripLearner — learns from completed trip ───────────────────

console.log("\n=== Test 1: TripLearner — learns from completed trip ===");

const u1 = uid();
const profile1 = { userId: u1, rankingWeights: {} };
const tripRecord = {
  hotel: { name: "Taj Fort Aguada", chain: "taj", rating: 4.7 },
  highlights: ["beach", "fort aguada", "sunsets"],
  dislikes: ["crowded markets", "loud clubs"],
  spend: 35000, budgetEstimate: 30000,
  transport: { mode: "scooter" },
  tags: ["beach", "heritage", "romantic"],
  wouldReturn: true, destination: "goa"
};

const applied = tripLearner.learnFromTrip(u1, tripRecord, profile1);
const w1 = weights(u1);

assert(applied.length > 0, `Applied ${applied.length} learning events`);
assert(w1["place:taj fort aguada"] > 0, `Hotel accepted (weight: ${w1["place:taj fort aguada"]})`);
assert(w1["chain:taj"] > 0, `Chain "taj" accepted (weight: ${w1["chain:taj"]})`);
assert(w1["place:beach"] > 0, `Highlight "beach" accepted`);
assert(w1["place:fort aguada"] > 0, `Highlight "fort aguada" accepted`);
assert(w1["place:crowded markets"] < 0, `Dislike "crowded markets" rejected`);
assert(w1["place:loud clubs"] < 0, `Dislike "loud clubs" rejected`);
assert(w1["category:goa"] > 0, `Destination "goa" added as category`);
assert(w1["category:transport:scooter"] > 0, `Transport mode learned`);
assert(w1["category:beach"] > 0, `Tag "beach" added as category`);
assert(w1["category:heritage"] > 0, `Tag "heritage" added as category`);
cleanup(u1);

// ─── Test 2: Weight Decay — prevents unbounded growth ───────────────────

console.log("\n=== Test 2: Weight Decay — prevents unbounded growth ===");

const u2 = uid();

// Set initial weight
permanentMemory.adjustWeight(u2, "chain:marriott", 40);
const w2a = weights(u2);
assert(w2a["chain:marriott"] === 40, `Initial weight = 40 (got ${w2a["chain:marriott"]})`);

// Adjust again — decay 40 * 0.95 = 38, then +15 = 53
permanentMemory.adjustWeight(u2, "chain:marriott", 15);
const w2b = weights(u2);
assert(w2b["chain:marriott"] === 53, `After decay+add: 40*0.95+15=53 (got ${w2b["chain:marriott"]})`);

// Push over 100 — should clamp
permanentMemory.adjustWeight(u2, "chain:marriott", 80);
const w2c = weights(u2);
assert(w2c["chain:marriott"] === 100, `Clamped at 100 (got ${w2c["chain:marriott"]})`);

// Negative clamp
permanentMemory.adjustWeight(u2, "chain:marriott", -300);
const w2d = weights(u2);
assert(w2d["chain:marriott"] === -100, `Clamped at -100 (got ${w2d["chain:marriott"]})`);

cleanup(u2);

// ─── Test 3: Expanded Event Types ──────────────────────────────────────

console.log("\n=== Test 3: Expanded Event Types ===");

const u3 = uid();
assert(memoryManager.learn(u3, "BUDGET_OVERSPENT", "45000") === true, "BUDGET_OVERSPENT accepted");
assert(memoryManager.learn(u3, "BUDGET_UNDERSPENT", "12000") === true, "BUDGET_UNDERSPENT accepted");
assert(memoryManager.learn(u3, "PLANNER_EDIT", "swapped beach") === true, "PLANNER_EDIT accepted");
assert(memoryManager.learn(u3, "UNKNOWN_EVENT", "test") === false, "Unknown event rejected");

const w3 = weights(u3);
assert(w3["budget:overspent"] < 0, `BUDGET_OVERSPENT weight negative (${w3["budget:overspent"]})`);
assert(w3["budget:underspent"] > 0, `BUDGET_UNDERSPENT weight positive (${w3["budget:underspent"]})`);
assert(w3["preference:edited"] > 0, `PLANNER_EDIT weight positive (${w3["preference:edited"]})`);
cleanup(u3);

// ─── Test 4: LearningEngine — getBoost ──────────────────────────────────

console.log("\n=== Test 4: LearningEngine — getBoost ===");

const u4 = uid();
memoryManager.learn(u4, "ACCEPT_HOTEL_CHAIN", "taj");
memoryManager.learn(u4, "ACCEPT_PLACE", "goa beach");
memoryManager.learn(u4, "REJECT_AIRLINE", "indigo");
memoryManager.learn(u4, "ADD_PLACE_CATEGORY", "heritage");

const profile4 = { userId: u4, rankingWeights: weights(u4) };

const tajBoost = learningEngine.getBoost(profile4, { id: "x", name: "Taj Hotel", type: "hotel" });
assert(tajBoost > 0, `Taj hotel gets positive boost (${tajBoost})`);

const indigoBoost = learningEngine.getBoost(profile4, { id: "x", name: "IndiGo 6E", type: "flight", airline: "indigo" });
assert(indigoBoost < 0, `IndiGo gets negative boost (${indigoBoost})`);

const heritageBoost = learningEngine.getBoost(profile4, { id: "x", name: "Heritage Museum", type: "attraction", category: "heritage" });
assert(heritageBoost > 0, `Heritage category gets positive boost (${heritageBoost})`);

const unknownBoost = learningEngine.getBoost(profile4, { id: "x", name: "Random Hotel", type: "hotel" });
assert(unknownBoost === 0, `Unknown hotel gets zero boost (${unknownBoost})`);

cleanup(u4);

// ─── Test 5: TripLearner — learnFromFeedback ───────────────────────────

console.log("\n=== Test 5: TripLearner — learnFromFeedback ===");

const u5 = uid();
const p5 = { userId: u5, rankingWeights: {} };

assert(tripLearner.learnFromFeedback(u5, { itemType: "hotel", itemName: "Oberoi", action: "accept" }, p5) === true, "Accept hotel");
assert(tripLearner.learnFromFeedback(u5, { itemType: "flight", itemName: "SpiceJet", action: "reject" }, p5) === true, "Reject flight");
assert(tripLearner.learnFromFeedback(u5, { itemType: "attraction", itemName: "City Museum", action: "skip" }, p5) === true, "Skip attraction");
assert(tripLearner.learnFromFeedback(u5, { itemType: "restaurant", itemName: "Cafe COCO", action: "accept" }, p5) === true, "Accept restaurant");
assert(tripLearner.learnFromFeedback(u5, {}, p5) === false, "Missing data returns false");

const w5 = weights(u5);
assert(w5["chain:oberoi"] > 0, `Oberoi chain accepted`);
assert(w5["airline:spicejet"] < 0, `SpiceJet rejected`);
assert(w5["place:city museum"] < 0, `City Museum rejected`);
assert(w5["category:cafe coco"] > 0, `Cafe COCO category added`);
cleanup(u5);

// ─── Test 6: TripLearner — learnFromPlannerEdits ───────────────────────

console.log("\n=== Test 6: TripLearner — learnFromPlannerEdits ===");

const u6 = uid();
const p6 = { userId: u6, rankingWeights: {} };

const edits = [
  { original: "Crowded Beach", replacement: "Quiet Fort" },
  { original: "Fast Food", replacement: "Local Thali" }
];

const editApplied = tripLearner.learnFromPlannerEdits(u6, edits, p6);
assert(editApplied.length === 4, `Applied ${editApplied.length} planner edit events`);

const w6 = weights(u6);
assert(w6["place:crowded beach"] < 0, `Original rejected`);
assert(w6["place:quiet fort"] > 0, `Replacement accepted`);
assert(w6["place:fast food"] < 0, `Original 2 rejected`);
assert(w6["place:local thali"] > 0, `Replacement 2 accepted`);
cleanup(u6);

// ─── Test 7: TripLearner — learnFromSkippedActivities ──────────────────

console.log("\n=== Test 7: TripLearner — learnFromSkippedActivities ===");

const u7 = uid();
const p7 = { userId: u7, rankingWeights: {} };

const skipped = tripLearner.learnFromSkippedActivities(u7, ["Water Park", "Shopping Mall"], p7);
assert(skipped.length === 2, `Applied ${skipped.length} skip events`);

const w7 = weights(u7);
assert(w7["place:water park"] < 0, `"Water Park" rejected`);
assert(w7["place:shopping mall"] < 0, `"Shopping Mall" rejected`);
cleanup(u7);

// ─── Test 8: Batch Learning ────────────────────────────────────────────

console.log("\n=== Test 8: Batch Learning ===");

const u8 = uid();
const p8 = { userId: u8, rankingWeights: {} };

const batchResult = tripLearner.learnBatch(u8, [
  { itemType: "restaurant", itemName: "Cafe COCO", action: "accept" },
  { itemType: "hotel", itemName: "Budget Inn", action: "reject" },
  { itemType: "attraction", itemName: "Night Market", action: "skip" }
], p8);

assert(batchResult.applied === 3, `Batch applied ${batchResult.applied} events`);
assert(batchResult.events.length === 3, `Batch returned ${batchResult.events.length} events`);
cleanup(u8);

// ─── Test 9: LearningEngine — learn() method ───────────────────────────

console.log("\n=== Test 9: LearningEngine — learn() method ===");

const u9 = uid();
const p9 = { userId: u9, rankingWeights: {} };

const updatedWeights = learningEngine.learn(u9, { type: "ACCEPT_PLACE", value: "goa beach" }, p9);
assert(typeof updatedWeights === "object", "learn() returns weights object");
assert(updatedWeights["place:goa beach"] > 0, `learn() persisted acceptance`);
cleanup(u9);

// ─── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(60)}`);
process.exit(failed > 0 ? 1 : 0);

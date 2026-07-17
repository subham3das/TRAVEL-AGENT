/**
 * Travel OS — Phase 5: Learning Engine Verification Test
 *
 * Verifies:
 * 1. Learning Engine deterministic weights calculations.
 * 2. Profile ranking weights persistence.
 * 3. Ranking Engine dynamic re-ordering of candidates based on weights.
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const learningEngine = require("../learning/learning_engine");
const rankingEngine = require("../search/ranking_engine");
const travelProfileManager = require("../memory/travel_profile_manager");

async function runTests() {
  console.log("=== STARTING PHASE 5 LEARNING ENGINE TESTS ===");

  const userId = `learn-user-${Date.now()}`;
  const profile = travelProfileManager.load(userId);

  // 1. Verify REJECT_AIRLINE event penalty
  learningEngine.learn(userId, { type: "REJECT_AIRLINE", value: "IndiGo" }, profile);
  assert.strictEqual(profile.rankingWeights["airline:indigo"], -30, "IndiGo should have -30 penalty.");

  // 2. Verify ACCEPT_HOTEL_CHAIN event boost
  learningEngine.learn(userId, { type: "ACCEPT_HOTEL_CHAIN", value: "Taj" }, profile);
  assert.strictEqual(profile.rankingWeights["chain:taj"], 20, "Taj chain should have +20 boost.");

  // 3. Verify rank re-ordering based on boosts
  const hotelResults = [
    {
      id: "hotel-marriott",
      type: "hotel",
      name: "Goa Marriott Resort",
      confidence: { score: 0.90 }
    },
    {
      id: "hotel-taj",
      type: "hotel",
      name: "Taj Exotica Goa",
      confidence: { score: 0.85 } // lower base confidence
    }
  ];

  // Without profile, ordering stays Marriott (0.90) > Taj (0.85)
  const unranked = rankingEngine.rank(hotelResults, null);
  assert.strictEqual(unranked[0].id, "hotel-marriott", "Default order should prioritize higher confidence.");

  // With profile, Taj (+20 / 100 = +0.20 boost) should win: 0.85 + 0.20 = 1.05 (capped at 1.0),
  // while Marriott stays at 0.90. Taj wins!
  const ranked = rankingEngine.rank(hotelResults, profile);
  assert.strictEqual(ranked[0].id, "hotel-taj", "Taj should be boosted to the top rank position.");
  assert.strictEqual(ranked[0]._rankingScore, 1.0, "Taj ranking score should be capped at 1.0.");
  
  console.log("✓ Ranking engine re-ordering passed. (Taj hotel successfully boosted)");

  // 4. Verify Airline penalty demotes flights
  const flightResults = [
    {
      id: "flight-indigo",
      type: "flight",
      airline: "IndiGo",
      confidence: { score: 0.95 }
    },
    {
      id: "flight-airindia",
      type: "flight",
      airline: "Air India",
      confidence: { score: 0.90 }
    }
  ];

  // IndiGo gets -30 / 100 = -0.30 penalty -> final score: 0.95 - 0.30 = 0.65.
  // Air India stays at 0.90. Air India wins!
  const rankedFlights = rankingEngine.rank(flightResults, profile);
  assert.strictEqual(rankedFlights[0].id, "flight-airindia", "Air India should rank first due to IndiGo penalty.");
  console.log("✓ Flight ranking penalty passed. (IndiGo flight successfully demoted)");

  // Cleanup profile file
  const expectedPath = path.resolve(__dirname, "..", "data", "profiles", `${userId}.json`);
  if (fs.existsSync(expectedPath)) {
    fs.unlinkSync(expectedPath);
  }

  console.log("=== ALL LEARNING ENGINE TESTS PASSED ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

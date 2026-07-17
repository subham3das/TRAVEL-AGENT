/**
 * Travel OS — Phase 4 Memory / Travel Profile Verification Test
 *
 * Verifies:
 * 1. Persistent loading & saving of TravelProfile (JSON data persistence).
 * 2. Fallback to dynamic defaults for clean profiles.
 * 3. Pipeline stage execution and context population.
 * 4. EventBus MEMORY_LOADED emission.
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const memoryStage = require("../memory/memory_stage");
const travelProfileManager = require("../memory/travel_profile_manager");
const eventBus = require("../events/event_bus");

// Event collector
const eventsList = [];
eventBus.on("session:test-session", (event) => {
  eventsList.push(event.type);
});

async function runTests() {
  console.log("=== STARTING PHASE 4 MEMORY STAGE TESTS ===");

  const userId = `test-user-${Date.now()}`;
  const sessionId = "test-session";

  // 1. Initial Load (should return default profile)
  const profile = travelProfileManager.load(userId);
  assert.strictEqual(profile.userId, userId, "Profile should match loaded user ID.");
  assert.strictEqual(profile.travelStyle, "mid", "Default style should be 'mid'.");
  assert.ok(profile.preferredAirlines.includes("IndiGo"), "Default airlines should exist.");
  console.log("✓ Fallback default profile verified.");

  // 2. Modify and Save
  profile.travelStyle = "luxury";
  profile.preferredHotelChains = ["Ritz", "Oberoi"];
  
  const saveSuccess = travelProfileManager.save(profile);
  assert.strictEqual(saveSuccess, true, "Saving profile should succeed.");
  
  // Verify file was written to backend/data/profiles/{userId}.json
  const expectedPath = path.resolve(__dirname, "..", "data", "profiles", `${userId}.json`);
  assert.strictEqual(fs.existsSync(expectedPath), true, "Profile JSON file should exist on disk.");
  console.log("✓ Profile persisted to disk successfully.");

  // 3. Reload and Check Values
  const reloaded = travelProfileManager.load(userId);
  assert.strictEqual(reloaded.travelStyle, "luxury", "Persisted travel style should be 'luxury'.");
  assert.deepStrictEqual(reloaded.preferredHotelChains, ["Ritz", "Oberoi"], "Hotel chains list should match Oberoi.");
  console.log("✓ Profile loaded and verified from disk.");

  // 4. Pipeline stage run
  const context = {
    userId,
    sessionId,
    state: {}
  };

  const response = memoryStage.run(context);
  assert.strictEqual(response.success, true, "Memory stage should run successfully.");
  assert.strictEqual(context.travelProfile.travelStyle, "luxury", "Travel profile should be populated on context.");
  assert.strictEqual(context.user.preferences.travelStyle, "luxury", "Preferences should be attached to context.user.");
  console.log("✓ Context preferences population verified.");

  // 5. EventBus emission check
  assert.ok(eventsList.includes("MEMORY_LOADED"), "EventBus should have emitted MEMORY_LOADED");
  console.log("✓ EventBus integration passed.");

  // Cleanup file
  if (fs.existsSync(expectedPath)) {
    fs.unlinkSync(expectedPath);
  }

  console.log("=== ALL MEMORY / TRAVEL PROFILE TESTS PASSED ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

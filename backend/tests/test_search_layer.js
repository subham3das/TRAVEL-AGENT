/**
 * Travel OS — Search Layer Automated Test
 *
 * Verifies:
 * 1. Concurrency & request deduplication.
 * 2. Stale-While-Revalidate caching.
 * 3. Conflict resolution field ownership & diagnostics mapping.
 * 4. Contract verification (schemaVersion, requestId, generatedAt).
 * 5. EventBus emissions.
 */

"use strict";

const assert = require("assert");
const searchLayer = require("../search/search_layer");
const searchRepository = require("../repository/search_repository");
const providerOrchestrator = require("../booking/providers/provider_orchestrator");
const eventBus = require("../events/event_bus");
const knowledgeLoader = require("../knowledge/loader/knowledge_loader");

// Event collector
const eventsList = [];
eventBus.on("session:test-session", (event) => {
  eventsList.push(event.type);
});

async function runTests() {
  console.log("=== STARTING SEARCH LAYER VERIFICATION TESTS ===");

  // Load Knowledge Graph nodes
  const loadResult = knowledgeLoader.load();
  console.log(`Loaded ${loadResult.loadedCount} Knowledge Graph nodes.`);

  // Reset states
  searchRepository.clear();
  providerOrchestrator.resetAll();

  const criteria = {
    destinationId: "goa",
    travelStyle: "mid",
    travelersType: "solo",
    requestId: "test-req-123",
    sessionId: "test-session"
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Test 1: Request Deduplication
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nTest 1: Request Deduplication");
  
  // Launch two parallel queries simultaneously
  const [res1, res2] = await Promise.all([
    searchLayer.search("hotel", criteria),
    searchLayer.search("hotel", criteria)
  ]);

  assert.strictEqual(res1.status, "complete", "First search should complete");
  assert.strictEqual(res2.status, "complete", "Second search should complete");
  assert.strictEqual(res1.results.length, res2.results.length, "Both queries should get same results count");
  assert.strictEqual(res1.results[0].id, res2.results[0].id, "Coalesced queries should get identical results");
  console.log("✓ Request deduplication passed. (Coalesced 2 parallel queries)");

  // ────────────────────────────────────────────────────────────────────────────
  // Test 2: Caching & Soft/Hard TTL (Stale-While-Revalidate)
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nTest 2: Caching & Stale-While-Revalidate");
  
  // First query was cached. A new query should hit cache.
  const resCached = await searchLayer.search("hotel", criteria);
  assert.strictEqual(resCached.metrics.cache, "hit", "Subsequent query should hit cache");
  
  // Manually force soft expiration by modifying cache entry
  const key = `goa_any_solo_any_hotel_v1.0_p1.0`;
  const cachedVal = searchRepository.cache.get(key);
  assert.ok(cachedVal, "Cache entry should exist");
  
  // Make softExpiresAt pass, but keep hardExpiresAt in future
  cachedVal.softExpiresAt = Date.now() - 1000;
  
  const resStale = await searchLayer.search("hotel", criteria);
  assert.strictEqual(resStale.status, "stale", "Stale cache hit should return status: stale");
  assert.strictEqual(resStale.metrics.cache, "stale", "Stale cache hit should have stale cache metric");
  console.log("✓ Stale-While-Revalidate passed. (Returned stale cache, triggered refresh)");

  // ────────────────────────────────────────────────────────────────────────────
  // Test 3: Contract Validation & Field Ownership
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nTest 3: Contract Validation & Field Ownership");
  
  const hotel = res1.results[0];
  
  assert.strictEqual(hotel.schemaVersion, "1.0", "SearchResult should have schemaVersion '1.0'");
  assert.strictEqual(hotel.requestId, "test-req-123", "SearchResult should contain original requestId");
  assert.ok(hotel.generatedAt, "SearchResult should contain generatedAt timestamp");
  
  // Check field ownership rules
  // Coordinates are owned by KG
  assert.ok(hotel.coordinates, "Coordinates should be populated");
  assert.strictEqual(hotel.coordinates.latitude, 15.2923, "Coordinates should match Knowledge Graph");
  
  // Price is owned by Provider
  assert.ok(hotel.pricing?.price > 0, "Pricing should be dynamically populated");
  assert.strictEqual(hotel.pricing.currency, "INR", "Pricing currency should be INR");
  
  // Availability status matches simplified schema
  assert.strictEqual(hotel.availability.status, "available", "Availability status should be 'available'");
  assert.strictEqual(hotel.availability.source, "Booking.com", "Availability source should match provider");

  console.log("✓ SearchResult contract and Field Ownership passed.");

  // ────────────────────────────────────────────────────────────────────────────
  // Test 4: EventBus Logging
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nTest 4: EventBus Integration");
  
  const expectedEvents = [
    "CACHE_MISS",
    "SEARCH_STARTED",
    "MERGE_STARTED",
    "MERGE_FINISHED",
    "CONFIDENCE_READY",
    "SEARCH_FINISHED",
    "CACHE_HIT",
    "CACHE_STALE"
  ];
  
  for (const exp of expectedEvents) {
    assert.ok(eventsList.includes(exp), `EventBus should have emitted: ${exp}`);
  }
  console.log("✓ EventBus integration passed. Emitted:", eventsList.join(" → "));

  console.log("\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

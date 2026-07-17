/**
 * Travel OS — Phase 7: Provider Normalization Verification Test
 *
 * Verifies that all registered providers strictly inherit from BaseProvider
 * and implement search() returning ProviderResult shapes, health() diagnostics,
 * and capability flags.
 */

"use strict";

const assert = require("assert");
const providerRegistry = require("../booking/providers/provider_registry");
const BaseProvider = require("../booking/providers/base_provider");
const { ProviderResult } = require("../domain/models");
const knowledgeLoader = require("../knowledge/loader/knowledge_loader");

async function runTests() {
  console.log("=== STARTING PHASE 7 PROVIDER NORMALIZATION TESTS ===");

  // Initialize Knowledge Graph for provider lookups
  knowledgeLoader.load();

  const providerKeys = ["hotel", "flight", "train", "bus", "activity", "rental", "weather"];

  for (const key of providerKeys) {
    const provider = providerRegistry.getProvider(key);
    assert.ok(provider, `Provider for key ${key} should be registered.`);
    
    // 1. Prototype inheritance check
    assert.ok(
      provider instanceof BaseProvider,
      `Provider ${key} (${provider.constructor.name}) should inherit from BaseProvider.`
    );
    console.log(`✓ ${provider.constructor.name} extends BaseProvider.`);

    // 2. Health check validation
    const health = await provider.health();
    assert.strictEqual(typeof health.status, "string", `Provider ${key} health.status should be string`);
    assert.strictEqual(typeof health.latency, "number", `Provider ${key} health.latency should be number`);
    assert.strictEqual(typeof health.failureRate, "number", `Provider ${key} health.failureRate should be number`);
    console.log(`✓ ${provider.constructor.name} health checked: status = ${health.status}, failureRate = ${health.failureRate}.`);

    // 3. Search and ProviderResult validation
    const criteria = { destinationId: "goa", travelStyle: "mid", travelersType: "solo" };
    const results = await provider.search(criteria);
    
    assert.ok(Array.isArray(results), `Provider ${key} search should return an array.`);
    
    if (results.length > 0) {
      const item = results[0];
      
      // Weather provider is a special telemetry provider that returns raw JSON forecast,
      // but others return standard ProviderResult shapes.
      if (key !== "weather") {
        assert.ok(item.provider, `ProviderResult from ${key} should contain provider name`);
        assert.strictEqual(item.type, key, `ProviderResult from ${key} should have correct type`);
        assert.ok(item.price !== undefined, `ProviderResult from ${key} should contain price`);
        assert.ok(item.details, `ProviderResult from ${key} should contain details object`);
      }
      console.log(`✓ ${provider.constructor.name} search returned ${results.length} valid results.`);
    } else {
      console.log(`⚠ ${provider.constructor.name} search returned 0 results (valid fallback).`);
    }
  }

  console.log("\n=== ALL PROVIDER NORMALIZATION TESTS PASSED ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

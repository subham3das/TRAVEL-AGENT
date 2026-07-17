/**
 * Travel OS — Phase 8 Confidence Engine Verification Test
 *
 * Verifies that the Confidence Engine running as a pipeline stage
 * successfully enriches context recommendations with structured confidence metadata
 * and calculates the aggregate confidenceScore.
 */

"use strict";

const assert = require("assert");
const confidenceEngine = require("../confidence/confidence_engine");

async function runTests() {
  console.log("=== STARTING PHASE 8 CONFIDENCE PIPELINE TESTS ===");

  const context = {
    state: {
      normalizedEntities: {
        destination: "goa",
        travelStyle: "mid"
      }
    },
    recommendations: {
      candidates: [
        {
          id: "goa_attraction_1",
          name: "Baga Beach",
          type: "attraction",
          source: "knowledge_graph",
          description: "Stunning beach."
        },
        {
          id: "goa_hotel_1",
          name: "Goa Beach Resort",
          type: "hotel",
          source: "search_layer",
          description: "Comfortable resort.",
          pricing: { price: 5000 }
        }
      ]
    }
  };

  const response = confidenceEngine.run(context);

  assert.strictEqual(response.success, true, "Confidence run should succeed.");
  assert.ok(response.data, "Confidence run should return data envelope.");
  
  const enriched = response.data.candidates;
  assert.strictEqual(enriched.length, 2, "Should enrich exactly 2 candidates.");

  // First candidate (KG source)
  const c1 = enriched[0];
  assert.ok(c1.confidence, "First candidate should have confidence object.");
  assert.strictEqual(c1.confidence.score, 0.98, "KG source should get 0.98 score.");
  assert.ok(c1.confidence.reason.includes("canonical"), "KG reason should mention canonical.");

  // Second candidate (Search Layer source)
  const c2 = enriched[1];
  assert.ok(c2.confidence, "Second candidate should have confidence object.");
  assert.strictEqual(c2.confidence.score, 0.88, "Search Layer hotel source fallback should get 0.88.");
  
  // Aggregate confidenceScore
  const expectedAvg = Number(((0.98 + 0.88) / 2).toFixed(2));
  assert.strictEqual(response.data.confidenceScore, expectedAvg, "Aggregate confidenceScore should be correct average.");
  assert.strictEqual(context.recommendations.confidenceScore, expectedAvg, "Should persist confidenceScore to context.");

  console.log(`✓ Confidence run average score: ${response.data.confidenceScore}`);
  console.log("=== ALL CONFIDENCE ENGINE TESTS PASSED ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

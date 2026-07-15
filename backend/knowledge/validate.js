const service = require("./knowledge_service");
const cache = require("./cache/knowledge_cache");
const assert = require("assert").strict;

// ponytail: validate.js self-test validation runner
function validateResponseContract(response, queryDesc) {
  console.log(`Checking response contract for: ${queryDesc}`);
  assert.ok(response, "Response should be truthy");
  assert.strictEqual(typeof response.success, "boolean", "response.success must be boolean");
  assert.ok(Array.isArray(response.data), "response.data must be an array");
  assert.ok(Array.isArray(response.errors), "response.errors must be an array");
  assert.ok(Array.isArray(response.warnings), "response.warnings must be an array");
  assert.strictEqual(typeof response.confidence, "number", "response.confidence must be a number");
  assert.strictEqual(typeof response.processingTime, "number", "response.processingTime must be a number");
  assert.strictEqual(typeof response.metadata, "object", "response.metadata must be an object");
  console.log("  => Contract valid!");
}

async function run() {
  console.log("=== TRAVEL KNOWLEDGE GRAPH VALIDATION ===");

  // 1. Load Knowledge & validate schemas + referential integrity
  console.log("\nLoading knowledge...");
  const loadResult = service.loadKnowledge();
  console.log("Load result:", loadResult);
  assert.ok(loadResult.success, "Knowledge Graph loading and schema validation failed!");
  assert.ok(loadResult.loadedCount >= 6, "Expected at least 6 nodes to load");
  console.log("  => Knowledge loaded successfully!");

  // 2. Validate cache operations
  console.log("\nTesting Cache GetNode...");
  const baga = service.getNode("goa_attraction_baga_beach");
  assert.ok(baga, "Could not retrieve Baga Beach from cache");
  assert.strictEqual(baga.name, "Baga Beach");
  assert.strictEqual(baga.type, "attraction");
  console.log("  => Cache operations verified!");

  // 3. Test queries and validate response contracts
  console.log("\nRunning Query: Destinations in Goa");
  const q1 = service.query({ type: "destination", destinationId: "goa" });
  validateResponseContract(q1, "destination query");
  assert.strictEqual(q1.data.length, 1, "Should return exactly 1 destination for goa");
  assert.strictEqual(q1.data[0].id, "goa");

  console.log("\nRunning Query: Baga Beach Attraction by destination + tags");
  const q2 = service.query({
    type: "attraction",
    destinationId: "goa",
    tags: ["sunset", "beach"]
  });
  validateResponseContract(q2, "attraction tags query");
  assert.ok(q2.data.length >= 1, "Should find matching attractions by tags");
  assert.ok(q2.data.some(d => d.id === "goa_attraction_baga_beach"), "Should contain Baga Beach in results");

  console.log("\nRunning Query: Family friendly attractions with min score");
  const q3 = service.query({
    type: "attraction",
    accessibility: ["familyFriendly"],
    minPlannerScore: { family: 85 }
  });
  validateResponseContract(q3, "attraction accessibility query");
  assert.ok(q3.data.length >= 1, "Should find family friendly attractions");

  console.log("\nRunning Query: Restaurants in Goa under mid budget");
  const q4 = service.query({
    type: "restaurant",
    destinationId: "goa",
    budgetCategory: "mid"
  });
  validateResponseContract(q4, "restaurant budget query");
  assert.ok(q4.data.length >= 1, "Should find Britannia Beach Shack");
  const hasBritannia = q4.data.some(r => r.id === "goa_restaurant_britannia");
  assert.ok(hasBritannia, "Should contain Britannia Beach Shack in mid budget restaurants");

  console.log("\nRunning Query: Rule by category");
  const q5 = service.query({
    type: "rule",
    destinationId: "goa",
    category: "Local Regulations"
  });
  validateResponseContract(q5, "rule category query");
  assert.strictEqual(q5.data.length, 1, "Should find Goa Local Tourist Regulations");
  assert.strictEqual(q5.data[0].id, "goa_rule_tourist");

  console.log("\n=== ALL TESTS PASSED SUCCESSFULLY ===");
}

run().catch(err => {
  console.error("\n!!! VALIDATION FAILED !!!");
  console.error(err);
  process.exit(1);
});

const assert = require("assert").strict;
const memoryEngine = require("../memory/memory_engine");

function createMockRecord(userId = "user-1", category = "Travel Style", type = "LongTerm", value = "budget", extras = {}) {
  return {
    userId,
    category,
    type,
    value,
    confidence: 0.9,
    importance: 3,
    source: "implicit_extraction",
    expiresAt: null,
    metadata: {},
    ...extras
  };
}

async function testStoreAndRetrieve() {
  console.log("Running Test: Store and Retrieve Memory...");
  const record = createMockRecord("usr-123", "Travel Style", "LongTerm", "luxury");
  
  const storeRes = memoryEngine.storeMemory(record);
  assert.ok(storeRes.success);
  assert.ok(storeRes.data.memoryId);
  assert.strictEqual(storeRes.data.value, "luxury");

  const retrieveRes = memoryEngine.retrieveMemory("usr-123", "Travel Style");
  assert.ok(retrieveRes.success);
  assert.strictEqual(retrieveRes.data.length, 1);
  assert.strictEqual(retrieveRes.data[0].value, "luxury");
  console.log("  => Store and Retrieve passed!");
}

async function testUpdateAndVersioning() {
  console.log("Running Test: Update and Versioning...");
  const record = createMockRecord("usr-123", "Budget Preferences", "LongTerm", 10000);
  const storeRes = memoryEngine.storeMemory(record);
  const memId = storeRes.data.memoryId;

  // Perform updates
  const updateRes = memoryEngine.updateMemory(memId, { value: 15000 });
  assert.ok(updateRes.success);
  assert.strictEqual(updateRes.data.value, 15000);
  assert.strictEqual(updateRes.data.version, 2, "Version must increment to 2");
  console.log("  => Update and Versioning passed!");
}

async function testMergeMemory() {
  console.log("Running Test: Merge Memory...");
  const r1 = createMockRecord("usr-merger", "Travel Preferences", "LongTerm", ["hiking", "beaches"]);
  const store1 = memoryEngine.storeMemory(r1);

  const r2 = createMockRecord("usr-merger", "Travel Preferences", "LongTerm", ["museums", "beaches"]);
  const mergeRes = memoryEngine.mergeMemory(r2);

  assert.ok(mergeRes.success);
  // Merged value should be unique tags: ["hiking", "beaches", "museums"]
  assert.strictEqual(mergeRes.data.value.length, 3);
  assert.ok(mergeRes.data.value.includes("hiking"));
  assert.ok(mergeRes.data.value.includes("museums"));
  assert.ok(mergeRes.data.value.includes("beaches"));
  console.log("  => Merge Memory passed!");
}

async function testExpirationAndArchive() {
  console.log("Running Test: Expiration and Archive...");
  // Record set to expire in past
  const past = new Date(Date.now() - 10000).toISOString();
  const r = createMockRecord("usr-123", "Food", "Session", "seafood", { expiresAt: past });
  const storeRes = memoryEngine.storeMemory(r);
  const memId = storeRes.data.memoryId;

  // Retrieve will run auto-expiration checks
  const res = memoryEngine.retrieveMemory("usr-123", "Food");
  assert.ok(res.success);
  assert.strictEqual(res.data.length, 0, "Expired records must not be returned in standard queries");

  // Validate it was archived in internal store
  const raw = memoryEngine.store.get(memId);
  assert.strictEqual(raw.type, "Archived", "Expired records should transition to Archived type");
  console.log("  => Expiration and Archive passed!");
}

async function testSessionClearing() {
  console.log("Running Test: Session Clearing...");
  const r1 = createMockRecord("usr-session", "Travel Style", "Session", "luxury");
  const r2 = createMockRecord("usr-session", "Airline", "LongTerm", "Air India");

  memoryEngine.storeMemory(r1);
  memoryEngine.storeMemory(r2);

  const clearRes = memoryEngine.clearSessionMemory("usr-session");
  assert.ok(clearRes.success);
  assert.strictEqual(clearRes.data.clearedCount, 1);

  // Airline (LongTerm) should remain
  const listRes = memoryEngine.listMemory("usr-session");
  assert.strictEqual(listRes.data.length, 1);
  assert.strictEqual(listRes.data[0].category, "Airline");
  console.log("  => Session Clearing passed!");
}

async function testRetrievalRanking() {
  console.log("Running Test: Retrieval Ranking...");
  // Store three records in same category with different importance/confidence
  const r1 = createMockRecord("usr-ranked", "Transport", "LongTerm", "bus", { importance: 2, confidence: 0.9 });
  const r2 = createMockRecord("usr-ranked", "Transport", "LongTerm", "flight", { importance: 5, confidence: 0.95 });
  const r3 = createMockRecord("usr-ranked", "Transport", "LongTerm", "train", { importance: 5, confidence: 0.8 });

  memoryEngine.storeMemory(r1);
  memoryEngine.storeMemory(r2);
  memoryEngine.storeMemory(r3);

  const res = memoryEngine.retrieveMemory("usr-ranked", "Transport");
  assert.ok(res.success);
  // Sorting: importance descending, confidence descending
  // Expected order: flight (imp 5, conf 0.95) -> train (imp 5, conf 0.8) -> bus (imp 2, conf 0.9)
  assert.strictEqual(res.data[0].value, "flight");
  assert.strictEqual(res.data[1].value, "train");
  assert.strictEqual(res.data[2].value, "bus");
  console.log("  => Retrieval Ranking passed!");
}

async function testExportAndImport() {
  console.log("Running Test: Export and Import...");
  const r = createMockRecord("usr-exim", "Packing", "LongTerm", ["shoes", "jacket"]);
  memoryEngine.storeMemory(r);

  const expRes = memoryEngine.exportMemory("usr-exim");
  assert.ok(expRes.success);
  assert.strictEqual(expRes.data.length, 1);

  // Clear memory cache completely
  memoryEngine.store.clear();

  const impRes = memoryEngine.importMemory("usr-exim", expRes.data);
  assert.ok(impRes.success);
  assert.strictEqual(impRes.data.importedCount, 1);

  const verify = memoryEngine.retrieveMemory("usr-exim", "Packing");
  assert.strictEqual(verify.data[0].value[0], "shoes");
  console.log("  => Export and Import passed!");
}

async function runAll() {
  console.log("=== STARTING MEMORY ENGINE TESTS ===");
  await testStoreAndRetrieve();
  await testUpdateAndVersioning();
  await testMergeMemory();
  await testExpirationAndArchive();
  await testSessionClearing();
  await testRetrievalRanking();
  await testExportAndImport();
  console.log("\n=== ALL MEMORY ENGINE TESTS PASSED ===");
}

runAll().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

const assert = require("assert").strict;
const updater = require("../conversation/context_updater");

function createMockContext(entities = {}, totalCost = null) {
  const context = {
    state: {
      normalizedEntities: {
        destination: "goa",
        durationDays: 3,
        budget: 15000,
        travelStyle: "mid",
        ...entities
      }
    }
  };

  if (totalCost !== null) {
    context.recommendations = {
      budgetSummary: {
        totalBookingCost: totalCost
      }
    };
  }

  return context;
}

async function testSingleFieldUpdate() {
  console.log("Running Test: Single-Field Update...");
  const ctx = createMockContext();
  const res = updater.applyContextUpdate(ctx, { budget: 25000 });
  
  assert.ok(res.success);
  assert.strictEqual(ctx.state.normalizedEntities.budget, 25000);
  assert.ok(res.data.changeLog.some(log => log.includes("budget")));
  console.log("  => Single-Field Update passed!");
}

async function testMultiFieldUpdate() {
  console.log("Running Test: Multi-Field Update...");
  const ctx = createMockContext();
  const res = updater.applyContextUpdate(ctx, {
    destination: "mumbai",
    durationDays: 5,
    travelStyle: "luxury"
  });

  assert.ok(res.success);
  assert.strictEqual(ctx.state.normalizedEntities.destination, "mumbai");
  assert.strictEqual(ctx.state.normalizedEntities.durationDays, 5);
  assert.strictEqual(ctx.state.normalizedEntities.travelStyle, "luxury");
  assert.strictEqual(res.data.modifiedFields.length, 3);
  console.log("  => Multi-Field Update passed!");
}

async function testInvalidAndPartialFailure() {
  console.log("Running Test: Invalid & Partial Updates...");
  const ctx = createMockContext();
  
  // Try invalid duration (-5) and valid destination ("delhi")
  const res = updater.applyContextUpdate(ctx, {
    destination: "delhi",
    durationDays: -5
  });

  assert.ok(res.success); // Success flag remains true, but warnings capture invalid updates
  assert.strictEqual(ctx.state.normalizedEntities.destination, "delhi");
  assert.strictEqual(ctx.state.normalizedEntities.durationDays, 3, "Duration should stay at original 3 due to validation failure");
  assert.ok(res.warnings.some(w => w.includes("durationDays")));
  console.log("  => Invalid & Partial Updates passed!");
}

async function testConflicts() {
  console.log("Running Test: Conflicts detection...");
  // Total booked cost is 18000, but proposed budget update is 10000 (Conflict!)
  const ctx = createMockContext({ budget: 20000 }, 18000);
  const res = updater.applyContextUpdate(ctx, { budget: 10000 });

  assert.ok(res.success);
  assert.ok(res.data.conflicts.length > 0);
  assert.ok(res.data.conflicts[0].includes("lower than current committed booking cost"));
  console.log("  => Conflicts detection passed!");
}

async function testImmutableProtection() {
  console.log("Running Test: Immutable Fields protection...");
  const ctx = createMockContext();
  
  // Try updating requestId (Forbidden!)
  const res = updater.applyContextUpdate(ctx, {
    requestId: "hacky-req-id",
    destination: "delhi"
  });

  assert.strictEqual(res.success, false);
  assert.ok(res.errors.length > 0);
  assert.strictEqual(ctx.state.normalizedEntities.destination, "goa", "Updates should not be applied if immutable mutation is attempted");
  console.log("  => Immutable Fields protection passed!");
}

async function testNoopUpdates() {
  console.log("Running Test: No-op Updates...");
  const ctx = createMockContext();
  const res = updater.applyContextUpdate(ctx, {
    destination: "goa", // same value
    budget: 15000 // same value
  });

  assert.ok(res.success);
  assert.strictEqual(res.data.changeLog.length, 0, "No-op updates should produce empty change log");
  console.log("  => No-op Updates passed!");
}

async function runAll() {
  console.log("=== STARTING CONTEXT UPDATER TESTS ===");
  await testSingleFieldUpdate();
  await testMultiFieldUpdate();
  await testInvalidAndPartialFailure();
  await testConflicts();
  await testImmutableProtection();
  await testNoopUpdates();
  console.log("\n=== ALL CONTEXT UPDATER TESTS PASSED ===");
}

runAll().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

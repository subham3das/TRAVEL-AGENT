/**
 * Confidence Engine — End-to-End Test
 *
 * Tests:
 * 1. Dynamic scoring: KG-only, provider-only, cross-verified
 * 2. Freshness decay: fresh data vs stale data
 * 3. Low confidence alerts trigger verification messages
 * 4. Per-item confidence enrichment
 * 5. Aggregate confidence + summary
 */

"use strict";

const engine = require("../confidence/confidence_engine");
const ConfidenceScorer = require("../confidence/confidence_scorer");
const ConfidenceAlerts = require("../confidence/confidence_alerts");

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

// ─── Test 1: ConfidenceScorer — Source Diversity ──────────────────────────

console.log("\n=== Test 1: ConfidenceScorer — Source Diversity ===");

const scorer = new ConfidenceScorer();
const now = Date.now();

const kgResult = scorer.score(
  { source: "knowledge_graph", type: "hotel", name: "Taj Palace", location: "Mumbai", pricing: { price: 12000 }, rating: 4.5, amenities: ["pool"], images: ["img.jpg"] },
  null, { now }
);
assert(kgResult.score > 0.85, `KG-only score > 0.85 (got ${kgResult.score})`);
assert(kgResult.level === "HIGH", `KG-only level = HIGH (got ${kgResult.level})`);

const providerResult = scorer.score(
  { source: "booking", type: "hotel", name: "Budget Inn", location: "Delhi", pricing: { price: 4000 }, rating: 4.0, amenities: ["wifi"], images: ["img.jpg"] },
  null, { now }
);
assert(providerResult.score >= 0.60 && providerResult.score < 0.90, `Provider-only score 0.60-0.90 (got ${providerResult.score})`);

const crossVerified = scorer.score(
  { source: "search_layer", type: "hotel", name: "ITC Grand", location: "Delhi", pricing: { price: 9500 }, rating: 4.5, amenities: ["pool"], images: ["img.jpg"] },
  { sources: { title: "knowledge_graph", pricing: "booking_provider", rating: "internet_search" } },
  { now }
);
assert(crossVerified.score > 0.90, `Cross-verified (KG+booking+internet) > 0.90 (got ${crossVerified.score})`);

const dualVerified = scorer.score(
  { source: "search_layer", type: "hotel", name: "Oberoi", location: "Mumbai", pricing: { price: 15000 }, rating: 4.8, amenities: ["spa"], images: ["img.jpg"] },
  { sources: { title: "knowledge_graph", pricing: "booking_provider" } },
  { now }
);
assert(dualVerified.score > 0.88, `Dual-verified (KG+booking) > 0.88 (got ${dualVerified.score})`);

// ─── Test 2: ConfidenceScorer — Freshness Decay ──────────────────────────

console.log("\n=== Test 2: ConfidenceScorer — Freshness Decay ===");

const freshResult = scorer.score(
  { source: "booking", confidence: { verifiedAt: new Date(now).toISOString() } },
  null,
  { now }
);
assert(freshResult.factors.freshness >= 0.95, `Fresh data freshness >= 0.95 (got ${freshResult.factors.freshness})`);

const staleResult = scorer.score(
  { source: "booking", confidence: { verifiedAt: new Date(now - 12 * 60 * 60 * 1000).toISOString() } },
  null,
  { now }
);
assert(staleResult.factors.freshness < 0.80, `12h stale freshness < 0.80 (got ${staleResult.factors.freshness})`);

const veryStaleResult = scorer.score(
  { source: "booking", confidence: { verifiedAt: new Date(now - 48 * 60 * 60 * 1000).toISOString() } },
  null,
  { now }
);
assert(veryStaleResult.factors.freshness <= 0.50, `48h stale freshness <= 0.50 (got ${veryStaleResult.factors.freshness})`);

// ─── Test 3: ConfidenceScorer — Data Completeness ────────────────────────

console.log("\n=== Test 3: ConfidenceScorer — Data Completeness ===");

const fullHotel = scorer.score({
  source: "booking",
  type: "hotel",
  name: "Taj Palace",
  location: "Mumbai",
  pricing: { price: 12000 },
  rating: 4.5,
  amenities: ["pool", "wifi"],
  images: ["img1.jpg"]
}, null, { now });
assert(fullHotel.factors.dataCompleteness >= 0.95, `Full hotel completeness >= 0.95 (got ${fullHotel.factors.dataCompleteness})`);

const sparseHotel = scorer.score({
  source: "booking",
  type: "hotel",
  name: "Budget Inn"
}, null, { now });
assert(sparseHotel.factors.dataCompleteness < 0.50, `Sparse hotel completeness < 0.50 (got ${sparseHotel.factors.dataCompleteness})`);

// ─── Test 4: ConfidenceScorer — Rating Quality ──────────────────────────

console.log("\n=== Test 4: ConfidenceScorer — Rating Quality ===");

const highRated = scorer.score({ source: "booking", rating: 4.8 }, null, { now });
assert(highRated.factors.ratingQuality >= 0.95, `4.8 rating quality >= 0.95 (got ${highRated.factors.ratingQuality})`);

const lowRated = scorer.score({ source: "booking", rating: 1.5 }, null, { now });
assert(lowRated.factors.ratingQuality < 0.50, `1.5 rating quality < 0.50 (got ${lowRated.factors.ratingQuality})`);

const noRating = scorer.score({ source: "booking" }, null, { now });
assert(noRating.factors.ratingQuality === 0.70, `No rating quality = 0.70 (got ${noRating.factors.ratingQuality})`);

// ─── Test 5: ConfidenceAlerts — Low Confidence Detection ─────────────────

console.log("\n=== Test 5: ConfidenceAlerts — Low Confidence Detection ===");

const alerts = new ConfidenceAlerts();

const highConfAlert = alerts.evaluate({
  id: "h1", name: "Taj Palace", type: "hotel",
  confidence: { score: 0.92, level: "HIGH", reason: "Cross-verified" }
});
assert(highConfAlert === null, "HIGH confidence produces no alert");

const mediumConfAlert = alerts.evaluate({
  id: "m1", name: "Budget Inn", type: "hotel",
  confidence: { score: 0.72, level: "MEDIUM", reason: "Limited sources" }
});
assert(mediumConfAlert !== null && mediumConfAlert.level === "MEDIUM", `MEDIUM confidence produces MEDIUM alert (got ${mediumConfAlert?.level})`);

const lowConfAlert = alerts.evaluate({
  id: "l1", name: "Unknown Hostel", type: "hotel",
  confidence: { score: 0.45, level: "LOW", reason: "No verification" }
});
assert(lowConfAlert !== null && lowConfAlert.level === "LOW", `LOW confidence produces LOW alert (got ${lowConfAlert?.level})`);
assert(lowConfAlert.message.includes("verify"), `LOW alert message mentions verification: "${lowConfAlert.message}"`);

// ─── Test 6: ConfidenceAlerts — evaluateAll Summary ─────────────────────

console.log("\n=== Test 6: ConfidenceAlerts — evaluateAll Summary ===");

const evalResult = alerts.evaluateAll([
  { id: "h1", name: "Taj Palace", type: "hotel", confidence: { score: 0.92, level: "HIGH" } },
  { id: "h2", name: "Budget Inn", type: "hotel", confidence: { score: 0.72, level: "MEDIUM" } },
  { id: "h3", name: "Unknown Hostel", type: "hotel", confidence: { score: 0.45, level: "LOW" } },
  { id: "f1", name: "IndiGo", type: "flight", confidence: { score: 0.88, level: "HIGH" } }
]);

assert(evalResult.summary.total === 4, `Total candidates = 4 (got ${evalResult.summary.total})`);
assert(evalResult.summary.high === 2, `High confidence = 2 (got ${evalResult.summary.high})`);
assert(evalResult.summary.medium === 1, `Medium confidence = 1 (got ${evalResult.summary.medium})`);
assert(evalResult.summary.low === 1, `Low confidence = 1 (got ${evalResult.summary.low})`);
assert(evalResult.summary.needsVerification === true, "needsVerification = true when LOW items exist");
assert(evalResult.alerts.length === 2, `2 alerts generated (got ${evalResult.alerts.length})`);

// ─── Test 7: ConfidenceEngine — Full Pipeline ───────────────────────────

console.log("\n=== Test 7: ConfidenceEngine — Full Pipeline ===");

const context = {
  recommendations: {
    candidates: [
      { id: "c1", name: "Taj Palace", type: "hotel", source: "knowledge_graph", rating: 4.7, location: "Mumbai" },
      { id: "c2", name: "IndiGo 6E", type: "flight", source: "search_layer", rating: 4.2 },
      { id: "c3", type: "hotel", source: "internet_search", rating: 1.0 }
    ]
  }
};

const result = engine.run(context);

assert(result.success === true, "Pipeline succeeds");
assert(result.data.candidates.length === 3, `3 candidates enriched (got ${result.data.candidates.length})`);

const c1 = result.data.candidates[0];
assert(typeof c1.confidence.score === "number", `c1 has numeric score (got ${typeof c1.confidence.score})`);
assert(c1.confidence.level === "HIGH", `c1 level = HIGH (got ${c1.confidence.level})`);
assert(c1.confidence.factors, "c1 has factors breakdown");
assert(typeof c1.confidence.factors.sourceDiversity === "number", "c1 has sourceDiversity factor");
assert(typeof c1.confidence.factors.freshness === "number", "c1 has freshness factor");

const c3 = result.data.candidates[2];
assert(c3.confidence.score < 0.80, `c3 (low-rated, internet) score < 0.80 (got ${c3.confidence.score})`);

assert(typeof result.data.confidenceScore === "number", `Aggregate score is numeric (got ${typeof result.data.confidenceScore})`);
assert(result.data.summary.needsVerification === true, "Summary flags needsVerification");
assert(result.data.alerts.length > 0, "Alerts generated for low-confidence items");

assert(context.recommendations.confidenceScore === result.data.confidenceScore, "Aggregate persisted to context");
assert(context.recommendations.confidenceAlerts.length > 0, "Alerts persisted to context");

// ─── Test 8: Cross-Verified Candidate Gets High Score ───────────────────

console.log("\n=== Test 8: Cross-Verified Candidate Gets High Score ===");

const engine2 = engine;
const ctx2 = {
  recommendations: {
    candidates: [
      {
        id: "cv1", name: "Verified Hotel", type: "hotel",
        source: "search_layer", rating: 4.5, name: "ITC Grand", location: "Delhi",
        pricing: { price: 9500 }, amenities: ["pool"], images: ["img.jpg"]
      }
    ]
  }
};

const diag = {
  sources: {
    title: "knowledge_graph",
    pricing: "booking_provider",
    rating: "internet_search",
    location: "knowledge_graph"
  }
};

// Manually enrich with diagnostics (normally done by merge engine)
engine2.enrich(ctx2.recommendations.candidates[0], diag, { now: Date.now() });

const cv = ctx2.recommendations.candidates[0];
assert(cv.confidence.score > 0.85, `Cross-verified hotel score > 0.85 (got ${cv.confidence.score})`);
assert(cv.confidence.level === "HIGH", `Cross-verified hotel level = HIGH (got ${cv.confidence.level})`);
assert(cv.confidence.reason.includes("cross-verified"), `Reason mentions cross-verified: "${cv.confidence.reason}"`);

// ─── Test 9: getWeakestVerification ─────────────────────────────────────

console.log("\n=== Test 9: getWeakestVerification ===");

const weakest = alerts.getWeakestVerification([
  { id: "a", name: "Great Hotel", type: "hotel", confidence: { score: 0.92 } },
  { id: "b", name: "Shady Motel", type: "hotel", confidence: { score: 0.38 } },
  { id: "c", name: "Okay Hostel", type: "hotel", confidence: { score: 0.68 } }
]);

assert(weakest !== null, "Weakest verification found");
assert(weakest.includes("Shady Motel"), `Weakest mentions "Shady Motel": "${weakest}"`);
assert(weakest.includes("38%"), `Weakest mentions 38%: "${weakest}"`);

const noWeakest = alerts.getWeakestVerification([
  { id: "a", name: "Great Hotel", confidence: { score: 0.92 } },
  { id: "b", name: "Good Hotel", confidence: { score: 0.88 } }
]);
assert(noWeakest === null, "No weakest when all above threshold");

// ─── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(60)}`);
process.exit(failed > 0 ? 1 : 0);

/**
 * Explainability Engine — End-to-End Test
 *
 * Tests:
 * 1. EngineContracts preserves reasons[], tradeoffs[], alternatives[], scoreBreakdown
 * 2. ResponseComposer surfaces decisionLog, plannerComparison, explainability sections
 * 3. BudgetEngine generates explanation strings
 * 4. CandidateFlow candidates have reasons[] and tradeoffs[]
 */

"use strict";

const { validateRecommendationResponse, validateBudgetEstimate } = require("../contracts/EngineContracts");
const composer = require("../response/response_composer");
const budgetEngine = require("../budget/budget_engine");

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

// ─── Test 1: EngineContracts — validateRecommendationResponse ────────────

console.log("\n=== Test 1: EngineContracts — validateRecommendationResponse ===");

const rawResponse = {
  candidates: [
    {
      id: "c1",
      name: "Taj Palace",
      category: "hotel",
      image: "img.jpg",
      description: "Luxury hotel",
      rating: 4.7,
      price: 12000,
      confidence: 0.95,
      whyRecommended: "Great location",
      reasons: ["Fits your budget", "Has pool", "Includes breakfast"],
      tradeoffs: ["Airport transfer not included"],
      alternatives: [
        { id: "a1", name: "Oberoi", confidence: 0.91, reason: "Also excellent" }
      ],
      scoreBreakdown: { budgetMatch: 0.9, preferences: 0.85, location: 0.95 },
      source: "search_layer"
    }
  ],
  metadata: {}
};

const validated = validateRecommendationResponse(rawResponse);

assert(validated.candidates.length === 1, "1 candidate preserved");
assert(validated.candidates[0].reasons.length === 3, `reasons[] preserved (got ${validated.candidates[0].reasons.length})`);
assert(validated.candidates[0].reasons[0] === "Fits your budget", `reasons[0] = "Fits your budget" (got "${validated.candidates[0].reasons[0]}")`);
assert(validated.candidates[0].tradeoffs.length === 1, `tradeoffs[] preserved (got ${validated.candidates[0].tradeoffs.length})`);
assert(validated.candidates[0].tradeoffs[0] === "Airport transfer not included", `tradeoffs[0] preserved`);
assert(validated.candidates[0].alternatives.length === 1, `alternatives[] preserved (got ${validated.candidates[0].alternatives.length})`);
assert(validated.candidates[0].alternatives[0].name === "Oberoi", `alternatives[0].name preserved`);
assert(validated.candidates[0].scoreBreakdown !== null, `scoreBreakdown preserved`);
assert(validated.candidates[0].scoreBreakdown.budgetMatch === 0.9, `scoreBreakdown.budgetMatch = 0.9`);

// ─── Test 2: EngineContracts — validateBudgetEstimate ────────────────────

console.log("\n=== Test 2: EngineContracts — validateBudgetEstimate ===");

const rawBudget = {
  minimumRequired: 15000,
  comfortable: 25000,
  luxury: 40000,
  minimumDays: 3,
  breakdown: { stays: 12000, activities: 5000, dining: 4000, transit: 4000 },
  confidence: 0.88,
  explanation: "Hotel estimated at ₹3000/night for comfortable tier. Activity costs based on 3 selected attractions."
};

const validatedBudget = validateBudgetEstimate(rawBudget);

assert(validatedBudget.explanation.length > 0, `explanation preserved (got "${validatedBudget.explanation.substring(0, 50)}...")`);
assert(validatedBudget.explanation.includes("Hotel estimated"), `explanation contains hotel reasoning`);

// ─── Test 3: ResponseComposer — Explainability Sections ──────────────────

console.log("\n=== Test 3: ResponseComposer — Explainability Sections ===");

const context = {
  recommendations: {
    candidates: [
      {
        id: "c1",
        name: "Taj Palace",
        type: "hotel",
        reason: "Great location",
        reasons: ["Fits your budget", "Has pool", "Includes breakfast"],
        tradeoffs: ["Airport transfer not included"],
        scoreBreakdown: { budgetMatch: 0.9, preferences: 0.85 },
        confidence: { score: 0.95, level: "HIGH" },
        alternatives: [{ name: "Oberoi", reason: "Also excellent", confidence: 0.91 }]
      },
      {
        id: "c2",
        name: "IndiGo 6E",
        type: "flight",
        reason: "Direct flight",
        reasons: ["Direct flight", "Fits your budget"],
        tradeoffs: [],
        confidence: { score: 0.88, level: "HIGH" },
        alternatives: []
      }
    ],
    improvedItinerary: {
      decisionLog: [
        { action: "REPLACE", target: "Beach", replacement: "Museum", reason: "Heavy rain expected. Swapped outdoor for indoor.", confidence: 0.95 },
        { action: "INSERT_BREAK", target: "Lunch", reason: "Consecutive high-fatigue activities. Inserting rest buffer.", confidence: 0.90 }
      ],
      plannerComparison: {
        original: { experienceScore: 72 },
        improved: { experienceScore: 88 },
        netImprovement: { experienceScore: 16 }
      }
    },
    budgetSummary: {
      minimumRequired: 15000,
      comfortable: 25000,
      luxury: 40000,
      breakdown: { stays: 12000, activities: 5000, dining: 4000, transit: 4000 },
      explanation: "Hotel estimated at ₹3000/night for comfortable tier."
    },
    confidenceAlerts: [
      { candidateName: "Unknown Hostel", level: "LOW", message: "I'd like to verify this before recommending it.", score: 0.45 }
    ],
    confidenceSummary: { needsVerification: true, verificationMessage: "Some recommendations need verification." }
  },
  state: { conversationState: { currentState: "IDLE" } }
};

const response = composer.compose(context);

assert(response.data.explainability !== undefined, "explainability section exists");
assert(response.data.explainability.sections.length > 0, `explainability has sections (got ${response.data.explainability.sections.length})`);

const recsSection = response.data.explainability.sections.find(s => s.type === "recommendations");
assert(recsSection !== undefined, "recommendations section exists");
assert(recsSection.title === "Why these were picked", `recommendations title = "Why these were picked" (got "${recsSection.title}")`);
assert(recsSection.items.length === 2, `2 recommendation items (got ${recsSection.items.length})`);

const hotelItem = recsSection.items.find(i => i.name === "Taj Palace");
assert(hotelItem !== undefined, "Taj Palace item found");
assert(hotelItem.reasons.length === 3, `Taj Palace has 3 reasons (got ${hotelItem.reasons.length})`);
assert(hotelItem.tradeoffs.length === 1, `Taj Palace has 1 tradeoff (got ${hotelItem.tradeoffs.length})`);
assert(hotelItem.alternatives.length === 1, `Taj Palace has 1 alternative (got ${hotelItem.alternatives.length})`);
assert(hotelItem.confidence.score === 0.95, `Taj Palace confidence = 0.95`);

const optSection = response.data.explainability.sections.find(s => s.type === "optimizations");
assert(optSection !== undefined, "optimizations section exists");
assert(optSection.items.length === 2, `2 optimization items (got ${optSection.items.length})`);
assert(optSection.items[0].reason.includes("rain"), `optimization reason mentions rain`);

const budgetSection = response.data.explainability.sections.find(s => s.type === "budget");
assert(budgetSection !== undefined, "budget section exists");
assert(budgetSection.items[0].explanation.includes("Hotel estimated"), `budget explanation present`);

const alertSection = response.data.explainability.sections.find(s => s.type === "confidence_alerts");
assert(alertSection !== undefined, "confidence_alerts section exists");
assert(alertSection.items[0].level === "LOW", `alert level = LOW`);
assert(alertSection.items[0].message.includes("verify"), `alert message mentions verification`);

assert(response.data.explainability.hasLowConfidence === true, "hasLowConfidence = true");
assert(response.data.explainability.summary.includes("verification"), `summary mentions verification`);

assert(response.data.decisionLog !== undefined, "decisionLog surfaced in data");
assert(response.data.decisionLog.length === 2, `decisionLog has 2 entries`);
assert(response.data.plannerComparison !== undefined, "plannerComparison surfaced in data");
assert(response.data.budgetExplanation !== undefined, "budgetExplanation surfaced in data");

// ─── Test 4: ResponseComposer — Per-Candidate in Recommendations ────────

console.log("\n=== Test 4: ResponseComposer — Per-Candidate in Recommendations ===");

assert(response.data.recommendations.candidates.length === 2, `2 candidates in recommendations (got ${response.data.recommendations.candidates.length})`);

const recsCandidate = response.data.recommendations.candidates.find(c => c.name === "Taj Palace");
assert(recsCandidate !== undefined, "Taj Palace in recommendations.candidates");
assert(recsCandidate.reasons.length === 3, `reasons[] in recommendations candidate`);
assert(recsCandidate.tradeoffs.length === 1, `tradeoffs[] in recommendations candidate`);
assert(recsCandidate.scoreBreakdown !== null, `scoreBreakdown in recommendations candidate`);
assert(recsCandidate.alternatives.length === 1, `alternatives[] in recommendations candidate`);

// ─── Test 5: BudgetEngine — Explanation Generation ──────────────────────

console.log("\n=== Test 5: BudgetEngine — Explanation Generation ===");

const explanation = budgetEngine.buildExplanation({
  destinationId: "goa",
  travelStyle: "mid",
  travelersType: "couple",
  days: 4,
  hotelPricePerNight: 3500,
  baseStays: 25200,
  baseFood: 14400,
  baseActivities: 6000,
  baseTransport: 8000,
  seasonMultiplier: 1.25,
  multiplier: 1.8,
  hotelRoomsCount: 1,
  selectedHotel: false,
  selectedPlaces: 3
});

assert(explanation.length > 0, `explanation generated (got "${explanation.substring(0, 80)}...")`);
assert(explanation.includes("Hotel") || explanation.includes("hotel"), `explanation mentions hotel`);
assert(explanation.includes("₹"), `explanation contains currency amounts`);
assert(explanation.includes("couple"), `explanation mentions couple travel`);
assert(explanation.includes("peak season") || explanation.includes("25%"), `explanation mentions season surcharge`);
assert(explanation.includes("3 selected attractions"), `explanation mentions selected attractions`);

// ─── Test 6: ResponseComposer — Empty Candidates ────────────────────────

console.log("\n=== Test 6: ResponseComposer — Empty Candidates ===");

const emptyContext = {
  recommendations: {},
  state: { conversationState: { currentState: "IDLE" } }
};

const emptyResponse = composer.compose(emptyContext);

assert(emptyResponse.data.explainability !== undefined, "explainability exists with empty recs");
assert(emptyResponse.data.explainability.sections.length === 0, `0 sections with empty recs`);
assert(emptyResponse.data.explainability.hasLowConfidence === false, "hasLowConfidence = false with empty recs");

// ─── Test 7: ResponseComposer — Full Pipeline with Confidence Summary ──

console.log("\n=== Test 7: ResponseComposer — Confidence Summary Text ===");

const summaryContext = {
  recommendations: {
    candidates: [
      { id: "c1", name: "Hotel A", type: "hotel", reasons: ["Good"], tradeoffs: [], confidence: { score: 0.92, level: "HIGH" }, alternatives: [] },
      { id: "c2", name: "Hotel B", type: "hotel", reasons: ["Cheap"], tradeoffs: ["Far from beach"], confidence: { score: 0.75, level: "MEDIUM" }, alternatives: [] }
    ],
    confidenceSummary: { needsVerification: false, verificationMessage: "Most recommendations look solid." }
  },
  state: { conversationState: { currentState: "IDLE" } }
};

const summaryResponse = composer.compose(summaryContext);
assert(summaryResponse.data.explainability.summary === "Most recommendations look solid.", `summary text preserved`);
assert(summaryResponse.data.explainability.hasLowConfidence === false, "hasLowConfidence = false");

// ─── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(60)}`);
process.exit(failed > 0 ? 1 : 0);

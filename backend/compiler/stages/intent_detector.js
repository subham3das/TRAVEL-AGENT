/**
 * Deterministic intent detection module.
 *
 * Reads the user query from the TravelContext object, scores it against
 * known travel intents using weighted keyword matching, and returns the
 * Engine Response Contract with the winning intent.
 *
 * @module intentDetector
 */

const KEYWORD_MAP = {
  trip_generation: [
    { word: "plan", weight: 3 },
    { word: "trip", weight: 3 },
    { word: "itinerary", weight: 3 },
    { word: "vacation", weight: 2 },
    { word: "holiday", weight: 2 },
    { word: "travel", weight: 2 },
    { word: "destination", weight: 2 },
    { word: "explore", weight: 2 },
    { word: "visit", weight: 1 },
    { word: "schedule", weight: 2 },
  ],
  booking_search: [
    { word: "book", weight: 3 },
    { word: "booking", weight: 3 },
    { word: "hotel", weight: 3 },
    { word: "flight", weight: 3 },
    { word: "reservation", weight: 3 },
    { word: "train", weight: 2 },
    { word: "hostel", weight: 2 },
    { word: "ticket", weight: 2 },
    { word: "accommodation", weight: 2 },
    { word: "stay", weight: 1 },
  ],
  weather: [
    { word: "weather", weight: 3 },
    { word: "temperature", weight: 3 },
    { word: "forecast", weight: 3 },
    { word: "rain", weight: 2 },
    { word: "rainy", weight: 2 },
    { word: "sunny", weight: 2 },
    { word: "cold", weight: 1 },
    { word: "hot", weight: 1 },
    { word: "climate", weight: 2 },
    { word: "humidity", weight: 1 },
  ],
  nearby_places: [
    { word: "nearby", weight: 3 },
    { word: "near", weight: 3 },
    { word: "nearest", weight: 3 },
    { word: "around", weight: 2 },
    { word: "close", weight: 1 },
    { word: "attractions", weight: 2 },
    { word: "landmarks", weight: 2 },
    { word: "places", weight: 1 },
    { word: "sights", weight: 2 },
    { word: "what is around", weight: 3 },
  ],
  food_discovery: [
    { word: "food", weight: 3 },
    { word: "restaurant", weight: 3 },
    { word: "cuisine", weight: 3 },
    { word: "eat", weight: 2 },
    { word: "dining", weight: 2 },
    { word: "cafe", weight: 2 },
    { word: "menu", weight: 2 },
    { word: "dinner", weight: 1 },
    { word: "lunch", weight: 1 },
    { word: "breakfast", weight: 1 },
  ],
  transport: [
    { word: "transport", weight: 3 },
    { word: "transfer", weight: 3 },
    { word: "taxi", weight: 2 },
    { word: "uber", weight: 2 },
    { word: "bus", weight: 2 },
    { word: "metro", weight: 2 },
    { word: "subway", weight: 2 },
    { word: "airport", weight: 2 },
    { word: "commute", weight: 2 },
    { word: "shuttle", weight: 2 },
  ],
  travel_chat: [
    { word: "recommend", weight: 2 },
    { word: "suggestion", weight: 2 },
    { word: "guide", weight: 2 },
    { word: "tips", weight: 2 },
    { word: "advice", weight: 2 },
    { word: "help", weight: 1 },
    { word: "best", weight: 1 },
    { word: "what", weight: 1 },
    { word: "how", weight: 1 },
    { word: "can you", weight: 2 },
  ],
};

const INTENT_PRIORITY = [
  "trip_generation",
  "booking_search",
  "weather",
  "nearby_places",
  "food_discovery",
  "transport",
  "travel_chat",
  "unknown",
];

/**
 * Scores a query against every intent and returns the highest-scoring match.
 *
 * @param {string} query - The user's raw input.
 * @returns {{ intent: string, score: number, matchedKeywords: string[] }}
 */
function scoreIntents(query) {
  const lower = query.toLowerCase();
  const scores = [];

  for (const intent of INTENT_PRIORITY) {
    if (intent === "unknown") continue;

    const keywords = KEYWORD_MAP[intent];
    let score = 0;
    const matched = [];

    for (const { word, weight } of keywords) {
      if (lower.includes(word)) {
        score += weight;
        matched.push(word);
      }
    }

    scores.push({ intent, score, matchedKeywords: matched });
  }

  scores.sort((a, b) => {
    const diff = b.score - a.score;
    if (diff !== 0) return diff;
    return INTENT_PRIORITY.indexOf(a.intent) - INTENT_PRIORITY.indexOf(b.intent);
  });

  return scores[0];
}

/**
 * Reads the user query from the TravelContext, runs deterministic
 * intent scoring, and returns a standard Engine Response.
 *
 * @param {object} context - TravelContext object.
 * @param {string} [context.originalQuery] - The user's raw query string.
 * @returns {object} Engine Response Contract.
 */
function detectIntent(context) {
  const start = Date.now();

  const errors = [];
  const warnings = [];

  if (!context || typeof context !== "object") {
    errors.push("Invalid context: expected an object");
    return {
      success: false,
      data: { intent: "unknown", score: 0, matchedKeywords: [] },
      errors,
      warnings,
      confidence: 0,
      processingTime: Date.now() - start,
      metadata: { module: "intent_detector" },
    };
  }

  const query = context.request?.originalQuery ?? context.originalQuery ?? "";

  if (typeof query !== "string") {
    errors.push("Invalid query: expected a string");
    return {
      success: false,
      data: { intent: "unknown", score: 0, matchedKeywords: [] },
      errors,
      warnings,
      confidence: 0,
      processingTime: Date.now() - start,
      metadata: { module: "intent_detector" },
    };
  }

  if (query.trim().length === 0) {
    warnings.push("Empty query received, defaulting to unknown intent");
    return {
      success: true,
      data: { intent: "unknown", score: 0, matchedKeywords: [] },
      errors,
      warnings,
      confidence: 1,
      processingTime: Date.now() - start,
      metadata: { module: "intent_detector" },
    };
  }

  const result = scoreIntents(query);

  if (result.score === 0) {
    warnings.push("No known intent keywords detected, falling back to unknown");

    return {
      success: true,
      data: { intent: "unknown", score: 0, matchedKeywords: [] },
      errors,
      warnings,
      confidence: 0,
      processingTime: Date.now() - start,
      metadata: { module: "intent_detector" },
    };
  }

  const maxPossible = Math.max(...Object.values(KEYWORD_MAP).flat().map((k) => k.weight)) * 5;
  const confidence = Math.min(result.score / maxPossible, 1);

  return {
    success: true,
    data: {
      intent: result.intent,
      score: result.score,
      matchedKeywords: result.matchedKeywords,
    },
    errors,
    warnings,
    confidence: parseFloat(confidence.toFixed(4)),
    processingTime: Date.now() - start,
    metadata: { module: "intent_detector" },
  };
}

module.exports = { detectIntent };

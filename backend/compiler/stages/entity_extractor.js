/**
 * Deterministic Entity Extraction module.
 *
 * Reads the user query from the TravelContext and extracts structured
 * travel entities using regex, keyword dictionaries, and string matching.
 * No LLM, no external APIs, no machine learning.
 *
 * @module entityExtractor
 */

const KNOWN_DESTINATIONS = require("../../config/destinations");
const INTEREST_KEYWORDS = require("../../config/interests");
const STYLE_KEYWORDS = require("../../config/travel_styles");
const TRANSPORT_KEYWORDS = require("../../config/transport");
const ACCOMMODATION_KEYWORDS = require("../../config/accommodation");
const FOOD_KEYWORDS = require("../../config/food_preferences");

/**
 * Extract a destination from the query using multiple strategies.
 *
 * @param {string} lower - Lowercased query.
 * @param {string} original - Original-case query.
 * @returns {{ value: string|null, source: string }|null}
 */
function extractDestination(lower, original) {
  for (const dest of KNOWN_DESTINATIONS) {
    const idx = lower.indexOf(dest);
    if (idx !== -1) {
      const end = idx + dest.length;
      if ((idx === 0 || !/[a-z]/.test(lower[idx - 1])) &&
          (end >= lower.length || !/[a-z]/.test(lower[end]))) {
        const value = original.slice(idx, end).replace(/\b\w/g, (c) => c.toUpperCase()).trim();
        return { value, source: "dictionary" };
      }
    }
  }

  const placeRegex = /(?:in|to|for|at|near|around|visit|explore)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
  let match;
  while ((match = placeRegex.exec(original)) !== null) {
    const candidate = match[1].trim();
    if (candidate.length >= 2 && !/^(The|A|An|This|That|My|Our|Your|Next|Last|One|Two|Three)$/i.test(candidate.split(/\s+/)[0])) {
      return { value: candidate, source: "regex_preposition" };
    }
  }

  const tripToRegex = /(?:trip|vacation|holiday|travel)\s+(?:to|in|for|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i;
  const tripToMatch = original.match(tripToRegex);
  if (tripToMatch) return { value: tripToMatch[1].trim(), source: "regex_trip_to" };

  const namedTripRegex = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:trip|vacation|holiday|tour|travel)/g;
  let namedMatch;
  while ((namedMatch = namedTripRegex.exec(original)) !== null) {
    const candidate = namedMatch[1].trim();
    if (candidate.length >= 2 && !/^(The|A|An|This|That|My|Our|Your|Next|Last|One|Two|Three)$/i.test(candidate)) {
      return { value: candidate, source: "regex_named_trip" };
    }
  }

  return null;
}

/**
 * Extract budget amount from the query.
 *
 * @param {string} lower - Lowercased query.
 * @returns {{ value: number|null, raw: string|null }|null}
 */
function extractBudget(lower) {
  const patterns = [
    { re: /(?:₹|rs\.?\s*)\s*(\d{2,8})(?:\s*\.\s*\d+)?/i, confidence: 1.0 },
    { re: /(?:under|less than|below|within|max|maximum|upto|up to)\s*(?:₹|rs\.?\s*)?(\d{2,8})/i, confidence: 1.0 },
    { re: /(?:around|about|approx|approximately|roughly)\s*(?:₹|rs\.?\s*)?(\d{2,8})/i, confidence: 0.95 },
    { re: /budget\s*(?:of\s*)?(?:₹|rs\.?\s*)?(\d{2,8})/i, confidence: 0.95 },
    { re: /(?:with|of|for|a)\s*(?:a\s*)?(?:₹|rs\.?\s*)?(\d{2,8})\s*(?:budget|rupees|rs\.?|inr)/i, confidence: 0.9 },
    { re: /(?:₹|rs\.?\s*)?(\d{2,8})\s*(?:rupees|rs\.?|inr)/i, confidence: 0.9 },
    { re: /(\d+)\s*k\b/i, confidence: 1.0 },
    { re: /(\d+)\s*thousand/i, confidence: 1.0 },
    { re: /budget\s*(?:around|about|of)?\s*(\d+)/i, confidence: 0.85 },
    { re: /(\d{2,8})\s*(?:rupees|rs)/i, confidence: 0.85 },
    { re: /(\d{2,8})\s*budget/i, confidence: 0.85 },
  ];

  for (const { re, confidence } of patterns) {
    const match = lower.match(re);
    if (match) {
      const raw = match[0].trim();
      let value;
      if (re.toString().includes("k\\b") || re.toString().includes("thousand")) {
        value = parseInt(match[1], 10) * 1000;
      } else {
        value = parseInt(match[1], 10);
      }
      if (!isNaN(value)) return { value, raw, confidence };
    }
  }

  return null;
}

/**
 * Extract trip duration in days.
 *
 * @param {string} lower - Lowercased query.
 * @returns {{ value: number|null, raw: string|null, confidence?: number }|null}
 */
function extractDuration(lower) {
  const dayMatch = lower.match(/(\d+)\s*(?:days?|nights?|d\b)/i);
  if (dayMatch) return { value: parseInt(dayMatch[1], 10), raw: dayMatch[0].trim(), confidence: 1.0 };

  const weekMatch = lower.match(/(\d+)\s*(?:week|weeks)\b/i);
  if (weekMatch) return { value: parseInt(weekMatch[1], 10) * 7, raw: weekMatch[0].trim(), confidence: 0.95 };

  const oneWeek = lower.match(/\b(one\s*week|a\s*week)\b/i);
  if (oneWeek) return { value: 7, raw: oneWeek[0].trim(), confidence: 0.9 };

  if (/\btwo\s*weeks?\b/i.test(lower)) {
    const m = lower.match(/\btwo\s*weeks?\b/i);
    return { value: 14, raw: m[0].trim(), confidence: 0.9 };
  }

  const nightMatch = lower.match(/(\d+)\s*nights?/i);
  if (nightMatch) return { value: parseInt(nightMatch[1], 10), raw: nightMatch[0].trim(), confidence: 0.9 };

  if (/\bweekend\b/i.test(lower)) return { value: 2, raw: "weekend", confidence: 0.8 };
  if (/\bfortnight\b/i.test(lower)) return { value: 14, raw: "fortnight", confidence: 0.8 };
  if (/\bday\s*trip\b/i.test(lower)) {
    const m = lower.match(/\bday\s*trip\b/i);
    return { value: 1, raw: m[0].trim(), confidence: 0.7 };
  }
  if (/\b(overnight|one night|1 night)\b/i.test(lower)) {
    const m = lower.match(/\b(overnight|one night|1 night)\b/i);
    return { value: 2, raw: m[0].trim(), confidence: 0.7 };
  }

  return null;
}

/**
 * Extract number of travelers.
 *
 * @param {string} lower - Lowercased query.
 * @returns {{ count: number|null, type: string|null, raw: string|null, confidence: number }|null}
 */
function extractTravelers(lower) {
  const countPatterns = [
    { re: /(\d+)\s*(people|persons?|pax|adults?|travelers?|travellers?|friends|guests?|members?)/i, confidence: 1.0 },
    { re: /(solo)\b/i, confidence: 1.0 },
    { re: /(couple)\b/i, confidence: 1.0 },
    { re: /(family)\b/i, confidence: 1.0 },
    { re: /(friends)\b/i, confidence: 0.9 },
    { re: /for\s+(\d+)\s+(?!days?|nights?|weeks?|months?|hours?)/i, confidence: 0.8 },
  ];

  for (const { re, confidence } of countPatterns) {
    const match = lower.match(re);
    if (match) {
      const raw = match[0].trim();
      if (match[1] && /^(solo|couple|family|friends)$/i.test(match[1])) {
        const type = match[1].toLowerCase();
        const counts = { solo: 1, couple: 2, family: 4, friends: 4 };
        return { count: counts[type] || null, type, raw, confidence };
      }
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) {
        return { count: num, type: null, raw, confidence };
      }
    }
  }

  return null;
}

/**
 * Extract interests from the query using keyword dictionary.
 *
 * @param {string} lower - Lowercased query.
 * @returns {{ value: string[], confidence: number }}
 */
function extractInterests(lower) {
  const found = [];
  for (const [interest, keywords] of Object.entries(INTEREST_KEYWORDS)) {
    for (const kw of keywords) {
      const regex = new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
      if (regex.test(lower)) {
        found.push(interest);
        break;
      }
    }
  }
  return { value: found, confidence: found.length > 0 ? 1.0 : 0 };
}

/**
 * Extract a single travel style from the query using keyword dictionary.
 *
 * @param {string} lower - Lowercased query.
 * @returns {{ value: string|null, confidence: number }|null}
 */
function extractTravelStyle(lower) {
  for (const [style, keywords] of Object.entries(STYLE_KEYWORDS)) {
    for (const kw of keywords) {
      const regex = new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
      if (regex.test(lower)) return { value: style, confidence: 1.0 };
    }
  }
  return null;
}

/**
 * Extract accommodation preference from the query.
 *
 * @param {string} lower - Lowercased query.
 * @returns {{ value: string|null, confidence: number }|null}
 */
function extractAccommodation(lower) {
  for (const [type, keywords] of Object.entries(ACCOMMODATION_KEYWORDS)) {
    for (const kw of keywords) {
      const regex = new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
      if (regex.test(lower)) return { value: type, confidence: 1.0 };
    }
  }
  return null;
}

/**
 * Extract transport preference from the query.
 *
 * @param {string} lower - Lowercased query.
 * @returns {{ value: string|null, confidence: number }|null}
 */
function extractTransport(lower) {
  for (const [mode, keywords] of Object.entries(TRANSPORT_KEYWORDS)) {
    for (const kw of keywords) {
      const regex = new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
      if (regex.test(lower)) return { value: mode, confidence: 1.0 };
    }
  }
  return null;
}

/**
 * Extract food preference from the query.
 *
 * @param {string} lower - Lowercased query.
 * @returns {{ value: string|null, confidence: number }|null}
 */
function extractFoodPreference(lower) {
  for (const [pref, keywords] of Object.entries(FOOD_KEYWORDS)) {
    for (const kw of keywords) {
      const regex = new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
      if (regex.test(lower)) return { value: pref, confidence: 1.0 };
    }
  }
  return null;
}

/**
 * Extract raw travel date text from the query.
 *
 * @param {string} lower - Lowercased query.
 * @param {string} original - Original-case query.
 * @returns {{ value: string|null, confidence: number }|null}
 */
function extractTravelDates(lower, original) {
  const datePatterns = [
    { re: /\b(next|this|coming)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|year|weekend)\b/i, confidence: 0.9 },
    { re: /\b(tomorrow|today|tonight|day after tomorrow)\b/i, confidence: 0.9 },
    { re: /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\b/i, confidence: 1.0 },
    { re: /\b\d{1,2}(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i, confidence: 1.0 },
    { re: /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/, confidence: 1.0 },
    { re: /\b\d{4}-\d{2}-\d{2}\b/, confidence: 1.0 },
    { re: /\b(this|next|coming)\s+(spring|summer|autumn|fall|winter|monsoon)\b/i, confidence: 0.85 },
    { re: /\b(in\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i, confidence: 0.8 },
  ];

  for (const { re, confidence } of datePatterns) {
    const match = original.match(re);
    if (match) return { value: match[0].trim(), confidence };
  }

  return null;
}

/**
 * Reads the user query from the TravelContext and extracts all
 * supported travel entities using deterministic methods.
 *
 * @param {object} context - TravelContext object.
 * @param {string} [context.originalQuery] - The user's raw query string.
 * @returns {object} Engine Response Contract.
 */
function extractEntities(context) {
  const start = Date.now();
  const errors = [];
  const warnings = [];

  if (!context || typeof context !== "object") {
    errors.push("Invalid context: expected an object");
    return {
      success: false,
      data: emptyResult(),
      errors,
      warnings,
      confidence: 0,
      processingTime: Date.now() - start,
      metadata: { module: "entity_extractor" },
    };
  }

  const query = context.request?.originalQuery ?? context.originalQuery ?? "";

  if (typeof query !== "string") {
    errors.push("Invalid query: expected a string");
    return {
      success: false,
      data: emptyResult(),
      errors,
      warnings,
      confidence: 0,
      processingTime: Date.now() - start,
      metadata: { module: "entity_extractor" },
    };
  }

  if (query.trim().length === 0) {
    warnings.push("Empty query, no entities to extract");
    return {
      success: true,
      data: emptyResult(),
      errors,
      warnings,
      confidence: 0,
      processingTime: Date.now() - start,
      metadata: { module: "entity_extractor" },
    };
  }

  const lower = query.toLowerCase();
  const original = query.trim();

  const destResult = extractDestination(lower, original);
  const budgetResult = extractBudget(lower);
  const durationResult = extractDuration(lower);
  const travelersResult = extractTravelers(lower);
  const interestsResult = extractInterests(lower);
  const styleResult = extractTravelStyle(lower);
  const accommodationResult = extractAccommodation(lower);
  const transportResult = extractTransport(lower);
  const foodResult = extractFoodPreference(lower);
  const datesResult = extractTravelDates(lower, original);

  const extractedCount = [
    destResult, budgetResult, durationResult, travelersResult,
    interestsResult.value.length > 0, styleResult, accommodationResult,
    transportResult, foodResult, datesResult,
  ].filter(Boolean).length;

  const overallConfidence = original.length > 0
    ? parseFloat(Math.min(extractedCount / 7, 1).toFixed(4))
    : 0;

  if (extractedCount === 0) {
    warnings.push("No travel entities detected in the query");
  }

  const entityConfidence = {};
  if (destResult) entityConfidence.destination = destResult.source === "dictionary" ? 1.0 : 0.9;
  if (budgetResult) entityConfidence.budget = budgetResult.confidence;
  if (durationResult) entityConfidence.durationDays = durationResult.confidence;
  if (travelersResult) entityConfidence.travelers = travelersResult.confidence;
  if (styleResult) entityConfidence.travelStyle = styleResult.confidence;
  if (accommodationResult) entityConfidence.accommodation = accommodationResult.confidence;
  if (transportResult) entityConfidence.transport = transportResult.confidence;
  if (foodResult) entityConfidence.foodPreference = foodResult.confidence;
  if (datesResult) entityConfidence.travelDates = datesResult.confidence;
  if (interestsResult.value.length > 0) entityConfidence.interests = interestsResult.confidence;

  const entityMetadata = {};
  if (destResult) entityMetadata.destination = { source: destResult.source };
  if (budgetResult) entityMetadata.budget = { source: "regex" };
  if (durationResult) entityMetadata.durationDays = { source: "regex" };
  if (travelersResult) entityMetadata.travelers = { source: travelersResult.type ? "keyword" : "regex" };
  if (styleResult) entityMetadata.travelStyle = { source: "keyword" };
  if (accommodationResult) entityMetadata.accommodation = { source: "keyword" };
  if (transportResult) entityMetadata.transport = { source: "keyword" };
  if (foodResult) entityMetadata.foodPreference = { source: "keyword" };
  if (datesResult) entityMetadata.travelDates = { source: "regex" };
  if (interestsResult.value.length > 0) entityMetadata.interests = { source: "keyword" };

  return {
    success: true,
    data: {
      destination: destResult ? destResult.value : null,
      rawDestination: destResult ? destResult.value : null,
      durationDays: durationResult ? durationResult.value : null,
      rawDuration: durationResult ? durationResult.raw : null,
      budget: budgetResult ? budgetResult.value : null,
      rawBudget: budgetResult ? budgetResult.raw : null,
      travelers: travelersResult ? travelersResult.count : null,
      rawTravelers: travelersResult ? travelersResult.raw : null,
      travelersType: travelersResult ? travelersResult.type : null,
      interests: interestsResult.value.length > 0 ? interestsResult.value : null,
      travelStyle: styleResult ? styleResult.value : null,
      accommodation: accommodationResult ? accommodationResult.value : null,
      transport: transportResult ? transportResult.value : null,
      foodPreference: foodResult ? foodResult.value : null,
      travelDates: datesResult ? datesResult.value : null,
      rawTravelDates: datesResult ? datesResult.value : null,
      entityConfidence,
      entityMetadata,
    },
    errors,
    warnings,
    confidence: overallConfidence,
    processingTime: Date.now() - start,
    metadata: { module: "entity_extractor" },
  };
}

/**
 * Returns an empty entity result object for error / no-input cases.
 *
 * @returns {object}
 */
function emptyResult() {
  return {
    destination: null,
    rawDestination: null,
    durationDays: null,
    rawDuration: null,
    budget: null,
    rawBudget: null,
    travelers: null,
    rawTravelers: null,
    travelersType: null,
    interests: null,
    travelStyle: null,
    accommodation: null,
    transport: null,
    foodPreference: null,
    travelDates: null,
    rawTravelDates: null,
    entityConfidence: {},
    entityMetadata: {},
  };
}

module.exports = { extractEntities };

/**
 * Deterministic Normalization Engine.
 *
 * Receives extracted entities from the Entity Extractor and converts
 * them into standardized canonical values using alias maps and date math.
 * No LLM, no external APIs, no inference.
 *
 * @module normalizer
 */

const destinationAliases = require("../../config/destination_aliases");
const travelStyleAliases = require("../../config/travel_style_aliases");
const foodAliases = require("../../config/food_aliases");
const transportAliases = require("../../config/transport_aliases");
const accommodationAliases = require("../../config/accommodation_aliases");

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Normalize a value using an alias map (case-insensitive lookup).
 *
 * @param {string|null} value
 * @param {object} aliasMap
 * @param {string} [field] - Entity name for error/warning context.
 * @returns {{ value: string|null, normalized: boolean }}
 */
function resolveAlias(value, aliasMap, field) {
  if (!value) return { value, normalized: false };
  const key = value.toLowerCase().replace(/\s+/g, "");
  const canonical = aliasMap[key];
  if (canonical) return { value: canonical, normalized: true };
  return { value, normalized: false };
}

/**
 * Normalize destination using alias map.
 *
 * @param {string|null} dest
 * @returns {{ value: string|null, normalized: boolean }}
 */
function normalizeDestination(dest) {
  return resolveAlias(dest, destinationAliases, "destination");
}

/**
 * Normalize travel style using alias map.
 *
 * @param {string|null} style
 * @returns {{ value: string|null, normalized: boolean }}
 */
function normalizeTravelStyle(style) {
  return resolveAlias(style, travelStyleAliases, "travelStyle");
}

/**
 * Normalize accommodation using alias map.
 *
 * @param {string|null} acc
 * @returns {{ value: string|null, normalized: boolean }}
 */
function normalizeAccommodation(acc) {
  return resolveAlias(acc, accommodationAliases, "accommodation");
}

/**
 * Normalize transport using alias map.
 *
 * @param {string|null} transport
 * @returns {{ value: string|null, normalized: boolean }}
 */
function normalizeTransport(transport) {
  return resolveAlias(transport, transportAliases, "transport");
}

/**
 * Normalize food preference using alias map.
 *
 * @param {string|null} food
 * @returns {{ value: string|null, normalized: boolean }}
 */
function normalizeFoodPreference(food) {
  return resolveAlias(food, foodAliases, "foodPreference");
}

/**
 * Normalize budget — pass through numeric value, conversions already
 * handled by entity extractor. Returns raw string alongside number.
 *
 * @param {number|null} budget
 * @returns {{ value: number|null }}
 */
function normalizeBudget(budget) {
  return { value: budget ?? null };
}

/**
 * Normalize duration string to a canonical day count.
 *
 * Handles: weekend (2), one week (7), fortnight (14),
 * X nights (X), and numeric pass-through.
 *
 * @param {number|null} durationDays
 * @param {string|null} rawDuration
 * @returns {{ value: number|null, normalized: boolean }}
 */
function normalizeDuration(durationDays, rawDuration) {
  if (durationDays !== null && durationDays !== undefined) {
    return { value: durationDays, normalized: false };
  }

  if (!rawDuration) return { value: null, normalized: false };

  const lower = rawDuration.toLowerCase().trim();

  const dayMatch = lower.match(/^(\d+)\s*days?$/);
  if (dayMatch) return { value: parseInt(dayMatch[1], 10), normalized: false };

  const nightMatch = lower.match(/^(\d+)\s*nights?$/);
  if (nightMatch) return { value: parseInt(nightMatch[1], 10), normalized: true };

  const weekMatch = lower.match(/^(\d+)\s*weeks?$/);
  if (weekMatch) return { value: parseInt(weekMatch[1], 10) * 7, normalized: true };

  if (/^weekend$/.test(lower)) return { value: 2, normalized: true };
  if (/^(one\s*week|a\s*week)$/.test(lower)) return { value: 7, normalized: true };
  if (/^two\s*weeks?$/.test(lower)) return { value: 14, normalized: true };
  if (/^fortnight$/.test(lower)) return { value: 14, normalized: true };
  if (/^day\s*trip$/.test(lower)) return { value: 1, normalized: true };
  if (/^overnight$/.test(lower)) return { value: 2, normalized: true };

  return { value: null, normalized: false };
}

/**
 * Normalize travelers count.
 *
 * @param {number|null} count
 * @param {string|null} raw
 * @returns {{ value: number|null, normalized: boolean }}
 */
function normalizeTravelers(count, raw) {
  return { value: count ?? null, normalized: false };
}

/**
 * Normalize raw travel date text to ISO date string when deterministic.
 *
 * Supports:
 *   - tomorrow, today
 *   - next {dayname}
 *   - this weekend
 *   - next week
 *   - {month} {day} (absolute)
 *   - {day} {month} (absolute)
 *   - ISO formats (YYYY-MM-DD, MM/DD/YYYY)
 *   - Falls back to raw value when indeterministic.
 *
 * @param {string|null} rawDate - Raw date text from extractor.
 * @returns {{ value: string|null, normalized: boolean }}
 */
function normalizeDate(rawDate) {
  if (!rawDate) return { value: null, normalized: false };

  const lower = rawDate.toLowerCase().trim();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (lower === "today") {
    return { value: toISODate(today), normalized: true };
  }

  if (lower === "tomorrow") {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return { value: toISODate(d), normalized: true };
  }

  if (lower === "day after tomorrow") {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    return { value: toISODate(d), normalized: true };
  }

  const nextDayMatch = lower.match(/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (nextDayMatch) {
    const targetDay = DAY_NAMES.indexOf(nextDayMatch[1]);
    const currentDay = today.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    const d = new Date(today);
    d.setDate(d.getDate() + daysUntil);
    return { value: toISODate(d), normalized: true };
  }

  const thisDayMatch = lower.match(/^this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (thisDayMatch) {
    const targetDay = DAY_NAMES.indexOf(thisDayMatch[1]);
    const currentDay = today.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0) daysUntil += 7;
    if (daysUntil === 0) daysUntil = 7;
    const d = new Date(today);
    d.setDate(d.getDate() + daysUntil);
    return { value: toISODate(d), normalized: true };
  }

  if (/^this\s+weekend$/.test(lower)) {
    const currentDay = today.getDay();
    const daysUntilSaturday = (6 - currentDay + 7) % 7;
    const d = new Date(today);
    d.setDate(d.getDate() + (daysUntilSaturday === 0 ? 7 : daysUntilSaturday));
    return { value: toISODate(d), normalized: true };
  }

  if (/^next\s+week$/.test(lower)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    return { value: toISODate(d), normalized: true };
  }

  const monthDayMatch = lower.match(/^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?$/);
  if (monthDayMatch) {
    const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
    const month = months.indexOf(monthDayMatch[1]);
    const day = parseInt(monthDayMatch[2], 10);
    const d = new Date(today.getFullYear(), month, day);
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    return { value: toISODate(d), normalized: true };
  }

  const dayMonthMatch = lower.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)$/);
  if (dayMonthMatch) {
    const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
    const month = months.indexOf(dayMonthMatch[2]);
    const day = parseInt(dayMonthMatch[1], 10);
    const d = new Date(today.getFullYear(), month, day);
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    return { value: toISODate(d), normalized: true };
  }

  const isoMatch = lower.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return { value: lower, normalized: false };

  const slashMatch = lower.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slashMatch) {
    let month = parseInt(slashMatch[1], 10);
    let day = parseInt(slashMatch[2], 10);
    let year = slashMatch[3] ? parseInt(slashMatch[3], 10) : today.getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month - 1, day);
    return { value: toISODate(d), normalized: true };
  }

  return { value: rawDate, normalized: false };
}

/**
 * Format a Date object to YYYY-MM-DD string.
 *
 * @param {Date} date
 * @returns {string}
 */
function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Reads extracted entities from context and returns canonical normalized
 * values while preserving all raw originals.
 *
 * @param {object} context - TravelContext with state.entities populated.
 * @returns {object} Engine Response Contract.
 */
function normalizeEntities(context) {
  const start = Date.now();
  const errors = [];
  const warnings = [];

  if (!context || typeof context !== "object") {
    errors.push("Invalid context: expected an object");
    return buildResponse(null, null, errors, warnings, start);
  }

  const entities = context.state?.entities ?? context.entities ?? null;

  if (!entities || typeof entities !== "object") {
    warnings.push("No entities found to normalize");
    return buildResponse(null, null, errors, warnings, start);
  }

  const destResult = normalizeDestination(entities.destination);
  const styleResult = normalizeTravelStyle(entities.travelStyle);
  const accResult = normalizeAccommodation(entities.accommodation);
  const transResult = normalizeTransport(entities.transport);
  const foodResult = normalizeFoodPreference(entities.foodPreference);
  const budgetResult = normalizeBudget(entities.budget);
  const durationResult = normalizeDuration(entities.durationDays, entities.rawDuration);
  const travelerResult = normalizeTravelers(entities.travelers, entities.rawTravelers);
  const dateResult = normalizeDate(entities.rawTravelDates ?? entities.travelDates);

  const normalized = {
    destination: destResult.value,
    budget: budgetResult.value,
    durationDays: durationResult.value,
    travelers: travelerResult.value,
    travelersType: entities.travelersType ?? null,
    interests: entities.interests,
    travelStyle: styleResult.value,
    accommodation: accResult.value,
    transport: transResult.value,
    foodPreference: foodResult.value,
    travelDates: dateResult.value,
  };

  const normalizations = [];
  if (destResult.normalized) normalizations.push("destination");
  if (styleResult.normalized) normalizations.push("travelStyle");
  if (accResult.normalized) normalizations.push("accommodation");
  if (transResult.normalized) normalizations.push("transport");
  if (foodResult.normalized) normalizations.push("foodPreference");
  if (durationResult.normalized) normalizations.push("durationDays");
  if (dateResult.normalized) normalizations.push("travelDates");

  return buildResponse(entities, normalized, errors, warnings, start, normalizations);
}

/**
 * Build the Engine Response Contract.
 *
 * @param {object|null} raw - Raw extracted entities (passed through).
 * @param {object|null} normalized - Canonical normalized values.
 * @param {string[]} errors
 * @param {string[]} warnings
 * @param {number} start
 * @param {string[]} [normalizations]
 * @returns {object}
 */
function buildResponse(raw, normalized, errors, warnings, start, normalizations) {
  const confidence = raw && normalized ? 1.0 : 0;

  if (normalizations && normalizations.length > 0) {
    warnings.push(`Normalized: ${normalizations.join(", ")}`);
  }

  return {
    success: !errors.length,
    data: {
      raw,
      normalized,
    },
    errors,
    warnings,
    confidence,
    processingTime: Date.now() - start,
    metadata: { module: "normalizer", normalizations: normalizations || [] },
  };
}

module.exports = { normalizeEntities };

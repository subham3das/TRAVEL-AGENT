/**
 * Deterministic Travel Validation Engine.
 *
 * Verifies that extracted and normalized trip information is realistic,
 * complete, and internally consistent before itinerary generation.
 * No LLM, no external APIs, no machine learning.
 *
 * @module validator
 */

const DESTINATION_MINIMUM_DAYS = {
  ladakh: 5,
  leh: 5,
  spiti: 6,
  sikkim: 5,
  meghalaya: 4,
  kerala: 4,
  rajasthan: 5,
  himachal: 4,
  manali: 3,
  shimla: 2,
  darjeeling: 2,
  goa: 2,
  munnar: 2,
  alleppey: 2,
  andaman: 4,
  lakshadweep: 3,
  kashmir: 4,
  varanasi: 2,
  agra: 1,
  delhi: 2,
  mumbai: 2,
  bangalore: 2,
  chennai: 2,
  kolkata: 2,
  paris: 3,
  london: 3,
  tokyo: 4,
  dubai: 3,
  singapore: 3,
  bangkok: 3,
  bali: 4,
  maldives: 3,
  switzerland: 4,
  thailand: 4,
  vietnam: 5,
  nepal: 5,
  bhutan: 4,
  sri_lanka: 5,
  usa: 5,
  australia: 5,
  europe: 5,
  italy: 4,
  spain: 4,
  greece: 4,
  egypt: 4,
  turkey: 4,
};

const DAILY_BUDGET_ESTIMATES = {
  budget: {
    india: 2000,
    se_asia: 2000,
    middle_east: 5000,
    europe: 8000,
    north_america: 8000,
    oceania: 8000,
    east_asia: 6000,
    south_america: 4000,
    africa: 4000,
    default: 3000,
  },
  mid: {
    india: 5000,
    se_asia: 5000,
    middle_east: 12000,
    europe: 20000,
    north_america: 20000,
    oceania: 20000,
    east_asia: 12000,
    south_america: 8000,
    africa: 8000,
    default: 8000,
  },
  luxury: {
    india: 15000,
    se_asia: 15000,
    middle_east: 30000,
    europe: 50000,
    north_america: 50000,
    oceania: 50000,
    east_asia: 30000,
    south_america: 20000,
    africa: 20000,
    default: 20000,
  },
};

const DESTINATION_REGIONS = {
  india: [
    "goa", "kerala", "meghalaya", "himachal", "manali", "shimla", "darjeeling",
    "sikkim", "assam", "rajasthan", "jaipur", "udaipur", "jaisalmer", "agra",
    "delhi", "mumbai", "bengaluru", "bangalore", "chennai", "kolkata",
    "hyderabad", "pune", "ahmedabad", "kashmir", "ladakh", "leh",
    "andaman", "lakshadweep", "coorg", "ooty", "munnar", "alleppey", "varkala",
    "pondicherry", "rishikesh", "varanasi", "amritsar", "khajuraho",
    "hampi", "badami", "ellora", "ajanta", "mahabalipuram", "konark",
    "puri", "gangtok", "pelling", "tawang", "shillong", "cherrapunji",
    "spiti", "dharamshala", "mcleodganj", "nainital", "mussoorie",
  ],
  se_asia: [
    "thailand", "bangkok", "phuket", "vietnam", "cambodia", "indonesia",
    "bali", "malaysia", "kuala lumpur", "philippines", "manila", "cebu",
    "singapore", "laos", "myanmar", "nepal", "bhutan", "sri lanka",
  ],
  middle_east: ["dubai", "turkey", "istanbul", "egypt", "morocco", "uae"],
  europe: [
    "europe", "italy", "rome", "venice", "france", "paris", "spain",
    "barcelona", "germany", "berlin", "netherlands", "amsterdam",
    "greece", "santorini", "switzerland", "norway", "sweden", "iceland",
    "uk", "london", "austria", "portugal",
  ],
  north_america: ["usa", "new york", "los angeles", "san francisco", "chicago", "canada", "toronto", "vancouver", "mexico", "cancun"],
  oceania: ["australia", "sydney", "melbourne", "new zealand", "queenstown"],
  east_asia: ["japan", "tokyo", "kyoto", "osaka", "south korea", "seoul", "china", "hong kong", "taiwan", "taipei"],
  south_america: ["brazil", "rio de janeiro", "peru", "argentina"],
  africa: ["south africa", "kenya", "tanzania", "morocco", "egypt"],
};

const CONFLICT_RULES = [
  {
    condition: (n) => n.travelStyle === "budget" && ["resort", "hotel"].includes(n.accommodation),
    message: "Budget travel style with resort/hotel accommodation may exceed planned costs",
    severity: "warning",
  },
  {
    condition: (n) => n.travelStyle === "luxury" && ["hostel", "camping"].includes(n.accommodation),
    message: "Luxury travel style conflicts with hostel/camping accommodation",
    severity: "warning",
  },
  {
    condition: (n) => n.travelStyle === "backpacking" && ["resort"].includes(n.accommodation),
    message: "Backpacking travel style with resort accommodation is unusual",
    severity: "info",
  },
  {
    condition: (n) => n.travelersType === "solo" && n.travelStyle === "romantic",
    message: "Solo travel conflicts with romantic/honeymoon travel style",
    severity: "warning",
  },
  {
    condition: (n) => n.travelersType === "solo" && n.accommodation === "resort",
    message: "Solo traveller at a resort may have higher per-person costs",
    severity: "info",
  },
  {
    condition: (n) => (n.travelersType === "family" || n.travelersType === "friends") && n.accommodation === "hostel",
    message: "Group travel may be better suited to hotels or homestays than hostels",
    severity: "info",
  },
  {
    condition: (n) => n.travelStyle === "business" && n.interests && containsInterest(n.interests, ["adventure", "trekking", "camping", "backpacking"]),
    message: "Business travel style with adventure/trekking interests is unusual",
    severity: "info",
  },
  {
    condition: (n) => n.foodPreference === "non-vegetarian" && n.travelStyle === "spiritual",
    message: "Spiritual travel style may align better with vegetarian food preferences",
    severity: "info",
  },
  {
    condition: (n) => n.transport === "flight" && n.durationDays && n.durationDays < 2,
    message: "Flight travel for less than 2 days may not be cost-effective",
    severity: "info",
  },
  {
    condition: (n) => n.transport === "bike" && n.durationDays && n.durationDays > 14,
    message: "Long-duration bike travel may require significant planning and rest stops",
    severity: "info",
  },
];

/**
 * Check if any of the given terms appear in the interests array.
 *
 * @param {string[]} interests
 * @param {string[]} terms
 * @returns {boolean}
 */
function containsInterest(interests, terms) {
  if (!Array.isArray(interests)) return false;
  return interests.some((i) => terms.includes(i));
}

/**
 * Resolve a destination to a region key for budget estimation.
 *
 * @param {string|null} destination
 * @returns {string}
 */
function resolveRegion(destination) {
  if (!destination) return "default";
  const lower = destination.toLowerCase();
  for (const [region, destinations] of Object.entries(DESTINATION_REGIONS)) {
    if (destinations.some((d) => lower.includes(d) || d.includes(lower))) return region;
  }
  return "default";
}

/**
 * Check required fields.
 *
 * @param {object} n - Normalized entities.
 * @returns {{ missingFields: string[], valid: boolean }}
 */
function validateRequired(n) {
  const missing = [];
  if (!n.destination) missing.push("destination");
  if (!n.durationDays && n.durationDays !== 0) missing.push("durationDays");
  if (!n.budget && n.budget !== 0) missing.push("budget");
  return { missingFields: missing, valid: missing.length === 0 };
}

/**
 * Estimate daily cost per person based on destination region and travel style.
 *
 * @param {string} region
 * @param {string|null} style
 * @returns {number}
 */
function estimateDailyCost(region, style) {
  const tier = style === "luxury" ? "luxury" : style === "backpacking" || style === "budget" ? "budget" : "mid";
  const regionKey = DAILY_BUDGET_ESTIMATES[tier][region];
  if (regionKey !== undefined) return regionKey;
  return DAILY_BUDGET_ESTIMATES[tier].default;
}

/**
 * Validate budget feasibility.
 *
 * @param {object} n - Normalized entities.
 * @returns {{ valid: boolean, recommendedMinimumBudget: number|null, message: string|null }}
 */
function validateBudget(n) {
  if (!n.budget || !n.durationDays || !n.travelers) {
    const dailyCost = n.destination ? estimateDailyCost(resolveRegion(n.destination), n.travelStyle) : 3000;
    const suggested = dailyCost * (n.durationDays || 3) * (n.travelers || 1);
    return { valid: true, recommendedMinimumBudget: suggested, message: null };
  }

  const region = resolveRegion(n.destination);
  const dailyCost = estimateDailyCost(region, n.travelStyle);
  const totalEstimated = dailyCost * n.durationDays * n.travelers;
  const buffer = Math.round(totalEstimated * 1.3);

  if (n.budget < totalEstimated) {
    return {
      valid: false,
      recommendedMinimumBudget: buffer,
      message: `Estimated cost ${totalEstimated} exceeds budget ${n.budget}. Recommended minimum: ${buffer}`,
    };
  }

  if (n.budget < buffer) {
    return {
      valid: true,
      recommendedMinimumBudget: buffer,
      message: `Budget is tight. Recommended minimum: ${buffer}`,
    };
  }

  return { valid: true, recommendedMinimumBudget: buffer, message: null };
}

/**
 * Validate duration feasibility.
 *
 * @param {object} n - Normalized entities.
 * @returns {{ valid: boolean, minimumRecommended: number|null, message: string|null }}
 */
function validateDuration(n) {
  if (!n.destination || !n.durationDays) {
    return { valid: true, minimumRecommended: null, message: null };
  }

  const lower = n.destination.toLowerCase();
  const key = lower.replace(/\s+/g, "_");
  const minimum = DESTINATION_MINIMUM_DAYS[key] || DESTINATION_MINIMUM_DAYS[lower] || 1;

  if (n.durationDays < minimum) {
    return {
      valid: false,
      minimumRecommended: minimum,
      message: `${n.destination} requires at least ${minimum} days. Requested: ${n.durationDays}`,
    };
  }

  return { valid: true, minimumRecommended: minimum, message: null };
}

/**
 * Detect logical conflicts between entity values.
 *
 * @param {object} n - Normalized entities.
 * @returns {Array<{ field: string, message: string, severity: string }>}
 */
function detectConflicts(n) {
  const conflicts = [];
  for (const rule of CONFLICT_RULES) {
    if (rule.condition(n)) {
      conflicts.push({
        field: "logical",
        message: rule.message,
        severity: rule.severity,
      });
    }
  }
  return conflicts;
}

/**
 * Validate date if present.
 *
 * @param {object} n - Normalized entities.
 * @returns {{ valid: boolean, message: string|null }}
 */
function validateDate(n) {
  if (!n.travelDates) return { valid: true, message: null };

  const isoMatch = typeof n.travelDates === "string" && n.travelDates.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoMatch) return { valid: true, message: null };

  const year = parseInt(isoMatch[1], 10);
  const month = parseInt(isoMatch[2], 10);
  const day = parseInt(isoMatch[3], 10);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return { valid: false, message: `Invalid date: ${n.travelDates}` };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today) {
    return { valid: false, message: `Travel date ${n.travelDates} is in the past` };
  }

  return { valid: true, message: null };
}

/**
 * Reads normalized entities from context and validates trip information.
 *
 * @param {object} context - TravelContext with state.normalizedEntities.
 * @returns {object} Engine Response Contract.
 */
function validateTrip(context) {
  const start = Date.now();
  const errors = [];
  const warnings = [];

  if (!context || typeof context !== "object") {
    errors.push("Invalid context: expected an object");
    return buildValidationResult(null, errors, warnings, start);
  }

  const normalized = context.state?.normalizedEntities ?? context.normalizedEntities ?? null;

  if (!normalized || typeof normalized !== "object") {
    warnings.push("No normalized entities found to validate");
    return buildValidationResult(null, errors, warnings, start);
  }

  const required = validateRequired(normalized);
  if (!required.valid) {
    warnings.push(`Missing required fields: ${required.missingFields.join(", ")}`);
  }

  const budgetCheck = validateBudget(normalized);
  if (budgetCheck.message) {
    warnings.push(budgetCheck.message);
  }

  const durationCheck = validateDuration(normalized);
  if (durationCheck.message) {
    warnings.push(durationCheck.message);
  }

  const conflicts = detectConflicts(normalized);
  for (const c of conflicts) {
    warnings.push(`[${c.severity}] ${c.message}`);
  }

  const dateCheck = validateDate(normalized);
  if (dateCheck.message) {
    warnings.push(dateCheck.message);
  }

  const validationItems = [
    required.valid,
    budgetCheck.valid,
    durationCheck.valid,
    dateCheck.valid,
    conflicts.filter((c) => c.severity === "warning").length === 0,
  ];
  const passedCount = validationItems.filter(Boolean).length;
  const confidence = parseFloat((passedCount / validationItems.length).toFixed(4));

  return {
    success: true,
    data: {
      validationStatus: required.valid && budgetCheck.valid && durationCheck.valid && dateCheck.valid ? "passed" : "flagged",
      missingFields: required.missingFields,
      validations: {
        required: required.valid,
        budgetFeasibility: budgetCheck.valid,
        durationFeasibility: durationCheck.valid,
        dateValid: dateCheck.valid,
        noConflicts: conflicts.filter((c) => c.severity === "warning").length === 0,
      },
      recommendations: buildRecommendations(normalized, required, budgetCheck, durationCheck, conflicts),
    },
    errors,
    warnings,
    confidence,
    processingTime: Date.now() - start,
    metadata: { module: "validator" },
  };
}

/**
 * Build actionable recommendations based on validation results.
 *
 * @param {object} n
 * @param {object} required
 * @param {object} budgetCheck
 * @param {object} durationCheck
 * @param {Array} conflicts
 * @returns {string[]}
 */
function buildRecommendations(n, required, budgetCheck, durationCheck, conflicts) {
  const recs = [];

  for (const field of required.missingFields) {
    recs.push(`Provide a ${field} for your trip`);
  }

  if (budgetCheck.recommendedMinimumBudget && !budgetCheck.valid) {
    recs.push(`Consider increasing your budget to at least ₹${budgetCheck.recommendedMinimumBudget}`);
  }

  if (durationCheck.minimumRecommended && !durationCheck.valid) {
    recs.push(`Extend your trip to at least ${durationCheck.minimumRecommended} days for ${n.destination}`);
  }

  for (const c of conflicts) {
    recs.push(`Resolve conflict: ${c.message}`);
  }

  if (!n.interests && n.destination) {
    recs.push("Add interests to help personalize your itinerary");
  }

  if (!n.travelStyle && n.destination) {
    recs.push("Specify a travel style (budget, luxury, backpacking, etc.)");
  }

  return recs;
}

/**
 * Build response for error / early-return cases.
 *
 * @param {object|null} data
 * @param {string[]} errors
 * @param {string[]} warnings
 * @param {number} start
 * @returns {object}
 */
function buildValidationResult(data, errors, warnings, start) {
  return {
    success: !errors.length,
    data: data || {
      validationStatus: "unvalidated",
      missingFields: [],
      validations: {},
      recommendations: [],
    },
    errors,
    warnings,
    confidence: 0,
    processingTime: Date.now() - start,
    metadata: { module: "validator" },
  };
}

module.exports = { validateTrip };

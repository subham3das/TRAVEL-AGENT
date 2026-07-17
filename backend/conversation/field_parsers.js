/**
 * Travel Intelligence OS - Field Parsers.
 *
 * Schema-based clarification value parsers.
 * Each field owns its own parser. No LLM needed for 90%+ of clarification values.
 *
 * @module field_parsers
 */

const MONTH_MAP = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
};

const STYLE_ALIASES = {
  budget: "budget", cheap: "budget", low: "budget", economy: "budget", backpacker: "budget",
  mid: "mid", moderate: "mid", medium: "mid", standard: "mid", normal: "mid",
  luxury: "luxury", premium: "luxury", high: "luxury", expensive: "luxury", "five star": "luxury", "5 star": "luxury"
};

const TRAVELER_ALIASES = {
  solo: "solo", alone: "solo", single: "solo", myself: "solo", "by myself": "solo", "just me": "solo",
  couple: "couple", "with partner": "couple", "with wife": "couple", "with husband": "couple",
  "with girlfriend": "couple", "with boyfriend": "couple", two: "couple", "2 people": "couple",
  family: "family", "with kids": "family", "with children": "family", "with family": "family",
  group: "group", friends: "group", "with friends": "group", team: "group"
};

const parsers = {
  /**
   * Parse date strings into { startDate: "YYYY-MM-DD" }
   */
  travelDates(input) {
    const clean = (input || "").trim().toLowerCase();
    if (!clean) return null;

    // ISO format: 2026-08-20
    const isoMatch = clean.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return { value: { startDate: isoMatch[0] } };

    // "20th august", "august 20", "20 aug", "aug 20th"
    const dateMonthMatch = clean.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i);
    const monthDateMatch = clean.match(/(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?/i);

    let day, monthStr;
    if (dateMonthMatch) {
      day = parseInt(dateMonthMatch[1]);
      monthStr = dateMonthMatch[2].toLowerCase();
    } else if (monthDateMatch) {
      monthStr = monthDateMatch[1].toLowerCase();
      day = parseInt(monthDateMatch[2]);
    }

    if (day && monthStr) {
      // Find full month name from prefix
      const monthKey = Object.keys(MONTH_MAP).find(k => monthStr.startsWith(k.substring(0, 3)));
      if (monthKey) {
        const month = MONTH_MAP[monthKey];
        const now = new Date();
        let year = now.getFullYear();
        const target = new Date(year, month, day);
        if (target < now) year++; // Next occurrence
        const mm = String(month + 1).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        return { value: { startDate: `${year}-${mm}-${dd}` } };
      }
    }

    // "next week", "next month", "tomorrow"
    const now = new Date();
    if (clean.includes("tomorrow")) {
      const d = new Date(now.getTime() + 86400000);
      return { value: { startDate: d.toISOString().split("T")[0] } };
    }
    if (clean.includes("next week")) {
      const d = new Date(now.getTime() + 7 * 86400000);
      return { value: { startDate: d.toISOString().split("T")[0] } };
    }
    if (clean.includes("next month")) {
      const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { value: { startDate: d.toISOString().split("T")[0] } };
    }

    return null; // Couldn't parse
  },

  /**
   * Parse travel style.
   */
  travelStyle(input) {
    const clean = (input || "").trim().toLowerCase();
    for (const [alias, style] of Object.entries(STYLE_ALIASES)) {
      if (clean.includes(alias)) return { value: style };
    }
    return null;
  },

  /**
   * Parse traveler type.
   */
  travelersType(input) {
    const clean = (input || "").trim().toLowerCase();

    // 1. Exact alias match (solo / couple / family / group + variants)
    for (const [alias, type] of Object.entries(TRAVELER_ALIASES)) {
      if (clean.includes(alias)) return { value: type };
    }

    // 2. Explicit head-count: "2 people", "3 pax", "4 adults", "5 guests"
    const countMatch = clean.match(/(\d+)\s*(people|pax|persons?|adults?|guests?|members?|friends|kids)/);
    if (countMatch) {
      const n = parseInt(countMatch[1], 10);
      if (n <= 1) return { value: "solo" };
      if (n === 2) return { value: "couple" };
      return { value: "group" };
    }

    // 3. "family of four" / "group of 5" phrasing
    if (clean.includes("family")) return { value: "family" };
    if (clean.includes("group")) return { value: "group" };

    return null;
  },

  /**
   * Parse duration.
   */
  durationDays(input) {
    const clean = (input || "").trim().toLowerCase();
    // "5 days", "5", "a week", "2 weeks", "10 day"
    const numMatch = clean.match(/(\d+)\s*(day|night)?/);
    if (numMatch) return { value: parseInt(numMatch[1]) };
    if (clean.includes("week")) {
      const weekMatch = clean.match(/(\d+)\s*week/);
      return { value: weekMatch ? parseInt(weekMatch[1]) * 7 : 7 };
    }
    return null;
  },

  /**
   * Parse budget.
   */
  budget(input) {
    const clean = (input || "").trim().toLowerCase().replace(/[,₹$\s]/g, "");
    // "10k", "15000", "10K"
    const kMatch = clean.match(/(\d+)k/i);
    if (kMatch) return { value: parseInt(kMatch[1]) * 1000 };
    const numMatch = clean.match(/(\d+)/);
    if (numMatch) return { value: parseInt(numMatch[1]) };
    return null;
  },

  /**
   * Parse destination.
   */
  destination(input) {
    const clean = (input || "").trim().toLowerCase();
    if (clean.length > 0 && clean.length < 50) {
      return { value: clean.replace(/[^a-z\s]/g, "").trim() };
    }
    return null;
  }
};

/**
 * Parse a clarification field value deterministically.
 * @param {string} field - field name (e.g. "travelDates", "budget")
 * @param {string} input - user's raw input
 * @returns {{ value: any } | null} - parsed value or null if unparseable
 */
function parseField(field, input) {
  const parser = parsers[field];
  if (!parser) return null;
  try {
    return parser(input);
  } catch {
    return null;
  }
}

module.exports = { parseField, parsers };

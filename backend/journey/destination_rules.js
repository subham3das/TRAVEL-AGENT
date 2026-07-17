/**
 * Travel OS — Destination Rules
 *
 * Static knowledge about destinations that the inference engine uses.
 * NOT the Knowledge Graph — this is metadata about what's NEEDED for a trip.
 *
 * Each rule answers: "If a user goes to THIS destination, what do they NEED?"
 */

"use strict";

const DESTINATION_RULES = {
  // ── India (Domestic) ───────────────────────────────────────────────
  india: {
    type: "domestic",
    country: "india",
    currency: { code: "INR", symbol: "₹", name: "Indian Rupee" },
    visa: { required: false, type: null, notes: "Domestic — no visa needed" },
    language: ["Hindi", "English", "Regional"],
    transport: {
      intercity: ["flight", "train", "bus"],
      local: ["taxi", "auto", "metro", "bike"],
      railPass: null,
      drivingLicense: "Indian license valid"
    },
    timezone: "Asia/Kolkata",
    bestSeason: { beach: "Oct-Mar", mountains: "Mar-Jun", heritage: "Oct-Mar" },
    emergencyNumber: "112",
    plugType: "C/D/M",
    safetyTips: ["Carry cash for rural areas", "Negotiate auto fares"]
  },

  // ── Japan ──────────────────────────────────────────────────────────
  japan: {
    type: "international",
    country: "japan",
    currency: { code: "JPY", symbol: "¥", name: "Japanese Yen" },
    visa: { required: true, type: "tourist_visa", processingDays: 5, notes: "Visa required for most nationalities" },
    language: ["Japanese", "Limited English"],
    transport: {
      intercity: ["flight", "shinkansen", "bus"],
      local: ["train", "subway", "taxi", "bus"],
      railPass: { name: "JR Pass", recommended: true, duration: "7/14/21 days", note: "Unlimited JR trains including Shinkansen" },
      icCard: { name: "Suica/Pasmo", note: "Rechargeable transit card for local trains/buses" },
      drivingLicense: "International Driving Permit required"
    },
    timezone: "Asia/Tokyo",
    bestSeason: { general: "Mar-May (Cherry Blossom), Oct-Nov (Autumn)", beaches: "Jul-Aug" },
    emergencyNumber: "110 (Police), 119 (Fire/Ambulance)",
    plugType: "A/B",
    safetyTips: ["Carry cash — many places don't accept cards", "Learn basic Japanese phrases", "Shoes off in temples/homes"]
  },

  // ── Thailand ───────────────────────────────────────────────────────
  thailand: {
    type: "international",
    country: "thailand",
    currency: { code: "THB", symbol: "฿", name: "Thai Baht" },
    visa: { required: false, type: "visa_on_arrival", duration: "30 days", notes: "Visa-free for many nationalities" },
    language: ["Thai", "English in tourist areas"],
    transport: {
      intercity: ["flight", "train", "bus"],
      local: ["taxi", "tuk-tuk", "motorbike", "bts_skytrain", "boat"],
      railPass: null,
      drivingLicense: "International Driving Permit for motorbikes"
    },
    timezone: "Asia/Bangkok",
    bestSeason: { general: "Nov-Mar", beaches: "Nov-Apr" },
    emergencyNumber: "191 (Police), 1669 (Medical)",
    plugType: "A/B/C",
    safetyTips: ["Remove shoes before entering temples", "Respect the monarchy", "Bargain at markets"]
  },

  // ── Nepal ──────────────────────────────────────────────────────────
  nepal: {
    type: "international",
    country: "nepal",
    currency: { code: "NPR", symbol: "रू", name: "Nepalese Rupee" },
    visa: { required: true, type: "visa_on_arrival", duration: "15/30/90 days", notes: "Visa on arrival available at airport" },
    language: ["Nepali", "English"],
    transport: {
      intercity: ["flight", "bus", "jeep"],
      local: ["taxi", "auto", "motorbike"],
      railPass: null,
      drivingLicense: "International Driving Permit"
    },
    timezone: "Asia/Kathmandu",
    bestSeason: { trekking: "Oct-Nov, Mar-May", general: "Oct-May" },
    emergencyNumber: "100 (Police), 102 (Ambulance)",
    plugType: "C/D/M",
    safetyTips: ["Altitude sickness prevention for treks", "Carry Nepali rupees for rural areas"]
  },

  // ── Sri Lanka ──────────────────────────────────────────────────────
  sriLanka: {
    type: "international",
    country: "sriLanka",
    currency: { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee" },
    visa: { required: true, type: "eta", duration: "30 days", notes: "Electronic Travel Authorization required" },
    language: ["Sinhala", "Tamil", "English"],
    transport: {
      intercity: ["flight", "train", "bus"],
      local: ["tuk-tuk", "taxi", "bus"],
      railPass: null,
      drivingLicense: "International Driving Permit"
    },
    timezone: "Asia/Colombo",
    bestSeason: { general: "Dec-Mar (West Coast), May-Sep (East Coast)" },
    emergencyNumber: "119 (Police), 110 (Ambulance)",
    plugType: "D/G",
    safetyTips: ["Carry mosquito repellent", "Respect Buddhist temples"]
  },

  // ── Dubai/UAE ──────────────────────────────────────────────────────
  dubai: {
    type: "international",
    country: "uae",
    currency: { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
    visa: { required: true, type: "tourist_visa", processingDays: 3, notes: "Visa required for most nationalities" },
    language: ["Arabic", "English widely spoken"],
    transport: {
      intercity: ["flight", "bus"],
      local: ["taxi", "metro", "tram", "bus"],
      railPass: null,
      drivingLicense: "International Driving Permit or GCC license"
    },
    timezone: "Asia/Dubai",
    bestSeason: { general: "Nov-Mar", summer: "Jun-Aug (extreme heat)" },
    emergencyNumber: "999 (Police), 998 (Ambulance)",
    plugType: "G",
    safetyTips: ["Dress modestly in public areas", "No public drinking", "Respect local customs"]
  },

  // ── Europe (Generic) ───────────────────────────────────────────────
  europe: {
    type: "international",
    region: "europe",
    currency: { code: "EUR", symbol: "€", name: "Euro" },
    visa: { required: true, type: "schengen", processingDays: 15, notes: "Schengen visa for 26 European countries" },
    language: ["English", "Local language"],
    transport: {
      intercity: ["flight", "train", "bus"],
      local: ["train", "metro", "bus", "taxi", "bike"],
      railPass: { name: "Eurail Pass", recommended: true, note: "Unlimited train travel across Europe" },
      drivingLicense: "International Driving Permit"
    },
    timezone: "Europe/Berlin",
    bestSeason: { general: "Apr-Oct", winter: "Dec-Mar (skiing)" },
    emergencyNumber: "112 (EU-wide)",
    plugType: "C/F",
    safetyTips: ["Pickpocket awareness in tourist areas", "Carry euros for small shops"]
  },

  // ── USA ────────────────────────────────────────────────────────────
  usa: {
    type: "international",
    country: "usa",
    currency: { code: "USD", symbol: "$", name: "US Dollar" },
    visa: { required: true, type: "b1/b2", processingDays: 30, notes: "Tourist visa interview required" },
    language: ["English"],
    transport: {
      intercity: ["flight", "bus", "train"],
      local: ["rental_car", "uber_lyft", "metro", "bus"],
      railPass: { name: "Amtrak Pass", recommended: false, note: "Limited rail network" },
      drivingLicense: "International Driving Permit recommended"
    },
    timezone: "America/New_York",
    bestSeason: { general: "Mar-Oct", summer: "Jun-Aug", winter: "Dec-Feb (skiing)" },
    emergencyNumber: "911",
    plugType: "A/B",
    safetyTips: ["Health insurance essential", "Tipping culture (15-20%)", "Carry ID at all times"]
  }
};

/**
 * Infer destination rules from a destination name/id.
 */
function getDestinationRules(destination) {
  if (!destination) return null;
  const key = String(destination).toLowerCase().replace(/[^a-z]/g, "");

  // Direct match
  if (DESTINATION_RULES[key]) return DESTINATION_RULES[key];

  // Partial match
  for (const [ruleKey, rule] of Object.entries(DESTINATION_RULES)) {
    if (key.includes(ruleKey) || ruleKey.includes(key)) return rule;
  }

  // Default: assume domestic India if no match
  return DESTINATION_RULES.india;
}

/**
 * Check if a destination is international (needs passport/visa).
 */
function isInternational(destination) {
  const rules = getDestinationRules(destination);
  return rules?.type === "international";
}

/**
 * Get all required items for a destination.
 */
function getRequiredItems(destination) {
  const rules = getDestinationRules(destination);
  if (!rules) return [];

  const items = [];

  items.push({ id: "hotel", type: "logistics", required: true, reason: "Accommodation needed for overnight stays" });
  items.push({ id: "transport", type: "logistics", required: true, reason: "Local transport to get around" });

  if (rules.type === "international") {
    items.push({ id: "flight", type: "logistics", required: true, reason: "International flight required" });
    if (rules.visa?.required) {
      items.push({ id: "visa", type: "document", required: true, reason: rules.visa.notes });
    }
    items.push({ id: "currency", type: "finance", required: true, reason: `Need ${rules.currency.name} for local expenses` });
  } else {
    items.push({ id: "flight", type: "logistics", required: false, reason: "Optional — depends on origin city" });
    items.push({ id: "train", type: "logistics", required: false, reason: "Alternative to flights for domestic travel" });
  }

  if (rules.transport?.railPass) {
    items.push({ id: "railpass", type: "document", required: false, reason: rules.transport.railPass.note });
  }

  items.push({ id: "weather", type: "info", required: true, reason: "Pack appropriately" });
  items.push({ id: "attractions", type: "planning", required: true, reason: "Plan activities for each day" });
  items.push({ id: "packing", type: "info", required: false, reason: "Weather-appropriate clothing" });

  return items;
}

module.exports = { DESTINATION_RULES, getDestinationRules, isInternational, getRequiredItems };

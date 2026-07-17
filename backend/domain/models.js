/**
 * Travel OS — Domain Models
 *
 * Single source of truth for all domain objects.
 * Every engine, repository, and provider works on these types.
 * Prevents: HotelCandidate / HotelNode / HotelDTO / HotelResponse proliferation.
 *
 * Rules:
 * - No business logic here. Pure data shapes + factories.
 * - Engines receive domain objects. Engines return domain objects.
 * - Providers map their API output → domain objects before returning.
 */

"use strict";

// ─── Destination ──────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Destination
 * @property {string}   id
 * @property {string}   name
 * @property {string}   country
 * @property {string}   [region]
 * @property {{lat:number,lon:number}} [coordinates]
 * @property {string[]} [seasons]       - e.g. ["Oct","Nov","Dec"]
 * @property {string}   [timezone]
 * @property {string}   [description]
 * @property {string[]} [images]
 */
function Destination(partial = {}) {
  return {
    id:          partial.id          || "",
    name:        partial.name        || "",
    country:     partial.country     || "India",
    region:      partial.region      || null,
    coordinates: partial.coordinates || null,
    seasons:     partial.seasons     || [],
    timezone:    partial.timezone    || "Asia/Kolkata",
    description: partial.description || "",
    images:      partial.images      || []
  };
}

// ─── Hotel ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Hotel
 * @property {string}   id
 * @property {string}   name
 * @property {string}   [location]
 * @property {number}   [stars]         1-5
 * @property {string[]} [amenities]
 * @property {string[]} [images]
 * @property {string}   [description]
 * @property {boolean}  [familyFriendly]
 * @property {boolean}  [pool]
 * @property {boolean}  [wifi]
 * @property {string}   [beachDistance] e.g. "200m"
 * @property {boolean}  [petFriendly]
 * @property {string}   [priceRange]    "₹3,000–₹8,000/night" — static label, not a number
 * @property {number}   [rating]        0-5
 * @property {string}   [source]        "knowledge_graph" | "search_layer"
 * @property {number}   [confidence]    0-1
 */
function Hotel(partial = {}) {
  return {
    id:             partial.id             || "",
    name:           partial.name           || "",
    location:       partial.location       || null,
    stars:          partial.stars          || null,
    amenities:      partial.amenities      || [],
    images:         partial.images         || (partial.image ? [partial.image] : []),
    description:    partial.description    || partial.shortDescription || "",
    familyFriendly: partial.familyFriendly || false,
    pool:           partial.pool           || false,
    wifi:           partial.wifi           !== false,   // default true
    beachDistance:  partial.beachDistance  || null,
    petFriendly:    partial.petFriendly    || false,
    priceRange:     partial.priceRange     || null,     // NEVER a bare number
    rating:         partial.rating         || null,
    source:         partial.source         || "unknown",
    confidence:     partial.confidence     || 0
  };
}

// ─── Flight ───────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Flight
 * @property {string}  id
 * @property {string}  airline
 * @property {string}  [flightNumber]
 * @property {string}  origin
 * @property {string}  destination
 * @property {string}  [duration]      "2h 10m"
 * @property {number}  [stops]         0 = direct
 * @property {string}  [departureTime]
 * @property {string}  [arrivalTime]
 * @property {string}  [class]         "economy" | "business" | "first"
 * @property {string}  [priceLabel]    "₹5,890" — display only
 * @property {string}  [source]
 * @property {number}  [confidence]
 */
function Flight(partial = {}) {
  return {
    id:            partial.id            || "",
    airline:       partial.airline       || partial.name || "",
    flightNumber:  partial.flightNumber  || null,
    origin:        partial.origin        || null,
    destination:   partial.destination   || null,
    duration:      partial.duration      || null,
    stops:         typeof partial.stops === "number" ? partial.stops : null,
    departureTime: partial.departureTime || partial.departure || null,
    arrivalTime:   partial.arrivalTime   || null,
    class:         partial.class         || "economy",
    priceLabel:    partial.priceLabel    || partial.price || null,
    source:        partial.source        || "unknown",
    confidence:    partial.confidence    || 0
  };
}

// ─── Activity ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Activity
 * @property {string}  id
 * @property {string}  name
 * @property {string}  [type]       "attraction" | "restaurant" | "experience"
 * @property {string}  [location]
 * @property {string}  [duration]   "2-3 hours"
 * @property {string}  [difficulty] "easy" | "moderate" | "hard"
 * @property {string}  [priceLabel] display string
 * @property {string}  [openingHours]
 * @property {number}  [rating]
 * @property {string}  [description]
 * @property {string[]} [images]
 * @property {string}  [source]
 * @property {number}  [confidence]
 */
function Activity(partial = {}) {
  return {
    id:           partial.id           || "",
    name:         partial.name         || "",
    type:         partial.type         || partial.category || "attraction",
    location:     partial.location     || null,
    duration:     partial.duration     || partial.recommendedDuration || null,
    difficulty:   partial.difficulty   || "easy",
    priceLabel:   partial.priceLabel   || partial.ticketPrice || null,
    openingHours: partial.openingHours || null,
    rating:       partial.rating       || null,
    description:  partial.description  || partial.shortDescription || "",
    images:       partial.images       || (partial.image ? [partial.image] : []),
    source:       partial.source       || "unknown",
    confidence:   partial.confidence   || 0
  };
}

// ─── BudgetEstimate ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} BudgetEstimate
 * @property {number} minimum
 * @property {number} comfortable
 * @property {number} luxury
 * @property {{stays:number,activities:number,dining:number,transit:number}} breakdown
 * @property {number} confidence    0-1
 * @property {string} generatedAt   ISO timestamp
 */
function BudgetEstimate(partial = {}) {
  return {
    minimum:     partial.minimum     || partial.minimumRequired || 0,
    comfortable: partial.comfortable || 0,
    luxury:      partial.luxury      || 0,
    breakdown:   partial.breakdown   || { stays: 0, activities: 0, dining: 0, transit: 0 },
    confidence:  partial.confidence  || 0,
    generatedAt: partial.generatedAt || new Date().toISOString()
  };
}

// ─── Candidate ────────────────────────────────────────────────────────────────

/**
 * Unified selection card — used for Hotels, Flights, Activities.
 * Frontend renders one component regardless of type.
 *
 * @typedef {Object} Candidate
 * @property {string}  id
 * @property {string}  name
 * @property {string}  type         "hotel" | "flight" | "activity" | "restaurant"
 * @property {string[]} images
 * @property {string}  description
 * @property {string}  [priceLabel] display string
 * @property {number}  [rating]
 * @property {string}  [location]
 * @property {number|object}  confidence   0-1 or { score, level, reason, factors }
 * @property {string}  source       "knowledge_graph" | "search_layer" | "user_history"
 * @property {string}  reason       Why recommended
 * @property {object}  [raw]        Original domain object (Hotel, Flight, Activity)
 */
function Candidate(partial = {}) {
  return {
    id:          partial.id          || "",
    name:        partial.name        || "",
    type:        partial.type        || "unknown",
    images:      partial.images      || (partial.image ? [partial.image] : []),
    description: partial.description || "",
    priceLabel:  partial.priceLabel  || partial.price || null,
    rating:      partial.rating      || null,
    location:    partial.location    || null,
    confidence:  partial.confidence  || 0,
    source:      partial.source      || "unknown",
    reason:      partial.reason      || partial.explanation || partial.whyRecommended || "",
    reasons:     partial.reasons     || [],
    tradeoffs:   partial.tradeoffs   || [],
    alternatives: partial.alternatives || [],
    scoreBreakdown: partial.scoreBreakdown || null,
    raw:         partial.raw         || null
  };
}

// ─── Trip ─────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Trip
 * @property {string}      id
 * @property {Destination} destination
 * @property {Hotel}       [hotel]
 * @property {Flight[]}    [flights]
 * @property {Activity[]}  [activities]
 * @property {number}      durationDays
 * @property {string}      travellers   "solo" | "couple" | "family" | "group"
 * @property {string}      style        "budget" | "mid" | "premium"
 * @property {BudgetEstimate} [budgetEstimate]
 * @property {object[]}    [dailyPlan]
 */
function Trip(partial = {}) {
  return {
    id:             partial.id             || `trip-${Date.now()}`,
    destination:    partial.destination    || null,
    hotel:          partial.hotel          || null,
    flights:        partial.flights        || [],
    activities:     partial.activities     || [],
    durationDays:   partial.durationDays   || 0,
    travellers:     partial.travellers     || partial.travelersType || "solo",
    style:          partial.style          || partial.travelStyle || "mid",
    budgetEstimate: partial.budgetEstimate || null,
    dailyPlan:      partial.dailyPlan      || []
  };
}

// ─── JourneyState ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} JourneyState
 * @property {string}   stage             Current stage name
 * @property {string[]} completedStages
 * @property {string[]} missingFields
 * @property {string}   [blockedAt]       Stage name that requested clarification
 * @property {boolean}  readyForPlanning
 */
function JourneyState(partial = {}) {
  return {
    stage:            partial.stage            || "START",
    completedStages:  partial.completedStages  || [],
    missingFields:    partial.missingFields     || [],
    blockedAt:        partial.blockedAt         || null,
    readyForPlanning: partial.readyForPlanning  || false
  };
}

// ─── TravelProfile ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} TravelProfile
 * @property {string}   userId
 * @property {string}   [travelStyle]
 * @property {object}   [budgetBehaviour]   {average, max, min}
 * @property {string[]} [preferredAirlines]
 * @property {string[]} [preferredHotelChains]
 * @property {string[]} [favouriteDestinations]
 * @property {object}   [foodPreferences]
 * @property {object}   [accessibility]
 * @property {string[]} [travelCompanions]
 * @property {object[]} [pastTrips]
 * @property {string[]} [rejectedHotels]
 * @property {string[]} [rejectedPlaces]
 * @property {string[]} [acceptedPlaces]
 * @property {object}   [rankingWeights]    From Learning Engine
 */
function TravelProfile(partial = {}) {
  return {
    userId:                 partial.userId                 || "anonymous",
    travelStyle:            partial.travelStyle            || null,
    budgetBehaviour:        partial.budgetBehaviour        || { average: 0, max: 0, min: 0 },
    preferredAirlines:      partial.preferredAirlines      || [],
    preferredHotelChains:   partial.preferredHotelChains   || [],
    favouriteDestinations:  partial.favouriteDestinations  || [],
    foodPreferences:        partial.foodPreferences        || {},
    accessibility:          partial.accessibility          || {},
    travelCompanions:       partial.travelCompanions       || [],
    pastTrips:              partial.pastTrips              || [],
    rejectedHotels:         partial.rejectedHotels         || [],
    rejectedPlaces:         partial.rejectedPlaces         || [],
    acceptedPlaces:         partial.acceptedPlaces         || [],
    rankingWeights:         partial.rankingWeights         || {}
  };
}

// ─── SearchResult ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SearchResult
 * @property {string}   schemaVersion
 * @property {string}   requestId
 * @property {string}   generatedAt
 * @property {string}   id
 * @property {string}   type            - "hotel" | "flight" | "activity" | "restaurant" | "weather"
 * @property {string}   source
 * @property {string}   title
 * @property {string}   [subtitle]
 * @property {string}   [location]
 * @property {{latitude:number,longitude:number}} [coordinates]
 * @property {string[]} images
 * @property {{price:number,currency:string,label:string}} pricing
 * @property {{status:string,source:string,metadata:object}} availability
 * @property {{score:number,reason:string,verifiedAt:string,source:string}} confidence
 * @property {object}   metadata
 */
function SearchResult(partial = {}) {
  return {
    schemaVersion: "1.0",
    requestId:     partial.requestId     || "",
    generatedAt:   partial.generatedAt   || new Date().toISOString(),
    id:            partial.id            || "",
    type:          partial.type          || "unknown",
    source:        partial.source        || "search_layer",
    title:         partial.title         || partial.name || "",
    subtitle:      partial.subtitle      || "",
    location:      partial.location      || null,
    coordinates:   partial.coordinates   || null,
    images:        partial.images        || [],
    pricing:       partial.pricing       || { price: 0, currency: "INR", label: "" },
    availability:  partial.availability  || { status: "available", source: "unknown", metadata: {} },
    confidence:    partial.confidence    || { score: 0.9, reason: "Default", verifiedAt: new Date().toISOString(), source: "default" },
    metadata:      partial.metadata      || {}
  };
}

// ─── ProviderResult ───────────────────────────────────────────────────────────

/**
 * Raw data shape returned directly from providers before being merged or normalized.
 * Keeps provider implementations totally decoupled.
 *
 * @typedef {Object} ProviderResult
 * @property {string} id
 * @property {string} provider
 * @property {string} type
 * @property {number} price
 * @property {string} [currency]
 * @property {string} [status]
 * @property {object} details
 */
function ProviderResult(partial = {}) {
  return {
    id:       partial.id       || "",
    provider: partial.provider || "",
    type:     partial.type     || "",
    price:    partial.price    || 0,
    currency: partial.currency || "INR",
    status:   partial.status   || "available",
    details:  partial.details  || {}
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  Destination,
  Hotel,
  Flight,
  Activity,
  BudgetEstimate,
  Candidate,
  Trip,
  JourneyState,
  TravelProfile,
  SearchResult,
  ProviderResult
};

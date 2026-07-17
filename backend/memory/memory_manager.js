/**
 * Travel OS — Memory Manager
 *
 * Orchestrator that owns all three memory layers:
 *   1. Permanent Memory — user preferences, never expires
 *   2. Trip Memory — past trip records, structured
 *   3. Session Memory — volatile, per-request
 *
 * RULE: Never mix layers. Each layer has its own storage and lifecycle.
 *
 * Usage:
 *   const memoryManager = require("./memory/memory_manager");
 *
 *   // Load all memory into context
 *   memoryManager.loadContext(context);
 *
 *   // Save permanent preferences
 *   memoryManager.permanent.updatePreference(userId, "hotelStyle", "luxury");
 *
 *   // Record a trip
 *   memoryManager.trips.addTrip(userId, { destination: "Goa", ... });
 *
 *   // Session working data
 *   memoryManager.session.setBudget(sessionId, 50000);
 */

"use strict";

const permanentMemory = require("./permanent_memory");
const tripMemory = require("./trip_memory");
const sessionMemory = require("./session_memory");
const eventBus = require("../events/event_bus");

class MemoryManager {
  constructor() {
    this.permanent = permanentMemory;
    this.trips = tripMemory;
    this.session = sessionMemory;
  }

  /**
   * Load all memory layers into the context object.
   * Called by MemoryStage at pipeline start.
   *
   * Populates:
   *   context.permanentMemory  — the full permanent memory record
   *   context.tripMemory       — all past trips
   *   context.sessionMemory    — current session data
   *   context.travelProfile    — backward-compatible TravelProfile shape
   *   context.user.preferences — alias for travelProfile
   */
  loadContext(context) {
    const userId = context.userId || context.state?.userId || "anonymous";
    const sessionId = context.sessionId || "default-session";

    // 1. Load Permanent Memory
    const permanent = this.permanent.load(userId);
    context.permanentMemory = permanent;

    // 2. Load Trip Memory
    const tripData = this.trips.load(userId);
    context.tripMemory = tripData;
    context.tripSummary = this.trips.summarize(userId);

    // 3. Load or create Session Memory
    const session = this.session.getOrCreate(sessionId);
    context.sessionMemory = session;

    // 4. Backward-compatible TravelProfile (merged from permanent memory)
    context.travelProfile = this._buildProfile(permanent, tripData);
    if (!context.user) context.user = {};
    context.user.preferences = context.travelProfile;

    return context;
  }

  /**
   * Save permanent memory changes.
   * Called by MemoryStage.finalize() or LearningEngine.
   */
  savePermanent(userId) {
    const permanent = this.permanent.load(userId);
    return permanent;
  }

  /**
   * Record a completed trip.
   */
  recordTrip(userId, tripData) {
    return this.trips.addTrip(userId, tripData);
  }

  /**
   * Learn from a user event (accept/reject).
   * Writes to PermanentMemory.learnings.
   */
  learn(userId, eventType, value) {
    const weightMap = {
      "REJECT_AIRLINE":      { list: "rejectedAirlines",  weight: -30, key: `airline:${value}` },
      "ACCEPT_AIRLINE":      { list: "acceptedAirlines",  weight: +15, key: `airline:${value}` },
      "REJECT_HOTEL_CHAIN":  { list: "rejectedChains",    weight: -25, key: `chain:${value}` },
      "ACCEPT_HOTEL_CHAIN":  { list: "acceptedChains",    weight: +20, key: `chain:${value}` },
      "REJECT_PLACE":        { list: "rejectedPlaces",    weight: -30, key: `place:${value}` },
      "ACCEPT_PLACE":        { list: "acceptedPlaces",    weight: +25, key: `place:${value}` },
      "ADD_PLACE_CATEGORY":  { list: null,                weight: +10, key: `category:${value}` },
      "BUDGET_OVERSPENT":    { list: null,                weight: -5,  key: `budget:overspent` },
      "BUDGET_UNDERSPENT":   { list: null,                weight: +5,  key: `budget:underspent` },
      "PLANNER_EDIT":        { list: null,                weight: +8,  key: `preference:edited` }
    };

    const mapping = weightMap[eventType];
    if (!mapping) return false;

    // Adjust ranking weight (with normalization to prevent unbounded growth)
    this.permanent.adjustWeight(userId, mapping.key, mapping.weight);

    // Track in accept/reject list
    if (mapping.list) {
      if (eventType.startsWith("ACCEPT")) {
        this.permanent.accept(userId, mapping.list.replace("accepted", "").toLowerCase(), value);
      } else {
        this.permanent.reject(userId, mapping.list.replace("rejected", "").toLowerCase(), value);
      }
    }

    return true;
  }

  /**
   * Get boost score for a candidate (replaces LearningEngine.getBoost).
   */
  getBoost(userId, item) {
    const permanent = this.permanent.load(userId);
    const weights = permanent.learnings.rankingWeights || {};
    let boost = 0;

    const id = String(item.id || "").toLowerCase();
    const type = String(item.type || "").toLowerCase();

    // Specific place
    if (weights[`place:${id}`]) boost += weights[`place:${id}`];

    // Hotel chain
    if (type === "hotel") {
      const name = String(item.name || "").toLowerCase();
      const chains = ["taj", "marriott", "hyatt", "hilton", "sheraton", "novotel", "ibis", "radisson"];
      for (const chain of chains) {
        if (name.includes(chain) && weights[`chain:${chain}`]) {
          boost += weights[`chain:${chain}`];
        }
      }
    }

    // Airline
    if (type === "flight") {
      const airline = String(item.airline || "").toLowerCase();
      if (weights[`airline:${airline}`]) boost += weights[`airline:${airline}`];
    }

    // Category
    const category = String(item.category || item.type || "").toLowerCase();
    if (weights[`category:${category}`]) boost += weights[`category:${category}`];

    return boost;
  }

  /**
   * Build backward-compatible TravelProfile from permanent memory.
   */
  _buildProfile(permanent, tripData) {
    const prefs = permanent.preferences || {};
    const learnings = permanent.learnings || {};

    return {
      userId: permanent.userId,
      travelStyle: prefs.hotelStyle || "mid",
      budgetBehaviour: prefs.budget || { average: 0, max: 0, min: 0 },
      preferredAirlines: prefs.airline || [],
      preferredHotelChains: prefs.accommodation?.chain || [],
      favouriteDestinations: (tripData.trips || []).map(t => t.destination).filter(Boolean),
      foodPreferences: prefs.food || {},
      accessibility: prefs.accessibility || {},
      travelCompanions: [],
      pastTrips: (tripData.trips || []).map(t => ({
        destination: t.destination,
        duration: t.durationDays,
        highlights: t.highlights,
        dislikes: t.dislikes
      })),
      rejectedHotels: learnings.rejectedChains || [],
      rejectedPlaces: learnings.rejectedPlaces || [],
      acceptedPlaces: learnings.acceptedPlaces || [],
      rankingWeights: learnings.rankingWeights || {}
    };
  }
}

module.exports = new MemoryManager();

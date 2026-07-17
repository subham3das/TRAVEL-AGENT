/**
 * Travel OS — Trip Manager
 *
 * Pipeline stage that manages the trip lifecycle:
 *   1. Persists the generated plan to trip memory
 *   2. Tracks trip status (DRAFT → FINALIZED → BOOKED → COMPLETED)
 *   3. Triggers learning from completed trips
 *   4. Generates trip summary metadata
 *
 * Position: After Booking Engine, Before Response Composer.
 */

"use strict";

const memoryManager = require("../memory/memory_manager");
const tripLearner = require("../learning/trip_learner");
const eventBus = require("../events/event_bus");

const TRIP_STATUS = {
  DRAFT: "DRAFT",
  FINALIZED: "FINALIZED",
  BOOKED: "BOOKED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
};

class TripManager {
  /**
   * Pipeline run method.
   * Persists the trip, triggers learning, generates summary.
   * @param {object} context - TravelContext
   * @returns {object} response envelope
   */
  run(context) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      const userId = context.userId || context.state?.userId || "anonymous";
      const sessionId = context.sessionId || "default-session";
      const entities = context.state?.normalizedEntities || {};
      const recs = context.recommendations || {};

      // 1. Determine trip status
      const intent = context.state?.intent || "PLAN_TRIP";
      const status = intent === "BOOK_TRIP" ? TRIP_STATUS.BOOKED : TRIP_STATUS.DRAFT;

      // 2. Extract trip data from pipeline outputs
      const itinerary = recs.optimizedItinerary || recs.improvedItinerary || recs.draftItinerary || null;
      const budget = recs.budgetSummary || null;
      const booking = recs.bookingSuggestions || null;
      const candidates = recs.candidates || [];

      // 3. Build trip record
      const tripRecord = this.buildTripRecord({
        userId,
        entities,
        itinerary,
        budget,
        booking,
        candidates,
        status
      });

      // 4. Persist to trip memory
      if (tripRecord.destination) {
        memoryManager.recordTrip(userId, tripRecord);
      }

      // 5. Learn from the trip (if there's enough data)
      const profile = context.travelProfile || context.user?.preferences || {};
      const learningEvents = this.triggerLearning(userId, tripRecord, profile, context);

      // 6. Save memory changes
      memoryManager.savePermanent(userId);

      // 7. Generate trip summary
      const tripSummary = this.generateSummary(tripRecord, itinerary, budget, learningEvents);

      // 8. Emit event
      if (sessionId) {
        eventBus.emitEvent(sessionId, "TRIP_MANAGED", {
          tripId: tripRecord.tripId,
          status: tripRecord.status,
          learningEventsApplied: learningEvents.length
        });
      }

      return {
        success: true,
        data: {
          tripId: tripRecord.tripId,
          status: tripRecord.status,
          tripRecord,
          tripSummary,
          learningEvents
        },
        errors,
        warnings,
        confidence: 1.0,
        processingTime: Date.now() - startTime,
        metadata: { stage: "TRIP_MANAGER" }
      };

    } catch (err) {
      errors.push(err.message);
      return {
        success: false,
        data: null,
        errors,
        warnings,
        confidence: 0,
        processingTime: Date.now() - startTime,
        metadata: { stage: "TRIP_MANAGER" }
      };
    }
  }

  /**
   * Build a trip record from pipeline outputs.
   */
  buildTripRecord({ userId, entities, itinerary, budget, booking, candidates, status }) {
    const destination = entities.destination || itinerary?.destination || "Unknown";
    const durationDays = entities.durationDays || itinerary?.durationDays || 0;

    // Extract hotel from candidates or itinerary
    let hotel = null;
    const hotelCandidate = candidates.find(c => c.type === "hotel" || c.raw?.type === "hotel");
    if (hotelCandidate) {
      hotel = {
        name: hotelCandidate.name,
        location: hotelCandidate.location || null,
        rating: hotelCandidate.rating || null,
        chain: this.extractChain(hotelCandidate.name)
      };
    } else if (itinerary?.dailyPlans?.[0]?.slots) {
      const staySlot = itinerary.dailyPlans[0].slots.find(s => s.type === "stay");
      if (staySlot) {
        hotel = { name: staySlot.name, location: null, rating: null, chain: this.extractChain(staySlot.name) };
      }
    }

    // Extract flight from candidates
    let flight = null;
    const flightCandidate = candidates.find(c => c.type === "flight" || c.raw?.type === "flight");
    if (flightCandidate) {
      flight = {
        airline: flightCandidate.name,
        price: flightCandidate.raw?.pricing?.price || null
      };
    }

    // Extract activities from itinerary
    const activities = [];
    if (itinerary?.dailyPlans) {
      for (const day of itinerary.dailyPlans) {
        for (const slot of (day.slots || [])) {
          if (slot.type === "attraction" || slot.type === "activity") {
            activities.push(slot.name);
          }
        }
      }
    }

    return {
      tripId: `trip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      destination,
      startDate: entities.travelDates?.startDate || null,
      endDate: entities.travelDates?.endDate || null,
      durationDays,
      companions: entities.travelersType || "solo",
      hotel,
      flight,
      activities,
      highlights: [],
      dislikes: [],
      memories: [],
      spend: budget?.comfortable || 0,
      budgetEstimate: budget?.comfortable || 0,
      transport: { mode: "mixed", details: "" },
      tags: this.extractTags(entities, itinerary),
      mood: "",
      wouldReturn: null,
      notes: "",
      status,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Trigger learning from the trip data.
   */
  triggerLearning(userId, tripRecord, profile, context) {
    if (!userId || userId === "anonymous") return [];

    const events = [];

    // Learn from trip record (hotel, highlights, dislikes, etc.)
    const tripEvents = tripLearner.learnFromTrip(userId, tripRecord, profile);
    events.push(...tripEvents);

    // Learn from planner edits (if decision engine made changes)
    const decisionLog = context.recommendations?.improvedItinerary?.decisionLog || [];
    if (decisionLog.length > 0) {
      const edits = decisionLog
        .filter(d => d.action === "REPLACE" || d.action === "INSERT_BREAK")
        .map(d => ({ original: d.target, replacement: d.replacement, reason: d.reason }));
      const editEvents = tripLearner.learnFromPlannerEdits(userId, edits, profile);
      events.push(...editEvents);
    }

    // Learn from confidence alerts (low-confidence items were presented)
    const alerts = context.recommendations?.confidenceAlerts || [];
    for (const alert of alerts) {
      if (alert.level === "LOW" && alert.candidateName) {
        // Don't penalize too heavily — user might still like it
        memoryManager.learn(userId, "REJECT_PLACE", alert.candidateName.toLowerCase());
        events.push({ type: "LOW_CONFIDENCE_ALERT", value: alert.candidateName });
      }
    }

    return events;
  }

  /**
   * Generate a human-readable trip summary.
   */
  generateSummary(tripRecord, itinerary, budget, learningEvents) {
    const parts = [];

    if (tripRecord.destination) {
      const dest = tripRecord.destination.charAt(0).toUpperCase() + tripRecord.destination.slice(1);
      parts.push(`Trip to ${dest}`);
    }
    if (tripRecord.durationDays) {
      parts.push(`${tripRecord.durationDays} days`);
    }
    if (tripRecord.hotel?.name) {
      parts.push(`Staying at ${tripRecord.hotel.name}`);
    }
    if (budget?.comfortable) {
      parts.push(`Estimated ₹${budget.comfortable.toLocaleString("en-IN")}`);
    }
    if (tripRecord.activities?.length > 0) {
      parts.push(`${tripRecord.activities.length} activities planned`);
    }
    if (learningEvents.length > 0) {
      parts.push(`Learned from ${learningEvents.length} signals`);
    }

    return parts.join(" · ") || "Trip plan generated";
  }

  /**
   * Extract hotel chain name from hotel name.
   */
  extractChain(hotelName) {
    if (!hotelName) return null;
    const name = String(hotelName).toLowerCase();
    const chains = ["taj", "marriott", "hyatt", "hilton", "sheraton", "novotel", "ibis", "radisson", "oberoi", "leela"];
    for (const chain of chains) {
      if (name.includes(chain)) return chain;
    }
    return null;
  }

  /**
   * Extract tags from entities and itinerary.
   */
  extractTags(entities, itinerary) {
    const tags = [];
    if (entities.travelStyle) tags.push(entities.travelStyle);
    if (entities.travelersType) tags.push(entities.travelersType);

    if (itinerary?.dailyPlans) {
      for (const day of itinerary.dailyPlans) {
        for (const slot of (day.slots || [])) {
          if (slot.type && !tags.includes(slot.type)) {
            tags.push(slot.type);
          }
        }
      }
    }

    return tags;
  }
}

module.exports = new TripManager();

/**
 * Travel OS — Booking Layer
 *
 * The orchestrator that sits between Planner and reservation.
 *
 * Architecture:
 *   Planner → BookingIntent → BookingLayer → ReservationSet
 *
 * The Planner NEVER knows about booking APIs.
 * The BookingLayer NEVER knows about planning logic.
 * They communicate ONLY through BookingIntent.
 *
 * Flow:
 *   1. Receive BookingIntent
 *   2. Fan out to appropriate bookers (Hotel, Flight, Taxi, Activities)
 *   3. Collect Reservations
 *   4. Return ReservationSet
 */

"use strict";

const FlightBooker = require("./bookers/flight_booker");
const HotelBooker = require("./bookers/hotel_booker");
const TaxiBooker = require("./bookers/taxi_booker");
const ActivityBooker = require("./bookers/activity_booker");
const { ReservationSet } = require("./domain/reservation");
const eventBus = require("../events/event_bus");

class BookingLayer {
  constructor() {
    this.bookers = {
      flight:  new FlightBooker(),
      hotel:   new HotelBooker(),
      taxi:    new TaxiBooker(),
      activity: new ActivityBooker()
    };
  }

  /**
   * Process a BookingIntent and return a ReservationSet.
   *
   * @param {BookingIntent} intent
   * @param {object} [userDetails] - { name, email, phone, ... }
   * @param {AbortSignal} [abortSignal]
   * @returns {Promise<ReservationSet>}
   */
  async process(intent, userDetails = {}, abortSignal = null) {
    const startTime = Date.now();
    const sessionId = intent.metadata?.sessionId || "default-session";

    eventBus.emitEvent(sessionId, "BOOKING_STARTED", {
      intentId: intent.intentId,
      destination: intent.destination,
      types: this._getRequestedTypes(intent)
    });

    // Fan out to all relevant bookers in parallel
    const tasks = [];

    if (intent.flight) {
      tasks.push(this._executeBooker("flight", intent.flight, intent, userDetails, abortSignal));
    }

    if (intent.hotel) {
      tasks.push(this._executeBooker("hotel", intent.hotel, intent, userDetails, abortSignal));
    }

    if (intent.taxi) {
      tasks.push(this._executeBooker("taxi", intent.taxi, intent, userDetails, abortSignal));
    }

    if (intent.activities && intent.activities.length > 0) {
      for (const activityReq of intent.activities) {
        tasks.push(this._executeBooker("activity", activityReq, intent, userDetails, abortSignal));
      }
    }

    const results = await Promise.allSettled(tasks);

    // Collect reservations
    const reservations = [];
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        reservations.push(result.value);
      } else if (result.status === "rejected") {
        console.error(`[BookingLayer] Booker failed: ${result.reason?.message}`);
      }
    }

    const reservationSet = ReservationSet({
      intentId: intent.intentId,
      tripId: intent.tripId,
      reservations,
      currency: "INR"
    });

    eventBus.emitEvent(sessionId, "BOOKING_FINISHED", {
      intentId: intent.intentId,
      overallStatus: reservationSet.overallStatus,
      totalCost: reservationSet.totalCost,
      reservationCount: reservations.length
    });

    console.log(`[BookingLayer] Processed intent ${intent.intentId} in ${Date.now() - startTime}ms — ${reservationSet.overallStatus} — ₹${reservationSet.totalCost.toLocaleString("en-IN")}`);

    return reservationSet;
  }

  /**
   * Search for options without booking.
   */
  async search(type, request, abortSignal = null) {
    const booker = this.bookers[type];
    if (!booker) throw new Error(`No booker for type: ${type}`);
    return booker.search(request, abortSignal);
  }

  /**
   * Cancel a reservation.
   */
  async cancel(type, reservationId, abortSignal = null) {
    const booker = this.bookers[type];
    if (!booker) throw new Error(`No booker for type: ${type}`);
    return booker.cancel(reservationId, abortSignal);
  }

  /**
   * Health check all bookers.
   */
  async healthCheck() {
    const results = {};
    for (const [type, booker] of Object.entries(this.bookers)) {
      results[type] = await booker.health();
    }
    return results;
  }

  // ── Private ─────────────────────────────────────────────────────────

  async _executeBooker(type, request, intent, userDetails, abortSignal) {
    const booker = this.bookers[type];
    if (!booker) return null;

    const enrichedDetails = {
      ...userDetails,
      intentId: intent.intentId,
      destination: intent.destination,
      startDate: intent.startDate,
      endDate: intent.endDate,
      travelStyle: intent.travelStyle
    };

    // Search first
    const options = await booker.search(request, abortSignal);
    if (!options || options.length === 0) {
      console.warn(`[BookingLayer] No ${type} options found for intent ${intent.intentId}`);
      return null;
    }

    // Book the best option (first one, already ranked by search)
    const bestOption = options[0];
    return booker.book(bestOption, enrichedDetails, abortSignal);
  }

  _getRequestedTypes(intent) {
    const types = [];
    if (intent.flight) types.push("flight");
    if (intent.hotel) types.push("hotel");
    if (intent.taxi) types.push("taxi");
    if (intent.activities?.length > 0) types.push(`activities(${intent.activities.length})`);
    return types;
  }
}

module.exports = new BookingLayer();

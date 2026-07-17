/**
 * Travel OS — Inference Engine
 *
 * The brain of the Journey Manager.
 * Takes minimal user input → derives a complete TripSpec with all needs.
 *
 * "I have four days in Japan" →
 *   - Trip type: international
 *   - Needs: flight, hotel(4 nights), visa, JR pass, currency(JPY), weather, attractions
 *   - Each need has search criteria, prompts, and status
 *
 * No rigid flowcharts. Adaptive inference based on rules + context.
 */

"use strict";

const { TripSpec, Need } = require("./trip_spec");
const { getDestinationRules, isInternational, getRequiredItems } = require("./destination_rules");

class InferenceEngine {
  /**
   * Derive a TripSpec from minimal user input.
   *
   * @param {object} input - normalized entities from user
   * @param {string} input.destination
   * @param {number} [input.durationDays]
   * @param {string} [input.startDate]
   * @param {string} [input.budget]
   * @param {string} [input.travelersType]
   * @param {object} [input.existing] - already-confirmed data
   * @returns {TripSpec}
   */
  derive(input) {
    const destination = (input.destination || "").toLowerCase();
    const rules = getDestinationRules(destination);

    // 1. Determine trip type
    const tripType = rules?.type || "domestic";

    // 2. Infer duration
    const durationDays = input.durationDays || this._inferDuration(input);

    // 3. Infer dates
    const startDate = input.startDate || this._inferStartDate(input);
    const endDate = this._calcEndDate(startDate, durationDays);

    // 4. Infer origin (if international, origin matters)
    const origin = input.origin || this._inferOrigin(input);

    // 5. Build needs list from rules + context
    const needs = this._deriveNeeds(destination, rules, {
      durationDays,
      startDate,
      endDate,
      origin,
      budget: input.budget,
      travelersType: input.travelersType,
      existing: input.existing || {}
    });

    return TripSpec({
      destination,
      origin,
      tripType,
      durationDays,
      startDate,
      endDate,
      destinationRules: rules,
      needs,
      context: {
        budget: input.budget,
        travelersType: input.travelersType,
        travelStyle: input.travelStyle,
        inferredFrom: input.inferredFrom || "user_input"
      }
    });
  }

  // ── Duration Inference ──────────────────────────────────────────────

  _inferDuration(input) {
    // Try to extract from various input shapes
    if (input.durationDays) return input.durationDays;
    if (input.days) return input.days;

    // Default: 3 days for domestic, 5 days for international
    const dest = (input.destination || "").toLowerCase();
    const rules = getDestinationRules(dest);
    return rules?.type === "international" ? 5 : 3;
  }

  // ── Date Inference ──────────────────────────────────────────────────

  _inferStartDate(input) {
    if (input.startDate) return input.startDate;
    if (input.travelDates?.startDate) return input.travelDates.startDate;

    // Default: next weekend
    const now = new Date();
    const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7;
    const start = new Date(now);
    start.setDate(start.getDate() + daysUntilSaturday);
    return start.toISOString().split("T")[0];
  }

  _calcEndDate(startDate, durationDays) {
    if (!startDate || !durationDays) return null;
    const start = new Date(startDate);
    start.setDate(start.getDate() + durationDays);
    return start.toISOString().split("T")[0];
  }

  // ── Origin Inference ────────────────────────────────────────────────

  _inferOrigin(input) {
    if (input.origin) return input.origin;

    // Check memory for user's home city
    if (input.userProfile?.homeCity) return input.userProfile.homeCity;
    if (input.permanentMemory?.preferences?.homeCity) return input.permanentMemory.preferences.homeCity;

    // Default: Delhi (common Indian origin)
    return "DEL";
  }

  // ── Needs Derivation ───────────────────────────────────────────────

  _deriveNeeds(destination, rules, ctx) {
    const needs = [];
    const existing = ctx.existing || {};

    // Always need accommodation
    if (!existing.selectedHotel) {
      needs.push(Need({
        id: "hotel",
        type: "logistics",
        required: true,
        derived: true,
        reason: `${ctx.durationDays} nights accommodation in ${destination}`,
        status: "pending",
        prompt: `Where would you like to stay in ${destination}?`,
        searchCriteria: {
          destinationId: destination,
          checkIn: ctx.startDate,
          checkOut: ctx.endDate,
          style: ctx.travelStyle || "mid",
          adults: ctx.travelersType === "couple" ? 2 : 1
        }
      }));
    }

    // International: need flights
    if (rules?.type === "international" && !existing.selectedFlight) {
      needs.push(Need({
        id: "flight",
        type: "logistics",
        required: true,
        derived: true,
        reason: `Flight from ${ctx.origin} to ${destination}`,
        status: "pending",
        prompt: `Let me find flights from ${ctx.origin} to ${destination}.`,
        searchCriteria: {
          origin: ctx.origin,
          destination: destination,
          departureDate: ctx.startDate,
          returnDate: ctx.endDate,
          passengers: ctx.travelersType === "couple" ? 2 : 1
        }
      }));
    }

    // International: visa check
    if (rules?.visa?.required && !existing.visa) {
      needs.push(Need({
        id: "visa",
        type: "document",
        required: true,
        derived: true,
        reason: rules.visa.notes,
        status: "pending",
        prompt: `You'll need a ${rules.visa.type} for ${destination}. Do you have one, or should I help you apply?`,
        data: rules.visa
      }));
    }

    // Rail pass check
    if (rules?.transport?.railPass?.recommended) {
      needs.push(Need({
        id: "railpass",
        type: "document",
        required: false,
        derived: true,
        reason: rules.transport.railPass.note,
        status: "pending",
        prompt: `A ${rules.transport.railPass.name} could save you money on trains. Want me to include it?`,
        data: rules.transport.railPass
      }));
    }

    // Currency exchange (international only)
    if (rules?.type === "international") {
      needs.push(Need({
        id: "currency",
        type: "finance",
        required: true,
        derived: true,
        reason: `Need ${rules.currency.name} (${rules.currency.code}) for expenses`,
        status: "pending",
        data: rules.currency
      }));
    }

    // Local transport
    needs.push(Need({
      id: "transport",
      type: "logistics",
      required: true,
      derived: true,
      reason: "Getting around " + destination,
      status: "pending",
      data: rules?.transport || null,
      searchCriteria: {
        origin: "Airport",
        destination: destination,
        date: ctx.startDate,
        vehicleType: "sedan"
      }
    }));

    // Weather info
    needs.push(Need({
      id: "weather",
      type: "info",
      required: true,
      derived: true,
      reason: "Weather forecast for packing and planning",
      status: "pending",
      searchCriteria: {
        destinationId: destination,
        coordinates: null
      }
    }));

    // Attractions/activities
    needs.push(Need({
      id: "attractions",
      type: "planning",
      required: true,
      derived: true,
      reason: `Things to do in ${destination} over ${ctx.durationDays} days`,
      status: "pending",
      searchCriteria: {
        destinationId: destination,
        type: "activity"
      }
    }));

    // Packing suggestions
    needs.push(Need({
      id: "packing",
      type: "info",
      required: false,
      derived: true,
      reason: "Weather-appropriate packing list",
      status: "pending"
    }));

    return needs;
  }
}

module.exports = new InferenceEngine();

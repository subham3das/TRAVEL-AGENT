/**
 * Travel OS — Journey Manager (v2)
 *
 * The biggest differentiator.
 * Derives a complete TripSpec from minimal user input.
 *
 * "I have four days in Japan" →
 *   - tripType: international
 *   - needs: flight, hotel, visa, JR pass, currency, weather, attractions, transport
 *   - each need has search criteria and status
 *
 * No rigid flowcharts. Adaptive inference.
 *
 * Integration:
 *   - Runs as pipeline stage "journeyManager"
 *   - Produces context.journeySpec (TripSpec)
 *   - Other stages read journeySpec to know what to do
 *   - CandidateFlow uses journeySpec.needs to determine clarification steps
 */

"use strict";

const inferenceEngine = require("./inference_engine");
const eventBus = require("../events/event_bus");

class JourneyManager {
  /**
   * Pipeline stage: Derive TripSpec from context.
   *
   * @param {object} context - TravelContext
   * @returns {object} Standard engine response
   */
  run(context) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      const userId = context.userId || context.state?.userId || "anonymous";
      const sessionId = context.sessionId || "default-session";
      const entities = context.state?.normalizedEntities || {};

      // Build input for inference engine
      const input = {
        destination:    entities.destination,
        durationDays:   entities.durationDays,
        startDate:      entities.startDate,
        budget:         entities.budget,
        travelersType:  entities.travelersType,
        travelStyle:    entities.travelStyle,
        origin:         entities.origin,
        existing: {
          selectedHotel:   entities.selectedHotel,
          selectedFlight:  entities.selectedFlight,
          selectedPlaces:  entities.selectedPlaces
        },
        userProfile: context.travelProfile || null,
        permanentMemory: context.permanentMemory || null,
        inferredFrom: "pipeline_context"
      };

      // If no destination, skip — let CandidateFlow handle it
      if (!input.destination) {
        return {
          success: true,
          data: { tripSpec: null, reason: "No destination yet — CandidateFlow will ask" },
          errors,
          warnings,
          confidence: 1.0,
          processingTime: Date.now() - startTime,
          metadata: { stage: "JOURNEY_MANAGER" }
        };
      }

      // Derive TripSpec
      const tripSpec = inferenceEngine.derive(input);

      // Mark existing items as ready
      for (const need of tripSpec.needs) {
        if (need.id === "hotel" && entities.selectedHotel) {
          need.status = "ready";
          need.data = entities.selectedHotel;
        }
        if (need.id === "flight" && entities.selectedFlight) {
          need.status = "ready";
          need.data = entities.selectedFlight;
        }
        if (need.id === "attractions" && entities.selectedPlaces?.length > 0) {
          need.status = "ready";
          need.data = entities.selectedPlaces;
        }
      }

      // Store in context
      context.journeySpec = tripSpec;

      // Also update conversationState for backward compat
      if (context.state?.conversationState) {
        context.state.conversationState.journeyState = tripSpec.needs.every(n => n.status === "ready" || !n.required)
          ? "READY"
          : "DERIVING";
      }

      eventBus.emitEvent(sessionId, "JOURNEY_DERIVED", {
        destination: tripSpec.destination,
        tripType: tripSpec.tripType,
        durationDays: tripSpec.durationDays,
        totalNeeds: tripSpec.needs.length,
        requiredNeeds: tripSpec.needs.filter(n => n.required).length,
        pendingNeeds: tripSpec.needs.filter(n => n.status === "pending").length
      });

      return {
        success: true,
        data: { tripSpec },
        errors,
        warnings,
        confidence: 1.0,
        processingTime: Date.now() - startTime,
        metadata: { stage: "JOURNEY_MANAGER" }
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
        metadata: { stage: "JOURNEY_MANAGER" }
      };
    }
  }

  /**
   * Get the next unfulfilled need from the TripSpec.
   * Used by CandidateFlow to determine what to ask next.
   *
   * @param {object} context
   * @returns {Need | null}
   */
  getNextNeed(context) {
    const spec = context.journeySpec;
    if (!spec) return null;

    return spec.needs.find(n => n.status === "pending" && n.required) || null;
  }

  /**
   * Mark a need as fulfilled.
   *
   * @param {object} context
   * @param {string} needId
   * @param {object} data - the resolved data
   */
  fulfillNeed(context, needId, data) {
    const spec = context.journeySpec;
    if (!spec) return;

    const need = spec.needs.find(n => n.id === needId);
    if (need) {
      need.status = "ready";
      need.data = data;
    }

    // Check if all required needs are ready
    const allReady = spec.needs.filter(n => n.required).every(n => n.status === "ready");
    if (allReady && context.state?.conversationState) {
      context.state.conversationState.journeyState = "READY";
    }
  }

  /**
   * Get summary of derived needs for response composition.
   */
  getSummary(context) {
    const spec = context.journeySpec;
    if (!spec) return null;

    return {
      destination: spec.destination,
      tripType: spec.tripType,
      duration: spec.durationDays,
      startDate: spec.startDate,
      endDate: spec.endDate,
      needs: spec.needs.map(n => ({
        id: n.id,
        type: n.type,
        required: n.required,
        status: n.status,
        reason: n.reason
      })),
      ready: spec.needs.filter(n => n.required).every(n => n.status === "ready")
    };
  }
}

module.exports = new JourneyManager();

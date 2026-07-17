/**
 * Travel OS — Memory Pipeline Stage
 *
 * Runs as a first-class engine stage.
 * Conforms to the standard engine response contract.
 */

"use strict";

const travelProfileManager = require("./travel_profile_manager");
const eventBus = require("../events/event_bus");

class MemoryStage {
  /**
   * Run the memory loading stage in the pipeline.
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

      // Load persistent profile
      const profile = travelProfileManager.load(userId);

      // Save into context
      context.travelProfile = profile;
      if (!context.user) context.user = {};
      context.user.preferences = profile;

      eventBus.emitEvent(sessionId, "MEMORY_LOADED", { userId });

      return {
        success: true,
        data: profile,
        errors,
        warnings,
        confidence: 1.0,
        processingTime: Date.now() - startTime,
        metadata: { stage: "MEMORY" }
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
        metadata: { stage: "MEMORY" }
      };
    }
  }

  /**
   * Finalize and save user profile. Called when a trip is finalized/booked.
   *
   * @param {object} context - TravelContext
   * @returns {boolean}
   */
  finalize(context) {
    const profile = context.travelProfile || context.user?.preferences;
    if (!profile) return false;

    // Track corrections/feedback automatically if available
    if (context.state?.normalizedEntities) {
      const entities = context.state.normalizedEntities;
      if (entities.travelStyle && entities.travelStyle !== profile.travelStyle) {
        profile.travelStyle = entities.travelStyle;
      }
    }

    return travelProfileManager.save(profile);
  }
}

module.exports = new MemoryStage();

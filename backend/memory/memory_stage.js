/**
 * Travel OS — Memory Pipeline Stage
 *
 * Runs as a first-class engine stage in the 14-stage pipeline.
 * Loads all three memory layers into context at pipeline start.
 * Saves changes at finalization.
 *
 * Memory Layers:
 *   1. Permanent Memory — user preferences (file-based, never expires)
 *   2. Trip Memory — past trip records (file-based)
 *   3. Session Memory — volatile per-request data (in-memory)
 *
 * RULE: Never mix layers.
 */

"use strict";

const memoryManager = require("./memory_manager");
const eventBus = require("../events/event_bus");

class MemoryStage {
  /**
   * Run the memory loading stage in the pipeline.
   * Loads all three layers into context.
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

      // Load all memory layers into context
      memoryManager.loadContext(context);

      eventBus.emitEvent(sessionId, "MEMORY_LOADED", {
        userId,
        hasPermanent: true,
        tripCount: context.tripMemory?.trips?.length || 0,
        hasSession: true
      });

      return {
        success: true,
        data: {
          userId,
          permanentLoaded: true,
          tripCount: context.tripMemory?.trips?.length || 0,
          sessionActive: true
        },
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
   * Finalize and save memory changes.
   * Called when context is being finalized.
   *
   * @param {object} context - TravelContext
   * @returns {boolean}
   */
  finalize(context) {
    const userId = context.userId || context.state?.userId || "anonymous";
    const sessionId = context.sessionId || "default-session";

    // Sync corrections from normalized entities to permanent memory
    if (context.state?.normalizedEntities) {
      const entities = context.state.normalizedEntities;

      if (entities.travelStyle) {
        memoryManager.permanent.updatePreference(userId, "hotelStyle", entities.travelStyle);
      }

      if (entities.budget) {
        memoryManager.permanent.updatePreference(userId, "budget", {
          min: entities.budget * 0.8,
          max: entities.budget * 1.2,
          avg: entities.budget,
          currency: "INR"
        });
      }
    }

    // Save travel profile for backward compatibility
    const profile = context.travelProfile;
    if (profile) {
      const travelProfileManager = require("./travel_profile_manager");
      travelProfileManager.save(profile);
    }

    return true;
  }
}

module.exports = new MemoryStage();

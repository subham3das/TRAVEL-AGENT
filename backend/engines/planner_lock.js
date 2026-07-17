/**
 * Travel OS — Planner Lock
 *
 * Hard gate between Validation Engine and Planner.
 * planner.plan() is NEVER called unless this passes.
 *
 * Rules:
 * - Destination must be present
 * - durationDays OR travelDates must be present
 * - budget must be present
 * - selectedHotel must be present
 * - selectedFlight must be present
 * - selectedPlaces must be non-empty
 * - journeyState must be "READY" or "GENERATING"
 *
 * If ANY condition fails → locked = true, planner skipped,
 * candidateFlow handles the missing piece.
 */

"use strict";

const READY_STATES = new Set(["READY", "GENERATING"]);

class PlannerLock {
  /**
   * @param {object} context  - execution context
   * @returns {{ locked: boolean, missing: string[], reason: string }}
   */
  evaluate(context) {
    const entities    = context?.state?.normalizedEntities || {};
    const journeyState = context?.state?.conversationState?.journeyState || "START";
    const missing     = [];

    // 1. Destination
    if (!entities.destination) {
      missing.push("destination");
    }

    // 2. Duration or travel dates
    if (!entities.durationDays && !entities.travelDates?.startDate) {
      missing.push("durationDays");
    }

    // 3. Budget
    if (!entities.budget) {
      missing.push("budget");
    }

    // 4. Selected hotel
    if (!entities.selectedHotel) {
      missing.push("selectedHotel");
    }

    // 5. Selected flight
    if (!entities.selectedFlight) {
      missing.push("selectedFlight");
    }

    // 6. Selected places (at least one)
    const places = entities.selectedPlaces;
    if (!places || (Array.isArray(places) && places.length === 0)) {
      missing.push("selectedPlaces");
    }

    // 7. Journey state
    if (!READY_STATES.has(journeyState)) {
      missing.push(`journeyState (is: ${journeyState}, needs: READY)`);
    }

    const locked = missing.length > 0;

    return {
      locked,
      missing,
      reason: locked
        ? `Planner locked — missing: [${missing.join(", ")}]`
        : "Planner unlocked — all conditions met."
    };
  }
}

module.exports = new PlannerLock();

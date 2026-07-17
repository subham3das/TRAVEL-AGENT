/**
 * Travel OS — Trip Learner
 *
 * Extracts learning events from completed trip data and user feedback.
 * Converts raw trip records into structured learning events that
 * MemoryManager.learn() can process.
 *
 * Learning Sources:
 *   - Hotels chosen (boosts that hotel/chain)
 *   - Flights ignored (penalizes that airline)
 *   - Restaurants visited (boosts cuisine preferences)
 *   - Budget spent (refines budget behaviour)
 *   - Activities skipped (penalizes that category)
 *   - Planner edits (adjusts pace/preferences)
 *   - Feedback (highlights/dislikes → ranking weights)
 */

"use strict";

const memoryManager = require("../memory/memory_manager");

const LEARN_WEIGHTS = {
  hotelChosen:       +20,
  hotelSkipped:      -15,
  flightChosen:      +15,
  flightIgnored:     -10,
  restaurantVisited: +12,
  restaurantSkipped: -8,
  activitySkipped:   -12,
  activityAdded:     +10,
  budgetOverspent:   -5,
  budgetUnderspent:  +5,
  plannerEdit:       +8,
  highlight:         +15,
  dislike:           -20,
  wouldReturn:       +10,
  wouldNotReturn:    -15
};

class TripLearner {
  /**
   * Learn from a completed trip record.
   * @param {string} userId
   * @param {object} tripRecord - from TripMemory (hotel, highlights, dislikes, spend, wouldReturn, etc.)
   * @param {object} profile - user's TravelProfile
   * @returns {object[]} array of learning events that were applied
   */
  learnFromTrip(userId, tripRecord, profile) {
    if (!userId || !tripRecord || !profile) return [];

    const events = [];

    // 1. Hotel chosen
    if (tripRecord.hotel?.name) {
      const hotelName = String(tripRecord.hotel.name).toLowerCase().trim();
      events.push({ type: "ACCEPT_PLACE", value: hotelName });
      if (tripRecord.hotel.chain) {
        events.push({ type: "ACCEPT_HOTEL_CHAIN", value: String(tripRecord.hotel.chain).toLowerCase() });
      }
    }

    // 2. Highlights (liked things)
    if (Array.isArray(tripRecord.highlights)) {
      for (const h of tripRecord.highlights) {
        const normalized = String(h).toLowerCase().trim();
        if (normalized) {
          events.push({ type: "ACCEPT_PLACE", value: normalized });
        }
      }
    }

    // 3. Dislikes (disliked things)
    if (Array.isArray(tripRecord.dislikes)) {
      for (const d of tripRecord.dislikes) {
        const normalized = String(d).toLowerCase().trim();
        if (normalized) {
          events.push({ type: "REJECT_PLACE", value: normalized });
        }
      }
    }

    // 4. Would return
    if (tripRecord.wouldReturn === true) {
      events.push({ type: "ADD_PLACE_CATEGORY", value: tripRecord.destination || "destination" });
    }

    // 5. Budget spend vs estimate
    if (tripRecord.spend && tripRecord.budgetEstimate) {
      const ratio = tripRecord.spend / tripRecord.budgetEstimate;
      if (ratio > 1.2) {
        events.push({ type: "BUDGET_OVERSPENT", value: String(tripRecord.spend) });
      } else if (ratio < 0.7) {
        events.push({ type: "BUDGET_UNDERSPENT", value: String(tripRecord.spend) });
      }
    }

    // 6. Transport preferences
    if (tripRecord.transport?.mode) {
      events.push({ type: "ADD_PLACE_CATEGORY", value: `transport:${tripRecord.transport.mode}` });
    }

    // 7. Tags → category preferences
    if (Array.isArray(tripRecord.tags)) {
      for (const tag of tripRecord.tags) {
        const normalized = String(tag).toLowerCase().trim();
        if (normalized) {
          events.push({ type: "ADD_PLACE_CATEGORY", value: normalized });
        }
      }
    }

    // 8. Activities visited (from itinerary)
    if (Array.isArray(tripRecord.activities)) {
      for (const activity of tripRecord.activities) {
        const normalized = String(activity).toLowerCase().trim();
        if (normalized) {
          events.push({ type: "ACCEPT_PLACE", value: normalized });
        }
      }
    }

    // Apply all events
    const applied = [];
    for (const event of events) {
      const result = memoryManager.learn(userId, event.type, event.value);
      if (result) {
        applied.push({ ...event, weight: LEARN_WEIGHTS[event.type] || 0 });
      }
    }

    return applied;
  }

  /**
   * Learn from user feedback on a specific recommendation.
   * @param {string} userId
   * @param {object} feedback - { itemType, itemId, itemName, action: "accept"|"reject"|"skip"|"edit", detail? }
   * @param {object} profile - user's TravelProfile
   * @returns {boolean} whether learning was applied
   */
  learnFromFeedback(userId, feedback, profile) {
    if (!userId || !feedback || !profile) return false;

    const { itemType, itemId, itemName, action, detail } = feedback;
    const name = String(itemName || itemId || "").toLowerCase().trim();
    if (!name) return false;

    let eventType;
    switch (action) {
      case "accept":
        eventType = this._acceptEventForType(itemType);
        break;
      case "reject":
        eventType = this._rejectEventForType(itemType);
        break;
      case "skip":
        eventType = this._skipEventForType(itemType);
        break;
      case "edit":
        eventType = "PLANNER_EDIT";
        break;
      default:
        return false;
    }

    if (!eventType) return false;

    return memoryManager.learn(userId, eventType, name);
  }

  /**
   * Learn from planner edits (user modified the generated plan).
   * @param {string} userId
   * @param {object[]} edits - array of { original, replacement, reason }
   * @param {object} profile - user's TravelProfile
   * @returns {object[]} applied events
   */
  learnFromPlannerEdits(userId, edits, profile) {
    if (!userId || !Array.isArray(edits) || !profile) return [];

    const events = [];
    for (const edit of edits) {
      if (edit.original) {
        events.push({ type: "REJECT_PLACE", value: String(edit.original).toLowerCase() });
      }
      if (edit.replacement) {
        events.push({ type: "ACCEPT_PLACE", value: String(edit.replacement).toLowerCase() });
      }
    }

    const applied = [];
    for (const event of events) {
      const result = memoryManager.learn(userId, event.type, event.value);
      if (result) applied.push(event);
    }

    return applied;
  }

  /**
   * Learn from skipped activities in the itinerary.
   * @param {string} userId
   * @param {string[]} skippedActivityNames
   * @param {object} profile
   * @returns {object[]} applied events
   */
  learnFromSkippedActivities(userId, skippedActivityNames, profile) {
    if (!userId || !Array.isArray(skippedActivityNames) || !profile) return [];

    const applied = [];
    for (const name of skippedActivityNames) {
      const normalized = String(name).toLowerCase().trim();
      if (normalized) {
        const result = memoryManager.learn(userId, "REJECT_PLACE", normalized);
        if (result) applied.push({ type: "REJECT_PLACE", value: normalized });
      }
    }

    return applied;
  }

  /**
   * Batch learn from multiple feedback events.
   * @param {string} userId
   * @param {object[]} feedbacks
   * @param {object} profile
   * @returns {{ applied: number, events: object[] }}
   */
  learnBatch(userId, feedbacks, profile) {
    if (!userId || !Array.isArray(feedbacks) || !profile) return { applied: 0, events: [] };

    const allEvents = [];
    for (const fb of feedbacks) {
      const events = this.learnFromFeedback(userId, fb, profile);
      if (events) allEvents.push({ ...fb, applied: true });
    }

    return { applied: allEvents.length, events: allEvents };
  }

  _acceptEventForType(itemType) {
    const map = {
      hotel: "ACCEPT_HOTEL_CHAIN",
      flight: "ACCEPT_AIRLINE",
      attraction: "ACCEPT_PLACE",
      restaurant: "ADD_PLACE_CATEGORY",
      activity: "ACCEPT_PLACE"
    };
    return map[itemType] || "ACCEPT_PLACE";
  }

  _rejectEventForType(itemType) {
    const map = {
      hotel: "REJECT_HOTEL_CHAIN",
      flight: "REJECT_AIRLINE",
      attraction: "REJECT_PLACE",
      restaurant: "REJECT_PLACE",
      activity: "REJECT_PLACE"
    };
    return map[itemType] || "REJECT_PLACE";
  }

  _skipEventForType(itemType) {
    const map = {
      hotel: "REJECT_HOTEL_CHAIN",
      flight: "REJECT_AIRLINE",
      attraction: "REJECT_PLACE",
      restaurant: "REJECT_PLACE",
      activity: "REJECT_PLACE"
    };
    return map[itemType] || "REJECT_PLACE";
  }
}

module.exports = new TripLearner();

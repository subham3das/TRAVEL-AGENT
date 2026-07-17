/**
 * Travel OS Event Bus
 *
 * Internal EventEmitter. Decouples engine state from transport layers.
 * SSE Adapter subscribes per-session and forwards every event to the client.
 *
 * Full event taxonomy (emitted by execution pipeline):
 *
 *   REQUEST_STARTED, INTENT_READY, MEMORY_LOADED,
 *   KG_QUERY_STARTED, KG_QUERY_FINISHED,
 *   RECOMMENDATIONS_READY, BUDGET_READY,
 *   HOTEL_SEARCH_STARTED, HOTEL_SEARCH_FINISHED,
 *   FLIGHT_SEARCH_STARTED, FLIGHT_SEARCH_FINISHED,
 *   PLANNER_RUNNING, PLAN_READY, STREAM_COMPLETE
 */
const EventEmitter = require("events");

// All valid event types — enforced so nothing is misnamed
const EVENTS = {
  REQUEST_STARTED:        "REQUEST_STARTED",
  INTENT_READY:           "INTENT_READY",
  MEMORY_LOADED:          "MEMORY_LOADED",
  KG_QUERY_STARTED:       "KG_QUERY_STARTED",
  KG_QUERY_FINISHED:      "KG_QUERY_FINISHED",
  VALIDATION_DONE:        "VALIDATION_DONE",
  RECOMMENDATIONS_READY:  "RECOMMENDATIONS_READY",
  BUDGET_READY:           "BUDGET_READY",
  HOTEL_SEARCH_STARTED:   "HOTEL_SEARCH_STARTED",
  HOTEL_SEARCH_FINISHED:  "HOTEL_SEARCH_FINISHED",
  FLIGHT_SEARCH_STARTED:  "FLIGHT_SEARCH_STARTED",
  FLIGHT_SEARCH_FINISHED: "FLIGHT_SEARCH_FINISHED",
  PLANNER_RUNNING:        "PLANNER_RUNNING",
  PLAN_READY:             "PLAN_READY",
  STREAM_COMPLETE:        "STREAM_COMPLETE",
  // Engine progress (generic)
  ENGINE_START:           "ENGINE_START",
  ENGINE_DONE:            "ENGINE_DONE",
  ENGINE_ERROR:           "ENGINE_ERROR",
  // Phase 3 Search and Cache Events
  SEARCH_STARTED:         "SEARCH_STARTED",
  CACHE_HIT:              "CACHE_HIT",
  CACHE_MISS:             "CACHE_MISS",
  CACHE_STALE:            "CACHE_STALE",
  SEARCH_CACHE_REFRESH:   "SEARCH_CACHE_REFRESH",
  MERGE_STARTED:          "MERGE_STARTED",
  MERGE_FINISHED:         "MERGE_FINISHED",
  CONFIDENCE_READY:       "CONFIDENCE_READY",
  PROVIDER_SELECTED:      "PROVIDER_SELECTED",
  SEARCH_FINISHED:        "SEARCH_FINISHED",
  SEARCH_TIMEOUT:         "SEARCH_TIMEOUT",
  SEARCH_FAILED:          "SEARCH_FAILED"
};

class TravelEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Emit a named travel event for a specific session.
   * @param {string} sessionId
   * @param {string} type      - one of EVENTS constants
   * @param {object} payload
   */
  emitEvent(sessionId, type, payload = {}) {
    const eventName = `session:${sessionId}`;
    this.emit(eventName, {
      type,
      payload,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Shorthand: emit a progress event (ENGINE_START / ENGINE_DONE / ENGINE_ERROR).
   */
  emitProgress(sessionId, engine, status, meta = {}) {
    const type = status === "start" ? EVENTS.ENGINE_START
                : status === "done"  ? EVENTS.ENGINE_DONE
                : EVENTS.ENGINE_ERROR;
    this.emitEvent(sessionId, type, { engine, ...meta });
  }

  /**
   * Legacy compat: journey state changes.
   */
  emitJourneyState(sessionId, state, payload = {}) {
    this.emitEvent(sessionId, state, payload);
  }

  /**
   * Subscribe to all events for a session.
   * Returns unsubscribe function.
   */
  subscribeToSession(sessionId, callback) {
    const handler = (data) => callback(data);
    this.on(`session:${sessionId}`, handler);
    return () => this.off(`session:${sessionId}`, handler);
  }
}

if (!global.travelEventBusInstance) {
  global.travelEventBusInstance = new TravelEventBus();
}

module.exports = global.travelEventBusInstance;
module.exports.EVENTS = EVENTS;

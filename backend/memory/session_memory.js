/**
 * Travel OS — Session Memory
 *
 * Volatile in-memory storage for the current request/session.
 * LIVES: from request start to request end.
 * DIES: when the HTTP response is sent.
 *
 * Stores:
 * - Current clarification state
 * - Current planner state
 * - Temporary budget
 * - Temporary companions
 * - Any per-request working data
 *
 * NEVER persisted to disk.
 * NEVER survives server restart.
 */

"use strict";

class SessionMemory {
  constructor() {
    /** @type {Map<string, object>} sessionId → session data */
    this.sessions = new Map();
  }

  /**
   * Get or create a session.
   */
  getOrCreate(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sessionId,
        createdAt: new Date().toISOString(),
        clarification: null,
        planner: null,
        budget: null,
        companions: [],
        workingData: {},
        messageHistory: []
      });
    }
    return this.sessions.get(sessionId);
  }

  /**
   * Get session data.
   */
  get(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Set a key-value pair in session.
   */
  set(sessionId, key, value) {
    const session = this.getOrCreate(sessionId);
    session[key] = value;
    return session;
  }

  /**
   * Get a specific key from session.
   */
  getValue(sessionId, key) {
    const session = this.get(sessionId);
    return session ? session[key] : undefined;
  }

  /**
   * Update clarification state.
   */
  setClarification(sessionId, clarification) {
    const session = this.getOrCreate(sessionId);
    session.clarification = clarification;
    return session;
  }

  /**
   * Update planner state.
   */
  setPlanner(sessionId, plannerState) {
    const session = this.getOrCreate(sessionId);
    session.planner = plannerState;
    return session;
  }

  /**
   * Set temporary budget.
   */
  setBudget(sessionId, budget) {
    const session = this.getOrCreate(sessionId);
    session.budget = budget;
    return session;
  }

  /**
   * Set temporary companions.
   */
  setCompanions(sessionId, companions) {
    const session = this.getOrCreate(sessionId);
    session.companions = Array.isArray(companions) ? companions : [companions];
    return session;
  }

  /**
   * Add a message to session history.
   */
  addMessage(sessionId, role, content) {
    const session = this.getOrCreate(sessionId);
    session.messageHistory.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
    // Keep last 20 messages
    if (session.messageHistory.length > 20) {
      session.messageHistory = session.messageHistory.slice(-20);
    }
    return session;
  }

  /**
   * Store arbitrary working data.
   */
  setWorking(sessionId, key, value) {
    const session = this.getOrCreate(sessionId);
    session.workingData[key] = value;
    return session;
  }

  /**
   * Get working data.
   */
  getWorking(sessionId, key) {
    const session = this.get(sessionId);
    return session?.workingData?.[key];
  }

  /**
   * Clear a session entirely.
   */
  clear(sessionId) {
    this.sessions.delete(sessionId);
  }

  /**
   * Clear clarification state.
   */
  clearClarification(sessionId) {
    const session = this.get(sessionId);
    if (session) session.clarification = null;
  }

  /**
   * Clear planner state.
   */
  clearPlanner(sessionId) {
    const session = this.get(sessionId);
    if (session) session.planner = null;
  }

  /**
   * Clear temporary budget.
   */
  clearBudget(sessionId) {
    const session = this.get(sessionId);
    if (session) session.budget = null;
  }

  /**
   * Clear temporary companions.
   */
  clearCompanions(sessionId) {
    const session = this.get(sessionId);
    if (session) session.companions = [];
  }

  /**
   * Export session for debugging.
   */
  export(sessionId) {
    return this.get(sessionId) || null;
  }

  /**
   * Get count of active sessions.
   */
  activeCount() {
    return this.sessions.size;
  }

  /**
   * Prune sessions older than maxAgeMs (default 1 hour).
   */
  prune(maxAgeMs = 3600000) {
    const now = Date.now();
    let pruned = 0;

    for (const [id, session] of this.sessions) {
      const age = now - new Date(session.createdAt).getTime();
      if (age > maxAgeMs) {
        this.sessions.delete(id);
        pruned++;
      }
    }

    return pruned;
  }
}

module.exports = new SessionMemory();

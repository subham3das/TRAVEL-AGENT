/**
 * Travel OS — Learning Engine
 *
 * Deterministically learns from user behaviors (accepts, rejections, additions)
 * and updates permanent memory learnings.
 *
 * Rules:
 * - NEVER trains LLMs.
 * - NEVER writes to or alters the Knowledge Graph.
 * - Writes to PermanentMemory.learnings.rankingWeights.
 */

"use strict";

const memoryManager = require("../memory/memory_manager");

class LearningEngine {
  /**
   * Processes a user interaction event and updates ranking weights.
   *
   * @param {string} userId
   * @param {object} event - { type: "REJECT_AIRLINE"|"ACCEPT_HOTEL_CHAIN"|"ACCEPT_PLACE"|..., value: string }
   * @param {object} profile - the user's TravelProfile (for backward compat)
   * @returns {object} updated rankingWeights
   */
  learn(userId, event, profile) {
    if (!profile) return {};

    const type = event?.type;
    const value = String(event?.value || "").toLowerCase();

    if (!type || !value) return profile.rankingWeights || {};

    // Delegate to MemoryManager which writes to PermanentMemory
    memoryManager.learn(userId, type, value);

    // Sync back to profile for backward compat with RankingEngine
    const permanent = memoryManager.permanent.load(userId);
    profile.rankingWeights = permanent.learnings.rankingWeights || {};

    return profile.rankingWeights;
  }

  /**
   * Calculates the personal boost score for a given candidate item.
   *
   * @param {object} profile - user's TravelProfile
   * @param {object} item - candidate SearchResult / Hotel / Flight / Attraction
   * @returns {number} boost score (negative or positive)
   */
  getBoost(profile, item) {
    if (!profile?.rankingWeights || !item) return 0;

    const weights = profile.rankingWeights;
    let boost = 0;

    const id = String(item.id || "").toLowerCase();
    const type = String(item.type || "").toLowerCase();

    // 1. Specific Place ID boost/penalty
    if (weights[`place:${id}`]) {
      boost += weights[`place:${id}`];
    }

    // 2. Hotel Chain check
    if (type === "hotel") {
      const name = String(item.name || "").toLowerCase();
      const chains = ["taj", "marriott", "hyatt", "hilton", "sheraton", "novotel", "ibis", "radisson"];
      for (const chain of chains) {
        if (name.includes(chain) && weights[`chain:${chain}`]) {
          boost += weights[`chain:${chain}`];
        }
      }
    }

    // 3. Airline check
    if (type === "flight") {
      const airline = String(item.airline || "").toLowerCase();
      if (weights[`airline:${airline}`]) {
        boost += weights[`airline:${airline}`];
      }
    }

    // 4. Category check
    const category = String(item.category || item.type || "").toLowerCase();
    if (weights[`category:${category}`]) {
      boost += weights[`category:${category}`];
    }

    return boost;
  }
}

module.exports = new LearningEngine();

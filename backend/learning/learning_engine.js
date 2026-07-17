/**
 * Travel OS — Learning Engine
 *
 * Deterministically learns from user behaviors (accepts, rejections, additions)
 * and updates personal ranking weights inside the TravelProfile.
 *
 * Rules:
 * - NEVER trains LLMs.
 * - NEVER writes to or alters the Knowledge Graph.
 * - Adjusts weight tokens in TravelProfile.rankingWeights.
 */

"use strict";

const travelProfileManager = require("../memory/travel_profile_manager");

class LearningEngine {
  /**
   * Processes a user interaction event and updates ranking weights in the profile.
   *
   * @param {string} userId
   * @param {object} event - { type: "REJECT_AIRLINE"|"ACCEPT_HOTEL_CHAIN"|"ACCEPT_PLACE"|"REJECT_PLACE", value: string }
   * @param {object} profile - the user's TravelProfile
   * @returns {object} updated rankingWeights
   */
  learn(userId, event, profile) {
    if (!profile) return {};

    profile.rankingWeights = profile.rankingWeights || {};
    const weights = profile.rankingWeights;

    const type = event?.type;
    const value = String(event?.value || "").toLowerCase();

    if (!type || !value) return weights;

    switch (type) {
      case "REJECT_AIRLINE":
        // Penalty for airline
        weights[`airline:${value}`] = (weights[`airline:${value}`] || 0) - 30;
        break;

      case "ACCEPT_AIRLINE":
        // Boost for airline
        weights[`airline:${value}`] = (weights[`airline:${value}`] || 0) + 15;
        break;

      case "REJECT_HOTEL_CHAIN":
        // Penalty for hotel chain
        weights[`chain:${value}`] = (weights[`chain:${value}`] || 0) - 25;
        break;

      case "ACCEPT_HOTEL_CHAIN":
        // Boost for hotel chain
        weights[`chain:${value}`] = (weights[`chain:${value}`] || 0) + 20;
        break;

      case "REJECT_PLACE":
        // Penalty for specific category or place ID
        weights[`place:${value}`] = (weights[`place:${value}`] || 0) - 30;
        break;

      case "ACCEPT_PLACE":
        // Boost for specific place ID
        weights[`place:${value}`] = (weights[`place:${value}`] || 0) + 25;
        break;

      case "ADD_PLACE_CATEGORY":
        // Boost category (e.g. museum, beach)
        weights[`category:${value}`] = (weights[`category:${value}`] || 0) + 10;
        break;

      default:
        console.warn(`[LearningEngine] Unrecognized event type: ${type}`);
    }

    // Save changes persistently
    travelProfileManager.save(profile);

    return weights;
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
      // Taj, Marriott, Hyatt, Marriott, Sheraton etc.
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

    // 4. Category check (for attractions/restaurants)
    const category = String(item.category || item.type || "").toLowerCase();
    if (weights[`category:${category}`]) {
      boost += weights[`category:${category}`];
    }

    return boost;
  }
}

module.exports = new LearningEngine();

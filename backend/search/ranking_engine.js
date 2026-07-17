/**
 * Travel OS — Ranking Engine
 *
 * Scores and re-ranks merged search results against the user's TravelProfile.
 * Integrates with the Learning Engine to apply personal boosts/penalties.
 */

"use strict";

const learningEngine = require("../learning/learning_engine");

class RankingEngine {
  /**
   * Score and sort merged search results against a Travel Profile.
   *
   * @param {object[]} results - SearchResult objects
   * @param {object} [profile] - TravelProfile object
   * @returns {object[]} ranked results
   */
  rank(results, profile = null) {
    if (!results || results.length === 0) return [];
    if (!profile) return results;

    const scored = results.map(item => {
      // Base confidence score (0.0 to 1.0)
      const baseScore = item.confidence?.score || 0.9;
      
      // Calculate personal weights boost (positive or negative)
      // Boost is scaled down to influence rank without completely overriding availability
      const boost = learningEngine.getBoost(profile, item) / 100;
      
      const finalScore = Math.max(0.1, Math.min(1.0, baseScore + boost));

      return {
        ...item,
        _rankingScore: finalScore
      };
    });

    // Sort descending by calculated score
    return scored.sort((a, b) => b._rankingScore - a._rankingScore);
  }
}

module.exports = new RankingEngine();

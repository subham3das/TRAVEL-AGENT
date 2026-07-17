/**
 * Travel OS — Confidence Scorer
 *
 * Dynamic scoring engine. Calculates confidence from multiple signals:
 * - Source diversity (KG + provider cross-validation)
 * - Data completeness (how many expected fields are present)
 * - Freshness (decay over time since data was fetched)
 * - Rating quality (user ratings if available)
 * - Provider reliability (known reliability of the source)
 *
 * Each factor returns a 0-1 score. Final confidence is the weighted sum.
 */

"use strict";

const FACTOR_WEIGHTS = {
  sourceDiversity: 0.30,
  dataCompleteness: 0.20,
  freshness: 0.20,
  ratingQuality: 0.15,
  providerReliability: 0.15
};

const PROVIDER_RELIABILITY = {
  knowledge_graph: 0.98,
  amadeus: 0.95,
  google_places: 0.93,
  booking: 0.92,
  google_maps: 0.91,
  weather: 0.90,
  events: 0.88,
  train: 0.94,
  flight: 0.93,
  hotel: 0.90,
  bus: 0.89,
  rental: 0.91,
  activity: 0.90,
  internet_search: 0.75,
  default: 0.80
};

const EXPECTED_FIELDS = {
  hotel: ["name", "location", "pricing", "rating", "amenities", "images"],
  flight: ["name", "pricing", "departureTime", "arrivalTime", "duration", "stops"],
  activity: ["name", "location", "rating", "duration", "pricing"],
  restaurant: ["name", "location", "rating", "pricing"],
  weather: ["temperature", "condition", "forecast"],
  default: ["name", "location", "pricing"]
};

const FRESHNESS_HALF_LIFE_MS = 4 * 60 * 60 * 1000;

class ConfidenceScorer {
  /**
   * Calculate confidence for a single result.
   * @param {object} result - merged search result
   * @param {object} [diagnostics] - merge diagnostics with source map
   * @param {object} [opts] - { now: number (timestamp), cacheAgeMs: number }
   * @returns {{ score: number, level: string, reason: string, factors: object }}
   * @template T
   */
  score(result, diagnostics = null, opts = {}) {
    const now = opts.now || Date.now();
    const cacheAgeMs = opts.cacheAgeMs || 0;

    const factors = {
      sourceDiversity: this._scoreSourceDiversity(result, diagnostics),
      dataCompleteness: this._scoreDataCompleteness(result),
      freshness: this._scoreFreshness(result, now, cacheAgeMs),
      ratingQuality: this._scoreRating(result),
      providerReliability: this._scoreProviderReliability(result, diagnostics)
    };

    let totalScore = 0;
    for (const [key, weight] of Object.entries(FACTOR_WEIGHTS)) {
      totalScore += factors[key] * weight;
    }

    const score = Math.max(0, Math.min(1, Number(totalScore.toFixed(3))));
    const level = this._level(score);
    const reason = this._explain(factors, score, level);

    return { score, level, reason, factors };
  }

  /**
   * Factor: Source Diversity
   * More independent sources = higher confidence.
   */
  _scoreSourceDiversity(result, diagnostics) {
    if (diagnostics?.sources) {
      const uniqueSources = new Set(Object.values(diagnostics.sources));
      if (uniqueSources.size >= 3) return 1.0;
      if (uniqueSources.has("knowledge_graph") && uniqueSources.has("booking_provider")) return 0.96;
      if (uniqueSources.has("knowledge_graph") && uniqueSources.has("internet_search")) return 0.90;
      if (uniqueSources.has("booking_provider") && uniqueSources.has("internet_search")) return 0.85;
      if (uniqueSources.has("knowledge_graph")) return 0.88;
      if (uniqueSources.has("booking_provider")) return 0.80;
      if (uniqueSources.has("internet_search")) return 0.65;
      return 0.70;
    }

    const source = result.source || "unknown";
    if (source === "knowledge_graph") return 0.95;
    if (source === "search_layer") return 0.75;
    return 0.60;
  }

  /**
   * Factor: Data Completeness
   * How many expected fields are populated.
   */
  _scoreDataCompleteness(result) {
    const type = result.type || "default";
    const expected = EXPECTED_FIELDS[type] || EXPECTED_FIELDS.default;

    let present = 0;
    for (const field of expected) {
      const val = result[field] || result.metadata?.[field];
      if (val !== undefined && val !== null && val !== "" &&
          !(Array.isArray(val) && val.length === 0)) {
        present++;
      }
    }

    return expected.length > 0 ? present / expected.length : 0.7;
  }

  /**
   * Factor: Freshness
   * Confidence decays exponentially with data age.
   * Half-life: 4 hours. Data older than 24h gets minimum score.
   */
  _scoreFreshness(result, now, cacheAgeMs) {
    const verifiedAt = result.confidence?.verifiedAt
      ? new Date(result.confidence.verifiedAt).getTime()
      : now;

    const ageMs = cacheAgeMs || Math.max(0, now - verifiedAt);

    if (ageMs < 60 * 1000) return 1.0;
    if (ageMs > 24 * 60 * 60 * 1000) return 0.50;

    const decay = Math.pow(0.5, ageMs / FRESHNESS_HALF_LIFE_MS);
    return 0.50 + (decay * 0.50);
  }

  /**
   * Factor: Rating Quality
   * User ratings boost confidence. Low ratings penalize.
   */
  _scoreRating(result) {
    const rating = result.rating;
    if (rating === undefined || rating === null) return 0.70;

    if (rating >= 4.5) return 1.0;
    if (rating >= 4.0) return 0.92;
    if (rating >= 3.5) return 0.85;
    if (rating >= 3.0) return 0.75;
    if (rating >= 2.0) return 0.55;
    return 0.40;
  }

  /**
   * Factor: Provider Reliability
   * Known reliability of the data source.
   */
  _scoreProviderReliability(result, diagnostics) {
    if (diagnostics?.sources) {
      const providers = Object.values(diagnostics.sources);
      if (providers.length === 0) return PROVIDER_RELIABILITY.default;

      let total = 0;
      for (const p of providers) {
        total += PROVIDER_RELIABILITY[p] || PROVIDER_RELIABILITY.default;
      }
      return total / providers.length;
    }

    const source = result.source || "default";
    return PROVIDER_RELIABILITY[source] || PROVIDER_RELIABILITY.default;
  }

  /**
   * Map score to confidence level.
   */
  _level(score) {
    if (score >= 0.85) return "HIGH";
    if (score >= 0.60) return "MEDIUM";
    return "LOW";
  }

  /**
   * Generate human-readable explanation from factors.
   */
  _explain(factors, score, level) {
    const parts = [];

    if (factors.sourceDiversity >= 0.90) {
      parts.push("cross-verified across multiple sources");
    } else if (factors.sourceDiversity >= 0.75) {
      parts.push("sourced from a reliable provider");
    } else {
      parts.push("limited source verification");
    }

    if (factors.dataCompleteness >= 0.85) {
      parts.push("complete data available");
    } else if (factors.dataCompleteness < 0.60) {
      parts.push("some details missing");
    }

    if (factors.freshness >= 0.90) {
      parts.push("recently verified");
    } else if (factors.freshness < 0.70) {
      parts.push("data may be stale");
    }

    if (factors.ratingQuality >= 0.85) {
      parts.push("highly rated by travelers");
    } else if (factors.ratingQuality < 0.60) {
      parts.push("lower traveler ratings");
    }

    const base = level === "HIGH"
      ? "Confidently recommended"
      : level === "MEDIUM"
        ? "Reasonably confident"
        : "I'd like to verify this before recommending it";

    return parts.length > 0
      ? `${base} — ${parts.join(", ")}.`
      : base + ".";
  }
}

module.exports = ConfidenceScorer;

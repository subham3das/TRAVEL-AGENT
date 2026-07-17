/**
 * Travel OS — Confidence Alerts
 *
 * Detects low-confidence results and generates verification messages.
 * When confidence < threshold, the system flags the item and produces
 * a human-readable alert for the user.
 */

"use strict";

const DEFAULT_THRESHOLD = 0.60;
const MEDIUM_THRESHOLD = 0.85;

const VERIFICATION_TEMPLATES = {
  hotel: "I'd like to verify this hotel before recommending it — the information may be incomplete or unconfirmed.",
  flight: "I'd like to verify this flight option before recommending it — pricing or availability may not be current.",
  activity: "I'd like to verify this activity before recommending it — details may be limited.",
  restaurant: "I'd like to verify this restaurant before recommending it — limited review data available.",
  weather: "Weather data for this period may be preliminary — I'd recommend closer to your trip date.",
  default: "I'd like to verify this before recommending it — some details may be uncertain."
};

const MEDIUM_TEMPLATES = {
  hotel: "This hotel looks solid, but I'd double-check pricing closer to your dates.",
  flight: "Good option — prices may shift, so booking sooner locks in the rate.",
  activity: "Worth considering — I'd confirm availability on arrival.",
  restaurant: "Recommended — you may want to check current opening hours.",
  default: "Reasonably confident — details may vary slightly."
};

class ConfidenceAlerts {
  constructor(opts = {}) {
    this.lowThreshold = opts.lowThreshold ?? DEFAULT_THRESHOLD;
    this.mediumThreshold = opts.mediumThreshold ?? MEDIUM_THRESHOLD;
  }

  /**
   * Evaluate a single candidate and return an alert if needed.
   * @param {object} candidate - must have { confidence: { score, level, reason } }
   * @returns {{ level: string, message: string, score: number } | null}
   */
  evaluate(candidate) {
    const conf = candidate.confidence;
    if (!conf || typeof conf.score !== "number") return null;

    const score = conf.score;
    const type = candidate.type || "default";

    if (score < this.lowThreshold) {
      return {
        level: "LOW",
        message: VERIFICATION_TEMPLATES[type] || VERIFICATION_TEMPLATES.default,
        score,
        reason: conf.reason || ""
      };
    }

    if (score < this.mediumThreshold) {
      return {
        level: "MEDIUM",
        message: MEDIUM_TEMPLATES[type] || MEDIUM_TEMPLATES.default,
        score,
        reason: conf.reason || ""
      };
    }

    return null;
  }

  /**
   * Evaluate all candidates and return alerts + summary.
   * @param {object[]} candidates
   * @returns {{ alerts: object[], summary: object }}
   */
  evaluateAll(candidates) {
    const alerts = [];
    let lowCount = 0;
    let mediumCount = 0;
    let highCount = 0;

    for (const c of candidates) {
      const alert = this.evaluate(c);
      if (alert) {
        alerts.push({ candidateId: c.id, candidateName: c.name, ...alert });
        if (alert.level === "LOW") lowCount++;
        else mediumCount++;
      } else {
        highCount++;
      }
    }

    const total = candidates.length;
    const overallConfidence = total > 0
      ? candidates.reduce((sum, c) => sum + (c.confidence?.score || 0), 0) / total
      : 1.0;

    return {
      alerts,
      summary: {
        total,
        high: highCount,
        medium: mediumCount,
        low: lowCount,
        overallConfidence: Number(overallConfidence.toFixed(2)),
        needsVerification: lowCount > 0,
        verificationMessage: lowCount > 0
          ? "Some recommendations need verification before I can confidently suggest them."
          : mediumCount > 0
            ? "Most recommendations look solid — a few details may need a second look."
            : "All recommendations are well-verified."
      }
    };
  }

  /**
   * Generate a single verification prompt for the lowest-confidence item.
   * Used when the conversation flow needs to address uncertainty.
   * @param {object[]} candidates
   * @returns {string | null}
   */
  getWeakestVerification(candidates) {
    if (!candidates || candidates.length === 0) return null;

    let weakest = null;
    let lowestScore = Infinity;

    for (const c of candidates) {
      const score = c.confidence?.score;
      if (typeof score === "number" && score < lowestScore) {
        lowestScore = score;
        weakest = c;
      }
    }

    if (!weakest || lowestScore >= this.lowThreshold) return null;

    const type = weakest.type || "default";
    return `${VERIFICATION_TEMPLATES[type] || VERIFICATION_TEMPLATES.default} "${weakest.name || weakest.title}" scored ${Math.round(lowestScore * 100)}% confidence.`;
  }
}

module.exports = ConfidenceAlerts;

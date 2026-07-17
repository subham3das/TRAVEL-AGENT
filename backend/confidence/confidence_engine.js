/**
 * Travel OS — Confidence Engine
 *
 * Pipeline stage that enriches every recommendation with dynamic confidence.
 * Uses ConfidenceScorer for multi-factor scoring and ConfidenceAlerts for
 * low-confidence verification messages.
 *
 * Enriched shape:
 *   result.confidence = {
 *     score,        // 0-1
 *     level,        // "HIGH" | "MEDIUM" | "LOW"
 *     reason,       // human-readable explanation
 *     verifiedAt,   // ISO timestamp
 *     source,       // data origin
 *     factors: {    // individual scoring components
 *       sourceDiversity,
 *       dataCompleteness,
 *       freshness,
 *       ratingQuality,
 *       providerReliability
 *     }
 *   }
 */

"use strict";

const ConfidenceScorer = require("./confidence_scorer");
const ConfidenceAlerts = require("./confidence_alerts");

class ConfidenceEngine {
  constructor(opts = {}) {
    this.scorer = new ConfidenceScorer(opts.scorer);
    this.alerts = new ConfidenceAlerts(opts.alerts);
  }

  /**
   * Enrich a single merged search result with confidence metadata.
   * @param {object} result - the merged search result object
   * @param {object} [diagnostics] - MergeDiagnostics mapping fields to sources
   * @param {object} [opts] - { now, cacheAgeMs }
   * @returns {object} enriched search result
   */
  enrich(result, diagnostics = null, opts = {}) {
    if (!result) return result;

    const { score, level, reason, factors } = this.scorer.score(result, diagnostics, opts);

    result.confidence = {
      score,
      level,
      reason,
      verifiedAt: new Date().toISOString(),
      source: result.source || "unknown",
      factors
    };

    return result;
  }

  /**
   * Pipeline run method.
   * Enriches all candidates, runs alert detection, attaches verification prompts.
   * @param {object} context - TravelContext
   * @returns {object} response envelope
   */
  run(context) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      const candidates = context?.recommendations?.candidates || [];
      const cacheAgeMs = context?.metadata?.cacheAgeMs || 0;
      const now = Date.now();

      const enrichedCandidates = candidates.map(c => this.enrich(c, null, { now, cacheAgeMs }));

      if (context?.recommendations) {
        context.recommendations.candidates = enrichedCandidates;
      }

      const avgScore = enrichedCandidates.length > 0
        ? enrichedCandidates.reduce((acc, c) => acc + (c.confidence?.score || 0.9), 0) / enrichedCandidates.length
        : 1.0;

      if (context?.recommendations) {
        context.recommendations.confidenceScore = Number(avgScore.toFixed(2));
      }

      const { alerts, summary } = this.alerts.evaluateAll(enrichedCandidates);

      if (context?.recommendations) {
        context.recommendations.confidenceAlerts = alerts;
        context.recommendations.confidenceSummary = summary;
      }

      const weakestPrompt = this.alerts.getWeakestVerification(enrichedCandidates);

      if (summary.needsVerification) {
        warnings.push(summary.verificationMessage);
      }

      if (weakestPrompt) {
        warnings.push(weakestPrompt);
      }

      return {
        success: true,
        data: {
          candidates: enrichedCandidates,
          confidenceScore: Number(avgScore.toFixed(2)),
          alerts,
          summary
        },
        errors,
        warnings,
        confidence: Number(avgScore.toFixed(2)),
        processingTime: Date.now() - startTime,
        metadata: {
          stage: "CONFIDENCE",
          lowConfidenceItems: alerts.filter(a => a.level === "LOW").length,
          needsVerification: summary.needsVerification
        }
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
        metadata: { stage: "CONFIDENCE" }
      };
    }
  }
}

module.exports = new ConfidenceEngine();

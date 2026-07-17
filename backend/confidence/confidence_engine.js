/**
 * Travel OS — Confidence Engine
 *
 * Enrichment component. Evaluates merged search results and attaches a structured
 * confidence object containing score, reason, verifiedAt, and source.
 * Does not transform any other fields.
 */

"use strict";

class ConfidenceEngine {
  /**
   * Enrich a merged search result with confidence metadata.
   * @param {object} result - the merged search result object
   * @param {object} [diagnostics] - MergeDiagnostics mapping fields to sources
   * @returns {object} enriched search result
   */
  enrich(result, diagnostics = null) {
    if (!result) return result;

    const source = result.source || "unknown";
    let score = 0.85; // default baseline
    let reason = "Standard provider results.";

    // 1. Calculate confidence score & reason
    if (source === "knowledge_graph") {
      score = 0.98;
      reason = "Verified against canonical Knowledge Graph facts.";
    } else if (diagnostics?.sources) {
      const srcMap = diagnostics.sources;
      const count = Object.keys(srcMap).length;
      
      // Calculate how many different sources verified this entity
      const uniqueSources = new Set(Object.values(srcMap));
      
      if (uniqueSources.has("knowledge_graph") && uniqueSources.has("booking_provider")) {
        score = 0.96;
        reason = "Verified statically in Knowledge Graph and matched with live provider rates.";
      } else if (uniqueSources.has("knowledge_graph") && uniqueSources.has("internet_search")) {
        score = 0.93;
        reason = "Matched Knowledge Graph facts with live public ratings and reviews.";
      } else if (uniqueSources.has("booking_provider")) {
        score = 0.88;
        reason = "Sourced directly from live booking inventory.";
      } else if (uniqueSources.has("internet_search")) {
        score = 0.75;
        reason = "Sourced from public internet searches. Rates not verified.";
      }
    } else {
      // Fallback logic if no diagnostics are passed
      if (result.type === "hotel" && result.pricing?.price > 0) {
        score = 0.88;
        reason = "Dynamic provider pricing available.";
      } else if (result.type === "flight") {
        score = 0.90;
        reason = "Live flight schedule from Skyscanner.";
      }
    }

    // Ensure rating affects confidence slightly
    if (result.rating && result.rating < 3.0) {
      score = Math.max(0.5, score - 0.1);
      reason += " Warning: Low user rating.";
    }

    // Attach confidence property (enrichment, not transformation)
    result.confidence = {
      score: Number(score.toFixed(2)),
      reason,
      verifiedAt: new Date().toISOString(),
      source
    };

    return result;
  }

  /**
   * Pipeline run method.
   * Conforms to the standard engine response contract.
   * @param {object} context - TravelContext
   * @returns {object} response envelope
   */
  run(context) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      const candidates = context?.recommendations?.candidates || [];
      const enrichedCandidates = candidates.map(c => this.enrich(c));

      if (context?.recommendations) {
        context.recommendations.candidates = enrichedCandidates;
      }

      // Calculate aggregate confidence
      const avgScore = enrichedCandidates.length > 0
        ? enrichedCandidates.reduce((acc, c) => acc + (c.confidence?.score || 0.9), 0) / enrichedCandidates.length
        : 1.0;

      if (context?.recommendations) {
        context.recommendations.confidenceScore = Number(avgScore.toFixed(2));
      }

      return {
        success: true,
        data: {
          candidates: enrichedCandidates,
          confidenceScore: Number(avgScore.toFixed(2))
        },
        errors,
        warnings,
        confidence: Number(avgScore.toFixed(2)),
        processingTime: Date.now() - startTime,
        metadata: { stage: "CONFIDENCE" }
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

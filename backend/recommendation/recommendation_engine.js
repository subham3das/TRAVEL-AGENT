/**
 * Travel OS — Recommendation Engine
 *
 * Ranks attractions and restaurants from the Knowledge Repository.
 * Returns Candidate domain objects — no raw KG nodes escape this layer.
 *
 * What this does NOT do:
 * - Calls Search Repository directly (that's CandidateFlow's job)
 * - Fabricates image URLs (uses KG node images or null)
 * - Hardcodes prices (uses priceLabel from KG or null)
 */

"use strict";

const knowledgeRepository = require("../repository/knowledge_repository");
const { Candidate }       = require("../domain/models");
const { validateRecommendationResponse } = require("../contracts/EngineContracts");

class RecommendationEngine {
  async recommend(intent) {
    const startTime = Date.now();
    const errors    = [];
    const warnings  = [];

    try {
      if (!intent?.destination) {
        throw new Error("RecommendationEngine requires a destination intent");
      }

      const destinationId  = intent.destination;
      const travelersType  = intent.travelersType || "solo";
      const travelStyle    = intent.travelStyle   || "mid";
      const season         = intent.season        || "unknown";
      const selectedPlaces = intent.selectedPlaces || [];

      // Fetch typed domain objects from Knowledge Repository (static facts)
      const [attractions, restaurants] = await Promise.all([
        knowledgeRepository.getAttractions(destinationId, travelStyle),
        knowledgeRepository.getRestaurants(destinationId)
      ]);

      const selectedIds = new Set(selectedPlaces.map(p => p.id));

      // Score and convert attractions → Candidate objects
      const rankedCandidates = [];

      for (const attr of attractions) {
        let score = Math.round((attr.confidence || 0.5) * 100);

        // Boost for traveler type match (sourced from raw KG node if available)
        const rawNode = knowledgeRepository.getNode(attr.id);
        if (rawNode?.plannerScore?.[travelersType]) {
          score += rawNode.plannerScore[travelersType];
        }
        if (rawNode?.budgetCategory === travelStyle) score += 20;
        if (selectedIds.has(attr.id)) score += 50; // boost user-selected places

        rankedCandidates.push(Candidate({
          id:          attr.id,
          name:        attr.name,
          type:        attr.type || "attraction",
          images:      attr.images,                 // from KG — null if unavailable
          description: attr.description || "A recommended place to visit.",
          priceLabel:  attr.priceLabel,             // from KG — no fabrication
          rating:      attr.rating,
          location:    attr.location,
          confidence:  Math.min(score / 100, 1),
          source:      "knowledge_graph",
          reason:      `Highly rated for ${travelersType} travel in ${season} season.`,
          raw:         { ...attr, rawScore: score }
        }));
      }

      for (const rest of restaurants) {
        let score = Math.round((rest.confidence || 0.5) * 100);
        const rawNode = knowledgeRepository.getNode(rest.id);
        if (rawNode?.budgetCategory === travelStyle) score += 20;

        rankedCandidates.push(Candidate({
          id:          rest.id,
          name:        rest.name,
          type:        "restaurant",
          images:      rest.images,
          description: rest.description,
          rating:      rest.rating,
          location:    rest.location,
          confidence:  Math.min(score / 100, 1),
          source:      "knowledge_graph",
          reason:      `Excellent dining for ${travelStyle} budgets.`,
          raw:         { ...rest, rawScore: score }
        }));
      }

      // Sort by confidence descending
      rankedCandidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

      if (rankedCandidates.length === 0) {
        warnings.push(`No KG data for destination: ${destinationId}`);
      }

      const response = validateRecommendationResponse({
        candidates: rankedCandidates,
        metadata:   { season, travelersType, totalCandidates: rankedCandidates.length }
      });

      return {
        success: true,
        data:    response,
        errors,
        warnings,
        confidence:      rankedCandidates.length > 0 ? 0.9 : 0.3,
        processingTime:  Date.now() - startTime,
        metadata:        { stage: "RECOMMENDATION" }
      };

    } catch (err) {
      errors.push(err.message);
      return {
        success: false,
        data:    null,
        errors,
        warnings,
        confidence:     0,
        processingTime: Date.now() - startTime,
        metadata:       { stage: "RECOMMENDATION" }
      };
    }
  }
}

module.exports = new RecommendationEngine();

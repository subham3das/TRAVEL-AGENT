/**
 * Travel OS — Recommendation Engine v2
 *
 * Multi-factor scoring with explainable recommendations.
 *
 * Scoring Weights:
 *   0.30  Budget Match
 *   0.20  User Preferences (traveler type + style)
 *   0.15  Location Proximity
 *   0.15  Reviews / Rating
 *   0.10  Season Suitability
 *   0.05  Popularity (plannerScore aggregate)
 *   0.05  Availability (closing days, crowd level)
 *
 * Every candidate returns:
 *   - confidence: 0-1
 *   - reasons: string[] — why recommended
 *   - tradeoffs: string[] — what you give up
 *   - alternatives: Candidate[] — close competitors
 *   - scoreBreakdown: { factor: number } — per-factor scores
 */

"use strict";

const knowledgeRepository = require("../repository/knowledge_repository");
const knowledgeService = require("../knowledge/knowledge_service");
const { Candidate } = require("../domain/models");
const { validateRecommendationResponse } = require("../contracts/EngineContracts");
const learningEngine = require("../learning/learning_engine");

// ── Scoring Weights ──────────────────────────────────────────────────────────
const WEIGHTS = {
  budgetMatch:    0.25,
  preferences:    0.18,
  location:       0.13,
  reviews:        0.13,
  season:         0.09,
  popularity:     0.05,
  availability:   0.05,
  learning:       0.12,
};

// ── Budget Range Map ─────────────────────────────────────────────────────────
// Maps travelStyle to expected per-night budget ranges (INR)
const BUDGET_RANGES = {
  budget: { min: 500,   max: 3000,  ideal: 1500 },
  mid:    { min: 2000,  max: 8000,  ideal: 5000 },
  luxury: { min: 6000,  max: 25000, ideal: 12000 },
};

// ── Season Map ───────────────────────────────────────────────────────────────
const SEASON_MONTHS = {
  winter: [11, 0, 1],       // Dec, Jan, Feb
  summer: [2, 3, 4],        // Mar, Apr, May
  rain:   [5, 6, 7, 8],     // Jun, Jul, Aug, Sep
  sunny:  [9, 10],          // Oct, Nov
};

class RecommendationEngineV2 {
  async recommend(intent) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      if (!intent?.destination) {
        throw new Error("RecommendationEngineV2 requires a destination");
      }

      const destinationId  = intent.destination;
      const travelersType  = intent.travelersType || "solo";
      const travelStyle    = intent.travelStyle   || "mid";
      const budget         = Number(intent.budget) || null;
      const season         = this.resolveSeason(intent.season, intent.travelDates);
      const selectedPlaces = intent.selectedPlaces || [];

      // Fetch all candidates from Knowledge Repository
      const [attractions, restaurants, hotelFacts] = await Promise.all([
        knowledgeRepository.getAttractions(destinationId, travelStyle),
        knowledgeRepository.getRestaurants(destinationId),
        knowledgeRepository.getHotelFacts(destinationId),
      ]);

      const selectedIds = new Set(selectedPlaces.map(p => p.id || p));

      // ── Score Attractions ──────────────────────────────────────────────
      const scoredAttractions = attractions.map(attr => {
        const raw = knowledgeRepository.getNode(attr.id);
        const scoring = this.scoreCandidate(raw, {
          travelersType, travelStyle, budget, season, selectedIds,
          type: "attraction",
        });
        return this.buildCandidate(attr, scoring, "attraction", raw);
      });

      // ── Score Restaurants ──────────────────────────────────────────────
      const scoredRestaurants = restaurants.map(rest => {
        const raw = knowledgeRepository.getNode(rest.id);
        const scoring = this.scoreCandidate(raw, {
          travelersType, travelStyle, budget, season, selectedIds,
          type: "restaurant",
        });
        return this.buildCandidate(rest, scoring, "restaurant", raw);
      });

      // ── Score Hotels (from KG facts) ──────────────────────────────────
      const scoredHotels = hotelFacts.map(hotel => {
        const raw = knowledgeRepository.getNode(hotel.id);
        const scoring = this.scoreCandidate(raw, {
          travelersType, travelStyle, budget, season, selectedIds,
          type: "hotel",
        });
        return this.buildCandidate(hotel, scoring, "hotel", raw);
      });

      // Combine and sort by confidence
      const allScored = [...scoredAttractions, ...scoredRestaurants, ...scoredHotels];
      allScored.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

      // ── Attach Alternatives ────────────────────────────────────────────
      // For each top candidate, find 1-2 close alternatives from same type
      for (const candidate of allScored) {
        const sameType = allScored.filter(
          c => c.type === candidate.type && c.id !== candidate.id
        );
        const close = sameType
          .filter(c => Math.abs((c.confidence || 0) - (candidate.confidence || 0)) < 0.15)
          .slice(0, 2);
        candidate.alternatives = close.map(alt => ({
          id: alt.id,
          name: alt.name,
          confidence: alt.confidence,
          priceLabel: alt.priceLabel,
          reason: alt.reasons?.[0] || alt.reason,
        }));
      }

      if (allScored.length === 0) {
        warnings.push(`No candidates found for destination: ${destinationId}`);
      }

      const response = validateRecommendationResponse({
        candidates: allScored,
        metadata: {
          season,
          travelersType,
          travelStyle,
          budget,
          totalCandidates: allScored.length,
          engineVersion: "v2",
          scoringWeights: WEIGHTS,
        },
      });

      return {
        success: true,
        data: response,
        errors,
        warnings,
        confidence: allScored.length > 0 ? 0.92 : 0.3,
        processingTime: Date.now() - startTime,
        metadata: { stage: "RECOMMENDATION", engine: "v2" },
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
        metadata: { stage: "RECOMMENDATION", engine: "v2" },
      };
    }
  }

  // ── Scoring ────────────────────────────────────────────────────────────────

  scoreCandidate(rawNode, ctx) {
    if (!rawNode) return { total: 0, breakdown: {}, reasons: [], tradeoffs: [] };

    const breakdown = {};
    const reasons = [];
    const tradeoffs = [];

    // 1. Budget Match (0.30)
    breakdown.budgetMatch = this.scoreBudgetMatch(rawNode, ctx);

    // 2. User Preferences (0.20)
    breakdown.preferences = this.scorePreferences(rawNode, ctx);

    // 3. Location (0.15)
    breakdown.location = this.scoreLocation(rawNode, ctx);

    // 4. Reviews (0.15)
    breakdown.reviews = this.scoreReviews(rawNode, ctx);

    // 5. Season (0.10)
    breakdown.season = this.scoreSeason(rawNode, ctx);

    // 6. Popularity (0.05)
    breakdown.popularity = this.scorePopularity(rawNode, ctx);

    // 7. Availability (0.05)
    breakdown.availability = this.scoreAvailability(rawNode, ctx);

    // 8. Learning Boost (0.12) — personal ranking weights from past behavior
    breakdown.learning = this.scoreLearning(rawNode, ctx);

    // Generate reasons and tradeoffs from scores
    this.generateReasons(rawNode, ctx, breakdown, reasons, tradeoffs);

    // Weighted total
    const total = Math.round(
      breakdown.budgetMatch * WEIGHTS.budgetMatch +
      breakdown.preferences * WEIGHTS.preferences +
      breakdown.location   * WEIGHTS.location +
      breakdown.reviews    * WEIGHTS.reviews +
      breakdown.season     * WEIGHTS.season +
      breakdown.popularity * WEIGHTS.popularity +
      breakdown.availability * WEIGHTS.availability +
      breakdown.learning   * WEIGHTS.learning
    );

    return { total: Math.min(total, 100), breakdown, reasons, tradeoffs };
  }

  // ── Factor: Budget Match (0-100) ───────────────────────────────────────────

  scoreBudgetMatch(rawNode, ctx) {
    const { budget, travelStyle, type } = ctx;

    // For attractions/restaurants: use estimatedSpend
    if (type === "attraction" && rawNode.estimatedSpend) {
      const spend = rawNode.estimatedSpend[travelStyle] || rawNode.estimatedSpend.mid || 300;
      if (!budget) return 70; // neutral if no budget specified

      const dailyBudget = budget;
      const ratio = spend / dailyBudget;
      if (ratio <= 0.1) return 95;   // very cheap relative to budget
      if (ratio <= 0.25) return 85;
      if (ratio <= 0.4) return 75;
      if (ratio <= 0.6) return 60;
      if (ratio <= 0.8) return 40;
      return 20; // too expensive
    }

    // For hotels: use category match
    if (type === "hotel") {
      const category = rawNode.category || "mid";
      if (category === travelStyle) return 95;
      const styleOrder = { budget: 0, mid: 1, luxury: 2 };
      const diff = Math.abs((styleOrder[category] || 1) - (styleOrder[travelStyle] || 1));
      if (diff === 0) return 95;
      if (diff === 1) return 65;
      return 30;
    }

    // For restaurants: use priceLevel
    if (type === "restaurant") {
      const priceLevel = rawNode.priceLevel || "mid";
      const levelMap = { budget: 0, mid: 1, luxury: 2 };
      const diff = Math.abs((levelMap[priceLevel] || 1) - (levelMap[travelStyle] || 1));
      if (diff === 0) return 90;
      if (diff === 1) return 60;
      return 30;
    }

    return 70; // default neutral
  }

  // ── Factor: User Preferences (0-100) ───────────────────────────────────────

  scorePreferences(rawNode, ctx) {
    const { travelersType, travelStyle, type } = ctx;
    let score = 50; // baseline

    if (type === "attraction") {
      // Use plannerScore from KG
      if (rawNode.plannerScore) {
        const typeScore = rawNode.plannerScore[travelersType];
        if (typeScore) score = typeScore;
      }

      // Boost for friendliness flags
      if (travelersType === "family" && rawNode.familyFriendly) score += 15;
      if (travelersType === "couple" && rawNode.coupleFriendly) score += 15;
      if (travelersType === "solo" && rawNode.soloFriendly) score += 15;

      // Style match
      if (rawNode.budgetCategory === travelStyle) score += 10;
    }

    if (type === "hotel") {
      if (travelersType === "family" && rawNode.familyFriendly) score += 20;
      if (travelersType === "couple" && rawNode.coupleFriendly) score += 20;

      // Amenity matches
      const amenities = rawNode.amenities || [];
      if (amenities.includes("Pool")) score += 5;
      if (amenities.includes("WiFi")) score += 5;
      if (amenities.includes("Room Service")) score += 5;
    }

    if (type === "restaurant") {
      // Dietary preferences (future: use TravelProfile)
      if (rawNode.vegetarian) score += 5;
      if (rawNode.vegan) score += 5;
    }

    return Math.min(score, 100);
  }

  // ── Factor: Location (0-100) ───────────────────────────────────────────────

  scoreLocation(rawNode, ctx) {
    // Base score from having coordinates
    if (rawNode.coordinates || rawNode.location) return 80;
    if (rawNode.location?.address) return 75;
    return 50; // no location data
  }

  // ── Factor: Reviews (0-100) ────────────────────────────────────────────────

  scoreReviews(rawNode, ctx) {
    const rating = rawNode.rating || rawNode.confidence;
    if (!rating) return 50;

    // Normalize to 0-100
    if (rating <= 5) return Math.round(rating * 20); // 5-star scale
    return Math.round(rating * 100); // already 0-1 scale
  }

  // ── Factor: Season (0-100) ─────────────────────────────────────────────────

  scoreSeason(rawNode, ctx) {
    const { season } = ctx;
    if (!season || season === "unknown") return 70;

    // For attractions: use weatherProfile
    if (rawNode.weatherProfile) {
      const seasonScore = rawNode.weatherProfile[season];
      if (seasonScore !== undefined) return seasonScore;
    }

    return 70; // neutral if no weather data
  }

  // ── Factor: Popularity (0-100) ─────────────────────────────────────────────

  scorePopularity(rawNode, ctx) {
    if (!rawNode.plannerScore) return 50;

    const scores = Object.values(rawNode.plannerScore);
    if (scores.length === 0) return 50;

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return Math.round(avg);
  }

  // ── Factor: Availability (0-100) ───────────────────────────────────────────

  scoreAvailability(rawNode, ctx) {
    let score = 80; // default optimistic

    // Check closing days
    if (rawNode.closingDays && rawNode.closingDays.length > 0) {
      score -= rawNode.closingDays.length * 5;
    }

    // Check crowd level (lower crowd = better experience)
    if (rawNode.crowdProfile) {
      const avgCrowd = Object.values(rawNode.crowdProfile).reduce((a, b) => a + b, 0) / 4;
      if (avgCrowd > 80) score -= 15;
      else if (avgCrowd > 60) score -= 5;
      else score += 5; // low crowd bonus
    }

    return Math.max(20, Math.min(score, 100));
  }

  // ── Factor: Learning Boost (0-100) ────────────────────────────────────────

  scoreLearning(rawNode, ctx) {
    const profile = ctx.profile || ctx.travelProfile;
    if (!profile?.rankingWeights) return 50; // neutral if no learning data

    const boost = learningEngine.getBoost(profile, rawNode);

    // Convert boost [-100, +100] to score [0, 100]
    // boost -30 → score 20, boost 0 → score 50, boost +30 → score 80
    const score = 50 + (boost * 0.3);

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ── Reasons & Tradeoffs ────────────────────────────────────────────────────

  generateReasons(rawNode, ctx, breakdown, reasons, tradeoffs) {
    const { travelersType, travelStyle, season, type } = ctx;

    // Budget reasons
    if (breakdown.budgetMatch >= 80) {
      const spend = type === "hotel"
        ? (rawNode.category === travelStyle ? `${rawNode.category} tier matches your style` : null)
        : null;
      reasons.push(spend || `Fits your ${travelStyle} budget`);
    } else if (breakdown.budgetMatch <= 40) {
      tradeoffs.push(`Pricier than your ${travelStyle} budget`);
    }

    // Preference reasons
    if (breakdown.preferences >= 80) {
      if (type === "attraction") {
        if (travelersType === "family" && rawNode.familyFriendly) reasons.push("Family friendly");
        if (travelersType === "couple" && rawNode.coupleFriendly) reasons.push("Couple friendly");
        if (travelersType === "solo" && rawNode.soloFriendly) reasons.push("Solo traveler approved");
        if (rawNode.budgetCategory === travelStyle) reasons.push(`Perfect for ${travelStyle} travelers`);
      }
      if (type === "hotel") {
        if (rawNode.familyFriendly) reasons.push("Family friendly");
        if (rawNode.coupleFriendly) reasons.push("Couple friendly");
        const amenities = rawNode.amenities || [];
        if (amenities.includes("Pool")) reasons.push("Has pool");
        if (amenities.includes("WiFi")) reasons.push("Free WiFi");
      }
    }

    // Season reasons
    if (breakdown.season >= 80) {
      reasons.push(`Great in ${season} season`);
    } else if (breakdown.season <= 40) {
      tradeoffs.push(`Not ideal for ${season} season`);
    }

    // Reviews reasons
    if (breakdown.reviews >= 85) {
      reasons.push("Highly rated");
    } else if (breakdown.reviews >= 70) {
      reasons.push("Well reviewed");
    }

    // Popularity reasons
    if (breakdown.popularity >= 80) {
      reasons.push("Popular choice");
    }

    // Location reasons
    if (breakdown.location >= 80) {
      reasons.push("Great location");
    }

    // Availability tradeoffs
    if (rawNode.closingDays && rawNode.closingDays.length > 0) {
      tradeoffs.push(`Closed on ${rawNode.closingDays.join(", ")}`);
    }

    // Type-specific insights
    if (rawNode.insights && rawNode.insights.length > 0) {
      reasons.push(rawNode.insights[0]);
    }

    // Learning-based reasons
    const profile = ctx.profile || ctx.travelProfile;
    if (profile?.rankingWeights) {
      const boost = learningEngine.getBoost(profile, rawNode);
      if (boost >= 20) reasons.push("You've enjoyed this before");
      else if (boost >= 10) reasons.push("Matches your past preferences");
      else if (boost <= -20) tradeoffs.push("You didn't enjoy this in the past");
      else if (boost <= -10) tradeoffs.push("Below your past preference level");
    }

    // Fallback reason
    if (reasons.length === 0) {
      reasons.push("Recommended based on overall profile");
    }
  }

  // ── Build Candidate Object ─────────────────────────────────────────────────

  buildCandidate(domainObj, scoring, type, rawNode) {
    return Candidate({
      id:          domainObj.id,
      name:        domainObj.name,
      type,
      images:      domainObj.images,
      description: domainObj.description,
      priceLabel:  domainObj.priceLabel || this.inferPriceLabel(rawNode, type),
      rating:      domainObj.rating || rawNode?.rating || null,
      location:    domainObj.location || rawNode?.location?.address || null,
      confidence:  Math.round(scoring.total) / 100,
      source:      "knowledge_graph",
      reason:      scoring.reasons[0] || "Recommended",
      reasons:     scoring.reasons,
      tradeoffs:   scoring.tradeoffs,
      scoreBreakdown: scoring.breakdown,
      raw:         rawNode ? { ...rawNode, rawScore: scoring.total } : null,
    });
  }

  inferPriceLabel(rawNode, type) {
    if (!rawNode) return null;

    if (type === "hotel") {
      const category = rawNode.category || "mid";
      const range = BUDGET_RANGES[category] || BUDGET_RANGES.mid;
      return `~\u20B9${range.ideal.toLocaleString("en-IN")}/night`;
    }

    if (type === "attraction" && rawNode.estimatedSpend) {
      const spend = rawNode.estimatedSpend.mid || rawNode.estimatedSpend.budget || 0;
      if (spend > 0) return `\u20B9${spend.toLocaleString("en-IN")}`;
    }

    if (type === "restaurant" && rawNode.averageMealCost) {
      return `\u20B9${rawNode.averageMealCost.toLocaleString("en-IN")}/person`;
    }

    return null;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  resolveSeason(explicitSeason, travelDates) {
    if (explicitSeason && explicitSeason !== "unknown") return explicitSeason;

    if (travelDates?.startDate) {
      const date = new Date(travelDates.startDate);
      if (!isNaN(date.getTime())) {
        const month = date.getMonth();
        for (const [season, months] of Object.entries(SEASON_MONTHS)) {
          if (months.includes(month)) return season;
        }
      }
    }

    return "unknown";
  }
}

module.exports = new RecommendationEngineV2();

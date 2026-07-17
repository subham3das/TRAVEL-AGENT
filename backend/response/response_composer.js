/**
 * Travel Intelligence OS - Response Composer.
 *
 * Final deterministic response aggregator and formatter.
 * Conforms to response_composer_spec.md.
 *
 * @module response_composer
 */

class ResponseComposer {
  compose(context, executionResult = null) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      if (!context || typeof context !== "object") {
        throw new Error("Invalid TravelContext: expected an object");
      }

      const recs = context.recommendations || {};
      const state = context.state || {};
      const activeState = state.conversationState || {};
      const execData = executionResult?.data || {};

      const itinerary = recs.optimizedItinerary || recs.improvedItinerary || recs.draftItinerary || null;
      const budget = recs.budgetSummary || null;
      const booking = recs.bookingSuggestions || null;

      // 1. Compile Trip Summary
      const tripSummary = itinerary ? {
        destination: itinerary.destination || "Unknown",
        durationDays: itinerary.durationDays || 0,
        travelStyle: itinerary.travelStyle || "mid",
        travelersType: itinerary.travelersType || "solo",
        totalDistanceKm: itinerary.metrics?.totalDistanceKm || 0,
        totalCost: budget ? budget.totalCost : 0,
        budgetRisk: budget ? budget.budgetRisk : "low"
      } : null;

      // 2. Compile Transport Plan
      const transportPlan = itinerary?.metrics ? {
        totalTravelTimeMinutes: itinerary.metrics.totalTravelTimeMinutes || 0,
        walkingDistanceKm: itinerary.metrics.walkingDistanceKm || 0,
        transportCost: itinerary.metrics.transportCost || 0,
        primaryMode: itinerary.metrics.transportCost > 0 ? "driving" : "walking"
      } : null;

      // 3. Compile Stay Plan
      let stayPlan = null;
      if (itinerary?.dailyPlans?.length > 0) {
        const staySlot = itinerary.dailyPlans[0].slots.find(s => s.type === "stay");
        if (staySlot) {
          stayPlan = {
            hotelName: staySlot.name,
            pricePerNight: booking?.recommendedPlaces?.[0]?.price || 0,
            bookingStatus: staySlot.confirmed ? "confirmed" : "suggested"
          };
        }
      }

      // 4. Compute Travel Score
      const travelScore = this.computeTravelScore(itinerary, budget);

      // 5. Compile Recommendations
      const recommendations = {
        recommendedPlaces: recs.recommendedPlaces || [],
        recommendedRestaurants: recs.recommendedRestaurants || [],
        hiddenGems: recs.hiddenGems || [],
        foodRecommendations: recs.foodRecommendations || [],
        shoppingRecommendations: recs.shoppingRecommendations || [],
        alternatives: recs.alternatives || {},
        recommendationScores: recs.recommendationScores || {}
      };

      // 6. Gather warnings and de-duplicate
      const collectedWarnings = new Set();
      if (executionResult?.warnings) executionResult.warnings.forEach(w => collectedWarnings.add(w));
      if (budget?.validation?.warnings) budget.validation.warnings.forEach(w => collectedWarnings.add(w));
      if (context.warnings) context.warnings.forEach(w => collectedWarnings.add(w));

      // Sort warnings deterministically by length (proxy for detail/severity)
      const importantWarnings = Array.from(collectedWarnings).sort((a, b) => b.length - a.length);

      // 7. Gather errors
      if (executionResult?.errors) executionResult.errors.forEach(e => errors.push(e));
      if (context.errors) context.errors.forEach(e => errors.push(e));

      // 8. Calculate Global Confidence
      const globalConfidence = this.calculateConfidence(context, executionResult);

      // 9. Next Actions decisioning
      const nextActions = [];
      const currentConvState = activeState.currentState || "IDLE";
      if (currentConvState === "WAITING_FOR_CLARIFICATION") {
        nextActions.push("PROVIDE_CLARIFICATION");
      } else if (currentConvState === "PLAN_COMPLETED" || currentConvState === "COMPLETED") {
        nextActions.push("BOOK_TRIP", "MODIFY_PLAN");
      } else if (currentConvState === "ERROR") {
        nextActions.push("RESET");
      } else {
        nextActions.push("INIT_PLAN");
      }

      const executionSummary = execData.executionSummary || (errors.length > 0 ? "Execution failed." : "Execution completed successfully.");

      const data = {
        tripSummary,
        dailyPlan: itinerary ? (itinerary.dailyPlans || []) : [],
        transportPlan,
        stayPlan,
        travelScore,
        budgetSummary: budget,
        categoryBreakdown: recs.categoryBreakdown || null,
        bookingSummary: booking,
        recommendations,
        packingChecklist: recs.packingSuggestions || [],
        weatherAdvice: recs.seasonalAdvice || "",
        safetyTips: recs.safetyTips || [],
        localTips: recs.culturalTips || [],
        importantWarnings,
        conversationState: currentConvState,
        executionSummary,
        nextActions
      };

      return {
        success: errors.length === 0,
        data,
        errors,
        warnings: importantWarnings,
        confidence: globalConfidence,
        processingTime: Date.now() - startTime,
        metadata: {
          composerVersion: "1.0.0",
          responseVersion: "1.0.0",
          generatedAt: new Date().toISOString(),
          executionTime: execData.processingTime || 0,
          completedStages: execData.executedStages || [],
          confidenceBreakdown: {
            planner: itinerary ? 0.95 : 0,
            budget: budget ? 0.98 : 0,
            booking: booking ? 0.95 : 0
          }
        }
      };

    } catch (err) {
      errors.push(err.message);
      return {
        success: false,
        data: null,
        errors,
        warnings,
        confidence: 0.0,
        processingTime: Date.now() - startTime,
        metadata: {}
      };
    }
  }

  // Weighted global confidence calculator
  calculateConfidence(context, execResult) {
    const recs = context.recommendations || {};
    
    let w_planner = 0.30;
    let w_decision = 0.20;
    let w_budget = 0.15;
    let w_booking = 0.15;
    let w_recs = 0.20;

    const c_planner = recs.draftItinerary ? 0.95 : 0;
    const c_decision = recs.improvedItinerary ? 0.96 : 0;
    const c_budget = recs.budgetSummary ? 0.98 : 0;
    const c_booking = recs.bookingSuggestions ? 0.95 : 0;
    const c_recs = recs.recommendedPlaces ? 0.95 : 0;

    // Distribute missing weights to planner and decision
    let missingWeight = 0;
    if (c_planner === 0) { missingWeight += w_planner; w_planner = 0; }
    if (c_decision === 0) { missingWeight += w_decision; w_decision = 0; }
    if (c_budget === 0) { missingWeight += w_budget; w_budget = 0; }
    if (c_booking === 0) { missingWeight += w_booking; w_booking = 0; }
    if (c_recs === 0) { missingWeight += w_recs; w_recs = 0; }

    if (missingWeight > 0) {
      const activeCount = (c_planner > 0 ? 1 : 0) + (c_decision > 0 ? 1 : 0);
      if (activeCount > 0) {
        const share = missingWeight / activeCount;
        if (c_planner > 0) w_planner += share;
        if (c_decision > 0) w_decision += share;
      } else {
        // Fallback if all missing
        return 1.0;
      }
    }

    const globalScore = (
      w_planner * c_planner +
      w_decision * c_decision +
      w_budget * c_budget +
      w_booking * c_booking +
      w_recs * c_recs
    );

    return Number(globalScore.toFixed(2));
  }

  computeTravelScore(itinerary, budgetSummary) {
    let score = 72;
    if (itinerary?.dailyPlans?.length > 0) {
      let totalTransit = 0;
      let count = 0;
      let ratingSum = 0;
      let ratingCount = 0;
      for (const day of itinerary.dailyPlans) {
        totalTransit += day?.metrics?.travelTimeMinutes || 0;
        count++;
        for (const s of day?.slots || []) {
          if (typeof s?.rating === "number") {
            ratingSum += s.rating;
            ratingCount++;
          }
        }
      }
      const avgTransit = count ? totalTransit / count : 0;
      if (avgTransit < 90) score += 8;
      if (ratingCount && ratingSum / ratingCount >= 4.3) score += 10;
    }
    if (budgetSummary?.totalCost && budgetSummary?.breakdown) {
      score += 4;
    }
    score = Math.max(40, Math.min(98, Math.round(score)));
    let label = "Well Balanced";
    let tone = "emerald";
    if (score >= 90) {
      label = "Exceptional";
    } else if (score >= 78) {
      label = "Strong";
    } else if (score >= 60) {
      label = "Solid";
      tone = "gold";
    } else {
      label = "Needs Tuning";
      tone = "amber";
    }
    return { score, label, tone };
  }
}

module.exports = new ResponseComposer();

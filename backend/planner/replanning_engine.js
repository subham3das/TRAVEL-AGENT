const conversationState = require("../conversation/conversation_state");

class ReplanningEngine {
  analyze(currentContext, previousContext) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      if (!currentContext || typeof currentContext !== "object") {
        throw new Error("Invalid current context: expected an object");
      }

      // Check replanning count limit (Max = 5)
      const state = conversationState.getConversationState(currentContext);
      if (state.replanningCount > 5) {
        throw new Error(`Max consecutive replans limit exceeded (${state.replanningCount})`);
      }

      // If no previous context or no existing itinerary, trigger FULL_REPLAN
      const hasPreviousItinerary = !!(previousContext?.recommendations?.optimizedItinerary || previousContext?.recommendations?.draftItinerary);
      if (!previousContext || !hasPreviousItinerary) {
        return this.buildFullReplanResponse("No previous itinerary found. Full planning required.", startTime);
      }

      const currNorm = currentContext.state?.normalizedEntities || {};
      const prevNorm = previousContext.state?.normalizedEntities || {};

      // 1. Detect changed fields
      const changedFields = [];
      const keys = new Set([...Object.keys(currNorm), ...Object.keys(prevNorm)]);
      for (const key of keys) {
        if (JSON.stringify(currNorm[key]) !== JSON.stringify(prevNorm[key])) {
          changedFields.push(key);
        }
      }

      if (changedFields.length === 0) {
        return {
          success: true,
          data: {
            requiresReplanning: false,
            replanningScope: "NONE",
            changedFields: [],
            affectedDays: [],
            preservedDays: Array.from({ length: previousContext.recommendations.optimizedItinerary.dailyPlans?.length || 0 }, (_, i) => i + 1),
            preservedBookings: [],
            preservedRoutes: [],
            plannerInstructions: ["KEEP_EXISTING"],
            downstreamEngines: [],
            changeSeverity: "NONE",
            reason: "No changes detected."
          },
          errors,
          warnings,
          confidence: 1.0,
          processingTime: Date.now() - startTime,
          metadata: {}
        };
      }

      // 2. Determine severity and instructions
      let changeSeverity = "NONE";
      let replanningScope = "NONE";
      const plannerInstructions = [];
      const downstreamEngines = new Set();
      let reason = "Context updates detected: " + changedFields.join(", ");

      let requiresFullReplan = false;
      let requiresDurationChange = false;

      for (const field of changedFields) {
        if (field === "destination" || field === "travelDates") {
          requiresFullReplan = true;
        } else if (field === "durationDays" || field === "duration") {
          requiresDurationChange = true;
        }
      }

      let affectedDays = [];
      let preservedDays = [];
      const prevDaysCount = previousContext.recommendations.optimizedItinerary.dailyPlans?.length || 0;

      if (requiresFullReplan) {
        return this.buildFullReplanResponse("Destination or dates changed. Full planning required.", startTime);
      }

      if (requiresDurationChange) {
        changeSeverity = "HIGH";
        replanningScope = "PARTIAL";
        const currDuration = currNorm.durationDays || currNorm.duration || 3;
        const prevDuration = prevNorm.durationDays || prevNorm.duration || 3;

        if (currDuration > prevDuration) {
          plannerInstructions.push("PLAN_NEW_DAYS_ONLY");
          // Preserve all previous days, affect only the new days
          preservedDays = Array.from({ length: prevDuration }, (_, i) => i + 1);
          affectedDays = Array.from({ length: currDuration - prevDuration }, (_, i) => prevDuration + i + 1);
          
          ["planner", "decision", "optimizer", "budget", "recommendation", "booking"].forEach(e => downstreamEngines.add(e));
          reason = `Trip duration extended from ${prevDuration} to ${currDuration} days. Planning additional days.`;
        } else {
          plannerInstructions.push("TRIM_EXTRA_DAYS");
          // Preserve up to currDuration, affect remaining
          preservedDays = Array.from({ length: currDuration }, (_, i) => i + 1);
          affectedDays = Array.from({ length: prevDuration - currDuration }, (_, i) => currDuration + i + 1);

          ["decision", "optimizer", "budget", "recommendation", "booking"].forEach(e => downstreamEngines.add(e));
          reason = `Trip duration reduced from ${prevDuration} to ${currDuration} days. Trimming extra days.`;
        }
      } else {
        // Medium & Low severity adjustments (duration is same)
        replanningScope = "PARTIAL";
        preservedDays = Array.from({ length: prevDaysCount }, (_, i) => i + 1);

        for (const field of changedFields) {
          if (field === "budget") {
            changeSeverity = this.maxSeverity(changeSeverity, "MEDIUM");
            plannerInstructions.push("REPLAN_BUDGET");
            ["budget", "recommendation"].forEach(e => downstreamEngines.add(e));
            // If budget decreases significantly, we might need decision engine to replace stays
            if (currNorm.budget < prevNorm.budget) {
              plannerInstructions.push("REPLACE_HOTELS");
              downstreamEngines.add("decision");
            }
          } else if (field === "travelStyle" || field === "interests") {
            changeSeverity = this.maxSeverity(changeSeverity, "MEDIUM");
            plannerInstructions.push("REPLAN_RECOMMENDATIONS");
            ["decision", "recommendation"].forEach(e => downstreamEngines.add(e));
          } else if (field === "transport") {
            changeSeverity = this.maxSeverity(changeSeverity, "LOW");
            plannerInstructions.push("REPLAN_ROUTES");
            ["optimizer", "budget", "recommendation"].forEach(e => downstreamEngines.add(e));
          } else if (field === "accommodation") {
            changeSeverity = this.maxSeverity(changeSeverity, "LOW");
            plannerInstructions.push("REPLAN_BOOKINGS");
            downstreamEngines.add("booking");
          } else if (field === "travelers" || field === "travelersType") {
            changeSeverity = this.maxSeverity(changeSeverity, "MEDIUM");
            plannerInstructions.push("REPLAN_BUDGET");
            ["decision", "budget", "recommendation"].forEach(e => downstreamEngines.add(e));
          } else {
            changeSeverity = this.maxSeverity(changeSeverity, "LOW");
            plannerInstructions.push("RECALCULATE");
            downstreamEngines.add("budget");
          }
        }
      }

      // Check for confirmed bookings inside itinerary to preserve
      const preservedBookings = [];
      const dailyPlans = previousContext.recommendations.optimizedItinerary.dailyPlans || [];
      for (const day of dailyPlans) {
        for (const slot of day.slots) {
          if (slot.bookingId || slot.confirmed) {
            preservedBookings.push(slot.bookingId || slot.nodeId);
          }
        }
      }

      // Update state metadata count
      state.replanningCount++;

      const data = {
        requiresReplanning: true,
        replanningScope,
        changedFields,
        affectedDays,
        preservedDays,
        preservedBookings,
        preservedRoutes: [],
        plannerInstructions: [...new Set(plannerInstructions)],
        downstreamEngines: [...downstreamEngines],
        changeSeverity,
        reason
      };

      return {
        success: true,
        data,
        errors,
        warnings,
        confidence: 0.98,
        processingTime: Date.now() - startTime,
        metadata: {}
      };

    } catch (err) {
      errors.push(err.message);
      
      if (currentContext && currentContext.state && currentContext.state.conversationState) {
        currentContext.state.conversationState.currentState = conversationState.STATES.ERROR;
      }

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

  maxSeverity(s1, s2) {
    const severities = ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
    return severities.indexOf(s1) >= severities.indexOf(s2) ? s1 : s2;
  }

  buildFullReplanResponse(reason, start) {
    return {
      success: true,
      data: {
        requiresReplanning: true,
        replanningScope: "FULL",
        changedFields: ["destination"],
        affectedDays: [],
        preservedDays: [],
        preservedBookings: [],
        preservedRoutes: [],
        plannerInstructions: ["FULL_REPLAN"],
        downstreamEngines: ["planner", "decision", "optimizer", "budget", "recommendation", "booking"],
        changeSeverity: "CRITICAL",
        reason
      },
      errors: [],
      warnings: [],
      confidence: 1.0,
      processingTime: Date.now() - start,
      metadata: {}
    };
  }
}

module.exports = new ReplanningEngine();

/**
 * Travel OS — Validation Engine
 *
 * Gate before the Planner. Checks that all required fields are present.
 * If anything is missing, returns success=false so execution halts
 * and CandidateFlow handles the clarification instead.
 *
 * This engine is NON-critical — a missing field is not an error,
 * it is an expected state that routes to clarification.
 */

class ValidationEngine {
  /**
   * Required for PLANNING phase (planner to run).
   * Budget + hotel + flight required only at READY stage.
   */
  static PLANNING_REQUIRED = ["destination"];
  static PLANNER_REQUIRED = ["destination", "durationDays", "selectedHotel", "selectedFlight"];

  validate(context) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];
    const missing = [];

    try {
      const entities = context?.state?.normalizedEntities || {};
      const candidateFlow = context?.state?.conversationState?.candidateFlow || "DESTINATION";
      const isReady = candidateFlow === "READY";

      // Always need destination
      if (!entities.destination) {
        missing.push("destination");
      }

      // Only validate full set if we're at READY stage
      if (isReady) {
        for (const field of ValidationEngine.PLANNER_REQUIRED) {
          if (!entities[field]) missing.push(field);
        }
      }

      const isValid = missing.length === 0;
      if (!isValid) {
        warnings.push(`Validation: missing fields [${missing.join(", ")}] — pipeline will clarify`);
      }

      return {
        success: true, // validation itself succeeded (even if fields are missing)
        data: {
          isValid,
          missing,
          candidateFlow,
          readyForPlanning: isReady && isValid
        },
        errors,
        warnings,
        confidence: 1.0,
        processingTime: Date.now() - startTime,
        metadata: { stage: "VALIDATION" }
      };

    } catch (err) {
      errors.push(err.message);
      return {
        success: false,
        data: { isValid: false, missing: [], readyForPlanning: false },
        errors,
        warnings,
        confidence: 0,
        processingTime: Date.now() - startTime,
        metadata: { stage: "VALIDATION" }
      };
    }
  }
}

module.exports = new ValidationEngine();

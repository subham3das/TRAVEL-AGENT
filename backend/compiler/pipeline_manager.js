/**
 * Pipeline Manager — routes the TravelContext to the correct execution
 * pipeline after validation.  Decides WHICH pipeline runs, never HOW.
 *
 * @module pipelineManager
 */

const PIPELINE_REGISTRY = {
  trip_generation: [
    "trip_planner",
    "decision_engine",
    "cost_estimator",
    "route_optimizer",
    "booking_engine",
    "response_generator",
  ],
  booking_search: [
    "booking_engine",
    "response_generator",
  ],
  weather: [
    "weather_engine",
    "response_generator",
  ],
  nearby_places: [
    "recommendation_engine",
    "route_optimizer",
    "response_generator",
  ],
  food_discovery: [
    "recommendation_engine",
    "response_generator",
  ],
  transport: [
    "transport_engine",
    "response_generator",
  ],
  travel_chat: [
    "gemini_service",
  ],
  fallback: [
    "gemini_service",
  ],
};

/**
 * Read the intent from the context.
 *
 * Tries, in order:
 *   context.state.intent?.intent
 *   context.state.intent (if it's a string)
 *   context.intent?.intent
 *   context.intent (if it's a string)
 *
 * @param {object} context
 * @returns {{ intent: string, source: string }|null}
 */
function resolveIntent(context) {
  const candidates = [
    { value: context.state?.intent, label: "state.intent" },
    { value: context.intent, label: "intent" },
    { value: context.execution?.intent, label: "execution.intent" },
  ];

  for (const { value, label } of candidates) {
    if (!value) continue;
    if (typeof value === "string") return { intent: value, source: label };
    if (typeof value.intent === "string") return { intent: value.intent, source: label };
  }

  return null;
}

/**
 * Read the validation result from the context.
 *
 * @param {object} context
 * @returns {{ status: string, validation: object|null}}
 */
function resolveValidation(context) {
  const validation =
    context.execution?.validation ??
    context.state?.validation ??
    context.validation ??
    null;

  if (validation && typeof validation === "object") {
    return { status: validation.validationStatus || "unknown", validation };
  }

  return { status: "unvalidated", validation: null };
}

/**
 * Select the execution pipeline based on intent and validation state.
 *
 * Reads:  context.state.intent
 *         context.execution.validation
 *
 * Never executes business logic.  Only returns the pipeline plan.
 *
 * @param {object} context - TravelContext.
 * @returns {object} Engine Response Contract.
 */
function selectPipeline(context) {
  const start = Date.now();
  const errors = [];
  const warnings = [];

  if (!context || typeof context !== "object") {
    errors.push("Invalid context: expected an object");
    return pipelineResponse(null, errors, warnings, start);
  }

  const intentResult = resolveIntent(context);

  if (!intentResult) {
    warnings.push("No intent found in context, routing to fallback pipeline");
    return buildSelection("fallback", null, warnings, start, "Intent missing");
  }

  const { intent, source } = intentResult;

  if (intent === "unknown") {
    warnings.push(`Intent is unknown (source: ${source}), routing to fallback`);
    return buildSelection("fallback", null, warnings, start, "Unknown intent");
  }

  const { status: validationStatus } = resolveValidation(context);

  if (validationStatus === "critical") {
    errors.push("Validation critical — execution blocked");
    return {
      success: false,
      data: {
        selectedPipeline: "validation_failed",
        executionAllowed: false,
        pipelineStages: [],
        reason: "Validation critical — execution blocked",
        nextStage: null,
      },
      errors,
      warnings,
      confidence: 0,
      processingTime: Date.now() - start,
      metadata: { module: "pipeline_manager", intent, validationStatus },
    };
  }

  if (!PIPELINE_REGISTRY[intent]) {
    warnings.push(`Unsupported intent "${intent}", routing to fallback`);
    return buildSelection("fallback", null, warnings, start, `Unsupported intent: ${intent}`);
  }

  return buildSelection(intent, null, warnings, start, null);
}

/**
 * Build a successful pipeline selection response.
 *
 * @param {string} pipelineKey
 * @param {string[]|null} overrideStages
 * @param {string[]} warnings
 * @param {number} start
 * @param {string|null} reason
 * @returns {object}
 */
function buildSelection(pipelineKey, overrideStages, warnings, start, reason) {
  const stages = overrideStages || PIPELINE_REGISTRY[pipelineKey] || [];

  return {
    success: true,
    data: {
      selectedPipeline: pipelineKey,
      executionAllowed: true,
      pipelineStages: stages,
      reason: reason || `Pipeline "${pipelineKey}" selected`,
      nextStage: stages.length > 0 ? stages[0] : null,
    },
    errors: [],
    warnings,
    confidence: 1,
    processingTime: Date.now() - start,
    metadata: {
      module: "pipeline_manager",
      pipeline: pipelineKey,
      stageCount: stages.length,
    },
  };
}

/**
 * Build an error response for invalid contexts.
 *
 * @param {string|null} pipeline
 * @param {string[]} errors
 * @param {string[]} warnings
 * @param {number} start
 * @returns {object}
 */
function pipelineResponse(pipeline, errors, warnings, start) {
  return {
    success: !errors.length,
    data: {
      selectedPipeline: pipeline || "error",
      executionAllowed: false,
      pipelineStages: [],
      reason: errors.length > 0 ? errors[0] : "Unknown error",
      nextStage: null,
    },
    errors,
    warnings,
    confidence: 0,
    processingTime: Date.now() - start,
    metadata: { module: "pipeline_manager" },
  };
}

module.exports = { selectPipeline, PIPELINE_REGISTRY };

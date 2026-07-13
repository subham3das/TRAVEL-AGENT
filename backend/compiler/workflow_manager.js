/**
 * Workflow Manager — orchestrates sequential execution of pipeline stages.
 *
 * Receives a pipeline plan from the Pipeline Manager, resolves each
 * stage name to an engine function via the Engine Registry, and executes
 * them in order, passing the TravelContext through the chain.
 *
 * Contains NO business logic — orchestration only.
 *
 * @module workflowManager
 */

const STAGE_TIMEOUT_MS = 30000;

/**
 * Engine Registry — maps stage names to their implementation.
 *
 * Every engine follows the same contract:
 *   engine(context) => { success, data, errors, warnings, confidence, processingTime, metadata }
 *
 * Placeholder engines return a basic success response so the workflow
 * manager is testable before real engines are wired in.
 */
function createPlaceholder(name) {
  return function placeholderEngine(context) {
    const start = Date.now();
    return {
      success: true,
      data: { stage: name, processed: true },
      errors: [],
      warnings: [],
      confidence: 1,
      processingTime: Date.now() - start,
      metadata: { module: name, placeholder: true },
    };
  };
}

const ENGINE_REGISTRY = {
  trip_planner: createPlaceholder("trip_planner"),
  decision_engine: createPlaceholder("decision_engine"),
  cost_estimator: createPlaceholder("cost_estimator"),
  route_optimizer: createPlaceholder("route_optimizer"),
  booking_engine: createPlaceholder("booking_engine"),
  recommendation_engine: createPlaceholder("recommendation_engine"),
  response_generator: createPlaceholder("response_generator"),
  weather_engine: createPlaceholder("weather_engine"),
  transport_engine: createPlaceholder("transport_engine"),
  gemini_service: createPlaceholder("gemini_service"),
};

/**
 * Execute a single pipeline stage with timeout protection.
 *
 * @param {string} stageName
 * @param {object} context - Current TravelContext.
 * @param {object} engineFn - The engine function to call.
 * @returns {Promise<{ success: boolean, response: object|null, error: string|null }>}
 */
async function executeStage(stageName, context, engineFn) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Stage "${stageName}" timed out after ${STAGE_TIMEOUT_MS}ms`)), STAGE_TIMEOUT_MS)
  );

  try {
    const response = await Promise.race([engineFn(context), timer]);

    if (!response || typeof response !== "object") {
      return { success: false, response: null, error: `Invalid response from "${stageName}"` };
    }

    return { success: response.success !== false, response, error: null };
  } catch (err) {
    return { success: false, response: null, error: err.message || `Unknown error in "${stageName}"` };
  }
}

/**
 * Run the full pipeline: iterate stages, execute each, track state.
 *
 * @param {object} context - TravelContext.
 * @param {object} pipelineResponse - The data from Pipeline Manager's response.
 * @returns {Promise<object>} Engine Response Contract.
 */
async function runPipeline(context, pipelineResponse) {
  const workflowStart = Date.now();
  const errors = [];
  const warnings = [];
  const completedStages = [];
  const failedStages = [];

  if (!context || typeof context !== "object") {
    errors.push("Invalid context: expected an object");
    return buildWorkflowResponse(null, completedStages, failedStages, errors, warnings, workflowStart);
  }

  const stages = pipelineResponse?.pipelineStages;

  if (!Array.isArray(stages) || stages.length === 0) {
    warnings.push("No pipeline stages to execute");
    return buildWorkflowResponse(context, completedStages, failedStages, errors, warnings, workflowStart);
  }

  let currentContext = context;

  for (const stageName of stages) {
    const stageStart = Date.now();

    updateExecution(currentContext, {
      currentStage: stageName,
      completedStages,
      failedStages,
      executionTime: Date.now() - workflowStart,
    });

    const engineFn = ENGINE_REGISTRY[stageName];

    if (!engineFn) {
      const msg = `Unknown engine: "${stageName}"`;
      failedStages.push({ stage: stageName, error: msg, time: Date.now() - stageStart });
      errors.push(msg);
      break;
    }

    const { success, response, error } = await executeStage(stageName, currentContext, engineFn);

    if (!success) {
      failedStages.push({ stage: stageName, error: error || "Unknown error", time: Date.now() - stageStart });

      const recoverable = response?.metadata?.recoverable === true;

      if (recoverable) {
        warnings.push(`Stage "${stageName}" failed but error is recoverable, continuing`);
        continue;
      }

      errors.push(`Stage "${stageName}" failed: ${error || "No details"}`);
      break;
    }

    completedStages.push({ stage: stageName, time: Date.now() - stageStart });

    if (response?.metadata) {
      currentContext = mergeEngineOutput(currentContext, stageName, response);
    }
  }

  const allCompleted = failedStages.length === 0;

  return buildWorkflowResponse(currentContext, completedStages, failedStages, errors, warnings, workflowStart, allCompleted);
}

/**
 * Merge an engine's response data into the TravelContext.
 *
 * Stores the raw response under:
 *   context.execution.lastEngineResponse
 * And also stores stage-specific data under:
 *   context.state.<stageName>
 *
 * @param {object} context
 * @param {string} stageName
 * @param {object} response - Engine Response Contract
 * @returns {object} Updated context copy.
 */
function mergeEngineOutput(context, stageName, response) {
  const updated = { ...context };

  updated.execution = {
    ...(updated.execution || {}),
    lastEngineResponse: response,
    lastStage: stageName,
  };

  updated.state = {
    ...(updated.state || {}),
    [stageName]: response.data || {},
  };

  return updated;
}

/**
 * Update the execution tracking fields on the context.
 *
 * @param {object} context
 * @param {object} updates
 */
function updateExecution(context, updates) {
  if (!context.execution) context.execution = {};
  Object.assign(context.execution, updates);
}

/**
 * Build the final Workflow Manager response.
 *
 * @param {object|null} finalContext
 * @param {Array} completedStages
 * @param {Array} failedStages
 * @param {string[]} errors
 * @param {string[]} warnings
 * @param {number} start
 * @param {boolean} [allCompleted]
 * @returns {object}
 */
function buildWorkflowResponse(finalContext, completedStages, failedStages, errors, warnings, start, allCompleted) {
  const totalTime = Date.now() - start;

  return {
    success: errors.length === 0,
    data: {
      completedStages,
      failedStages,
      finalContext,
      executionSummary: {
        totalStages: completedStages.length + failedStages.length,
        completed: completedStages.length,
        failed: failedStages.length,
        allCompleted: allCompleted || false,
        totalExecutionTime: totalTime,
      },
    },
    errors,
    warnings,
    confidence: errors.length === 0 ? 1 : 0,
    processingTime: totalTime,
    metadata: {
      module: "workflow_manager",
      stages: completedStages.map((s) => s.stage),
      failed: failedStages.map((s) => s.stage),
    },
  };
}

module.exports = { runPipeline, ENGINE_REGISTRY };

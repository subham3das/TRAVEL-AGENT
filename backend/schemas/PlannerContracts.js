/**
 * Validate and strictly normalize the Planner Engine / Execution Engine response.
 */
function validatePlannerResponse(rawResponse) {
  if (!rawResponse.success) {
    return {
      success: false,
      data: {
        executionStatus: rawResponse.data?.executionStatus || "FAILED",
        executedStages: rawResponse.data?.executedStages || [],
        skippedStages: rawResponse.data?.skippedStages || [],
        failedStages: rawResponse.data?.failedStages || [],
        finalContext: rawResponse.data?.finalContext || null,
        executionSummary: "Failed during planner execution."
      },
      errors: Array.isArray(rawResponse.errors) ? rawResponse.errors : ["Unknown planner error"],
      warnings: Array.isArray(rawResponse.warnings) ? rawResponse.warnings : [],
      confidence: typeof rawResponse.confidence === "number" ? rawResponse.confidence : 0,
      processingTime: rawResponse.processingTime || 0,
      metadata: rawResponse.metadata || {}
    };
  }

  const { data = {} } = rawResponse;
  
  return {
    success: true,
    data: {
      executionId: data.executionId || "exec-unknown",
      executionStatus: data.executionStatus || "COMPLETED",
      executedStages: Array.isArray(data.executedStages) ? data.executedStages : [],
      skippedStages: Array.isArray(data.skippedStages) ? data.skippedStages : [],
      failedStages: Array.isArray(data.failedStages) ? data.failedStages : [],
      currentStage: data.currentStage || null,
      nextStage: data.nextStage || null,
      finalContext: data.finalContext || null,
      plannerInstructions: data.plannerInstructions || [],
      executionSummary: data.executionSummary || "Pipeline completed."
    },
    errors: Array.isArray(rawResponse.errors) ? rawResponse.errors : [],
    warnings: Array.isArray(rawResponse.warnings) ? rawResponse.warnings : [],
    confidence: typeof rawResponse.confidence === "number" ? rawResponse.confidence : 1.0,
    processingTime: rawResponse.processingTime || 0,
    metadata: rawResponse.metadata || {}
  };
}

module.exports = {
  validatePlannerResponse
};

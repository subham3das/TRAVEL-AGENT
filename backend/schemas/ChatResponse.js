function validateAndNormalizeChatResponse(rawResponse) {
  // If the internal response failed, just format the error gracefully
  if (!rawResponse.success) {
    return {
      success: false,
      data: null,
      errors: rawResponse.errors || ["Unknown backend error occurred."],
      warnings: [],
    };
  }

  const { data, metadata } = rawResponse;
  const backendOutput = data.backendOutput || {};

  // 1. Normalize daily plan slots
  const dailyPlan = backendOutput.dailyPlan
    ? backendOutput.dailyPlan.map((dayPlan) => ({
        ...dayPlan,
        slots: dayPlan.slots
          ? dayPlan.slots.map((slot, idx) => ({
              ...slot,
              nodeId: `day-${dayPlan.day}-idx-${idx}-${slot.nodeId || "unknown"}`,
            }))
          : [],
      }))
    : null;

  // 2. Normalize budget summary
  let budgetSummary = null;
  const backendBudget = backendOutput.budgetSummary || null;
  const categoryBreakdown = backendOutput.categoryBreakdown || null;
  if (backendBudget) {
    let breakdown = null;
    if (categoryBreakdown) {
      breakdown = {
        stays: categoryBreakdown.hotel ?? 0,
        activities: categoryBreakdown.activities ?? 0,
        food: categoryBreakdown.food ?? 0,
        transport: categoryBreakdown.transport ?? 0,
      };
    } else if (backendBudget.breakdown) {
      breakdown = backendBudget.breakdown;
    }
    budgetSummary = { ...backendBudget, breakdown };
  }

  // 3. Assemble normalized response contract
  const normalizedData = {
    dailyPlan,
    budgetSummary,
    travelScore: backendOutput.travelScore || null,
    composedText: data.text || "",
    activeContext: metadata?.activeContext || null,
    weather: backendOutput.weather || null,
    packing: backendOutput.packingChecklist || [],
  };

  const response = {
    success: true,
    data: normalizedData,
    errors: [],
    warnings: backendOutput.importantWarnings || [],
  };

  // 4. Basic Schema Validation (Structural Check)
  const validationErrors = [];
  if (typeof response.success !== "boolean") validationErrors.push("success must be boolean");
  if (response.success && !response.data) validationErrors.push("data is missing on success");
  if (!Array.isArray(response.errors)) validationErrors.push("errors must be an array");
  if (!Array.isArray(response.warnings)) validationErrors.push("warnings must be an array");
  
  if (response.success && response.data) {
    if (typeof response.data.composedText !== "string") validationErrors.push("data.composedText must be a string");
  }

  if (validationErrors.length > 0) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[Schema Validation Failed]", validationErrors, response);
    }
    return {
      success: false,
      data: null,
      errors: ["Internal API contract violation."],
      warnings: [],
    };
  }

  return response;
}

module.exports = {
  validateAndNormalizeChatResponse
};

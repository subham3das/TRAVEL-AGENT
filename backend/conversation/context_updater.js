/**
 * Travel Intelligence OS - Context Updater.
 *
 * Deterministic safe context update engine.
 * Conforms to conversation_engine_spec.md.
 *
 * @module context_updater
 */

/**
 * Validates updates and modifies the destination.
 */
function updateDestination(context, value) {
  const normalized = getNormalized(context);
  if (!value || typeof value !== "string") {
    return { success: false, error: "Invalid destination format: must be string" };
  }
  normalized.destination = value.toLowerCase();
  return { success: true };
}

/**
 * Validates and updates budget limit.
 */
function updateBudget(context, value) {
  const normalized = getNormalized(context);
  const num = Number(value);
  if (isNaN(num) || num < 0) {
    return { success: false, error: `Invalid budget: must be a positive number, got '${value}'` };
  }
  normalized.budget = num;
  return { success: true };
}

/**
 * Validates and updates trip duration in days.
 */
function updateDuration(context, value) {
  const normalized = getNormalized(context);
  const num = parseInt(value, 10);
  if (isNaN(num) || num <= 0 || num > 30) {
    return { success: false, error: `Invalid duration: must be between 1 and 30 days, got '${value}'` };
  }
  normalized.durationDays = num;
  return { success: true };
}

/**
 * Validates and updates travelers count or type.
 */
function updateTravelers(context, value) {
  const normalized = getNormalized(context);
  if (!value || (typeof value !== "string" && typeof value !== "number")) {
    return { success: false, error: "Invalid travelers format" };
  }
  normalized.travelersType = typeof value === "string" ? value.toLowerCase() : value;
  return { success: true };
}

/**
 * Validates and updates travel style preference.
 */
function updateTravelStyle(context, value) {
  const normalized = getNormalized(context);
  if (!value || typeof value !== "string") {
    return { success: false, error: "Invalid travel style" };
  }
  const clean = value.toLowerCase();
  if (!["budget", "mid", "luxury"].includes(clean)) {
    return { success: false, error: `Invalid style: expected budget/mid/luxury, got '${value}'` };
  }
  normalized.travelStyle = clean;
  return { success: true };
}

/**
 * Validates and updates travel dates.
 */
function updateDates(context, value) {
  const normalized = getNormalized(context);
  if (!value || typeof value !== "object") {
    return { success: false, error: "Invalid dates format: expected object" };
  }
  normalized.travelDates = value;
  return { success: true };
}

/**
 * Updates other travel preferences.
 */
function updatePreferences(context, updates) {
  const normalized = getNormalized(context);
  if (!updates || typeof updates !== "object") {
    return { success: false, error: "Invalid preferences format" };
  }

  const allowedKeys = ["interests", "accommodation", "transport", "foodPreferences"];
  for (const [key, val] of Object.entries(updates)) {
    if (allowedKeys.includes(key)) {
      normalized[key] = val;
    }
  }
  return { success: true };
}

/**
 * Helper to ensure normalizedEntities exists.
 */
function getNormalized(context) {
  if (!context.state) context.state = {};
  if (!context.state.normalizedEntities) context.state.normalizedEntities = {};
  return context.state.normalizedEntities;
}

/**
 * Deep clones context to prevent side-effects during analysis.
 */
function cloneContext(context) {
  return JSON.parse(JSON.stringify(context || {}));
}

/**
 * Detects conflicts between previous and proposed contexts.
 *
 * @param {object} previous - Previous TravelContext.
 * @param {object} current - Proposed TravelContext.
 * @returns {string[]} List of conflict strings.
 */
function detectConflicts(previous, current) {
  const conflicts = [];
  const prevNorm = previous?.state?.normalizedEntities || {};
  const currNorm = current?.state?.normalizedEntities || {};

  // Conflict: Budget less than already scheduled hotel price
  if (currNorm.budget && previous?.recommendations?.budgetSummary?.totalBookingCost) {
    if (currNorm.budget < previous.recommendations.budgetSummary.totalBookingCost) {
      conflicts.push(`Proposed budget of ₹${currNorm.budget} is lower than current committed booking cost of ₹${previous.recommendations.budgetSummary.totalBookingCost}`);
    }
  }

  // Conflict: Negative values
  if (currNorm.durationDays && currNorm.durationDays <= 0) {
    conflicts.push("Duration days cannot be zero or negative");
  }

  return conflicts;
}

/**
 * Generates audit change log.
 *
 * @param {object} previous - Previous TravelContext.
 * @param {object} current - Proposed TravelContext.
 * @returns {string[]} List of updates.
 */
function generateChangeLog(previous, current) {
  const changeLog = [];
  const prevNorm = previous?.state?.normalizedEntities || {};
  const currNorm = current?.state?.normalizedEntities || {};

  const allKeys = new Set([...Object.keys(prevNorm), ...Object.keys(currNorm)]);

  for (const key of allKeys) {
    const prevVal = JSON.stringify(prevNorm[key]);
    const currVal = JSON.stringify(currNorm[key]);

    if (prevVal !== currVal) {
      changeLog.push(`Updated ${key} from '${prevVal || "undefined"}' to '${currVal || "undefined"}'`);
    }
  }

  return changeLog;
}

/**
 * Safely applies updates to TravelContext based on classification updates.
 *
 * @param {object} context - TravelContext.
 * @param {object} updates - Key-value pair of fields to update.
 * @returns {object} Engine Response Contract.
 */
function applyContextUpdate(context, updates) {
  const start = Date.now();
  const errors = [];
  const warnings = [];
  const conflicts = [];

  try {
    if (!context || typeof context !== "object") {
      throw new Error("Invalid context: expected an object");
    }

    const previousContext = cloneContext(context);
    const updatedContext = cloneContext(context);
    const modifiedFields = [];

    // Guard: Prevent modification of immutable fields
    const immutableFields = ["requestId", "createdAt"];
    if (updates) {
      for (const key of immutableFields) {
        if (updates[key] !== undefined || (updates.conversationState && updates.conversationState[key] !== undefined)) {
          errors.push(`Attempt to mutate immutable field: '${key}'`);
          return buildResponse(null, modifiedFields, [], conflicts, errors, warnings, start);
        }
      }
    }

    if (updates && typeof updates === "object") {
      // Loop over requested fields
      for (const [key, value] of Object.entries(updates)) {
        let res = { success: true };

        if (key === "destination") res = updateDestination(updatedContext, value);
        else if (key === "budget") res = updateBudget(updatedContext, value);
        else if (key === "durationDays" || key === "duration") res = updateDuration(updatedContext, value);
        else if (key === "travelers" || key === "travelersType") res = updateTravelers(updatedContext, value);
        else if (key === "travelStyle") res = updateTravelStyle(updatedContext, value);
        else if (key === "travelDates") res = updateDates(updatedContext, value);
        else if (["interests", "accommodation", "transport", "foodPreferences"].includes(key)) {
          res = updatePreferences(updatedContext, { [key]: value });
        } else {
          warnings.push(`Ignored unknown update field: '${key}'`);
          continue;
        }

        if (res.success) {
          modifiedFields.push(key);
        } else {
          warnings.push(`Partial failure updating '${key}': ${res.error}`);
        }
      }
    }

    // Detect conflicts and audit logs
    const foundConflicts = detectConflicts(previousContext, updatedContext);
    conflicts.push(...foundConflicts);

    const changeLog = generateChangeLog(previousContext, updatedContext);

    // Apply updates directly back to context on success
    if (errors.length === 0) {
      context.state = updatedContext.state;
    }

    const data = {
      updatedContext: context,
      modifiedFields,
      changeLog,
      conflicts,
      warnings,
      confidence: 0.98,
      metadata: {
        totalModified: modifiedFields.length
      }
    };

    return buildResponse(data, modifiedFields, changeLog, conflicts, errors, warnings, start);

  } catch (err) {
    errors.push(err.message);
    return buildResponse(null, [], [], [], errors, warnings, start);
  }
}

function buildResponse(data, modified, changeLog, conflicts, errors, warnings, start) {
  return {
    success: errors.length === 0,
    data,
    errors,
    warnings,
    confidence: errors.length === 0 ? 0.98 : 0.0,
    processingTime: Date.now() - start,
    metadata: {}
  };
}

module.exports = {
  applyContextUpdate,
  updateDestination,
  updateBudget,
  updateDuration,
  updateTravelers,
  updateTravelStyle,
  updateDates,
  updatePreferences,
  detectConflicts,
  generateChangeLog
};

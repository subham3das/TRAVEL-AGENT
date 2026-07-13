/**
 * Travel Intelligence OS - Conversation State Manager.
 *
 * Deterministic rules-based module for conversation states.
 * Conforms to conversation_engine_spec.md.
 *
 * @module conversation_state
 */

// States defined in spec
const STATES = {
  IDLE: "IDLE",
  COLLECTING_INFORMATION: "COLLECTING_INFORMATION",
  WAITING_FOR_CLARIFICATION: "WAITING_FOR_CLARIFICATION",
  PLANNING: "PLANNING",
  REPLANNING: "REPLANNING",
  BOOKING: "BOOKING",
  COMPLETED: "COMPLETED",
  ERROR: "ERROR"
};

// Transition matrix defining allowed states
const ALLOWED_TRANSITIONS = {
  [STATES.IDLE]: [STATES.COLLECTING_INFORMATION, STATES.ERROR],
  [STATES.COLLECTING_INFORMATION]: [STATES.WAITING_FOR_CLARIFICATION, STATES.PLANNING, STATES.IDLE, STATES.ERROR],
  [STATES.WAITING_FOR_CLARIFICATION]: [STATES.COLLECTING_INFORMATION, STATES.PLANNING, STATES.IDLE, STATES.ERROR],
  [STATES.PLANNING]: [STATES.COMPLETED, STATES.ERROR],
  [STATES.REPLANNING]: [STATES.COMPLETED, STATES.ERROR],
  [STATES.BOOKING]: [STATES.COMPLETED, STATES.ERROR, STATES.IDLE],
  [STATES.COMPLETED]: [STATES.REPLANNING, STATES.BOOKING, STATES.IDLE, STATES.ERROR],
  [STATES.ERROR]: [STATES.IDLE]
};

/**
 * Creates a fresh state model structure.
 *
 * @returns {object} Fresh state object.
 */
function createConversationState() {
  const now = new Date().toISOString();
  return {
    currentState: STATES.IDLE,
    clarificationCount: 0,
    clarificationTarget: null,
    replanningCount: 0,
    conversationType: "UNKNOWN",
    requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Gets conversation state from the TravelContext. Initializes it if missing.
 *
 * @param {object} context - TravelContext.
 * @returns {object} Active state object.
 */
function getConversationState(context) {
  if (!context || typeof context !== "object") {
    return createConversationState();
  }

  if (!context.state) {
    context.state = {};
  }

  if (!context.state.conversationState) {
    context.state.conversationState = createConversationState();
  }

  return context.state.conversationState;
}

/**
 * Sets the conversation state in TravelContext.
 *
 * @param {object} context - TravelContext.
 * @param {object} stateObj - Conversation State Object.
 * @returns {object} Engine Response Contract.
 */
function setConversationState(context, stateObj) {
  const start = Date.now();
  const errors = [];

  if (!context || typeof context !== "object") {
    errors.push("Invalid context: expected an object");
    return buildResponse(null, errors, start);
  }

  if (!stateObj || typeof stateObj !== "object" || !stateObj.currentState) {
    errors.push("Invalid state object: missing currentState");
    return buildResponse(null, errors, start);
  }

  if (!context.state) {
    context.state = {};
  }

  stateObj.updatedAt = new Date().toISOString();
  context.state.conversationState = stateObj;

  return buildResponse(stateObj, errors, start);
}

/**
 * Validates whether state transition is allowed by matrix.
 *
 * @param {string} currentState
 * @param {string} nextState
 * @returns {boolean} True if allowed.
 */
function validateTransition(currentState, nextState) {
  if (currentState === nextState) return true;
  const allowed = ALLOWED_TRANSITIONS[currentState];
  return allowed ? allowed.includes(nextState) : false;
}

/**
 * Transitions the conversation state inside the TravelContext.
 *
 * @param {object} context - TravelContext.
 * @param {string} nextState - State to transition to.
 * @returns {object} Engine Response Contract.
 */
function transitionConversationState(context, nextState) {
  const start = Date.now();
  const errors = [];
  const state = getConversationState(context);

  if (!STATES[nextState]) {
    errors.push(`Invalid state value: '${nextState}'`);
    return buildResponse(state, errors, start);
  }

  if (!validateTransition(state.currentState, nextState)) {
    errors.push(`Transition rejected: '${state.currentState}' -> '${nextState}' is not allowed`);
    return buildResponse(state, errors, start);
  }

  state.currentState = nextState;
  state.updatedAt = new Date().toISOString();

  // Reset metrics on returning to IDLE
  if (nextState === STATES.IDLE) {
    state.clarificationCount = 0;
    state.clarificationTarget = null;
    state.replanningCount = 0;
  }

  // Increment replanning count on entering REPLANNING
  if (nextState === STATES.REPLANNING) {
    state.replanningCount++;
  }

  return buildResponse(state, errors, start);
}

/**
 * Increments clarification attempts count.
 *
 * @param {object} context - TravelContext.
 * @returns {object} Engine Response Contract.
 */
function incrementClarificationCount(context) {
  const start = Date.now();
  const state = getConversationState(context);
  state.clarificationCount++;
  state.updatedAt = new Date().toISOString();
  return buildResponse(state, [], start);
}

/**
 * Resets clarification attempts count and target.
 *
 * @param {object} context - TravelContext.
 * @returns {object} Engine Response Contract.
 */
function resetClarificationCount(context) {
  const start = Date.now();
  const state = getConversationState(context);
  state.clarificationCount = 0;
  state.clarificationTarget = null;
  state.updatedAt = new Date().toISOString();
  return buildResponse(state, [], start);
}

/**
 * Convenience method to mark state completed.
 *
 * @param {object} context - TravelContext.
 * @returns {object} Engine Response Contract.
 */
function markConversationCompleted(context) {
  return transitionConversationState(context, STATES.COMPLETED);
}

/**
 * Helper to build Engine Response Contract.
 */
function buildResponse(data, errors, start) {
  return {
    success: errors.length === 0,
    data,
    errors,
    warnings: [],
    confidence: 1.0,
    processingTime: Date.now() - start,
    metadata: {}
  };
}

module.exports = {
  STATES,
  createConversationState,
  getConversationState,
  setConversationState,
  transitionConversationState,
  incrementClarificationCount,
  resetClarificationCount,
  markConversationCompleted,
  validateTransition
};

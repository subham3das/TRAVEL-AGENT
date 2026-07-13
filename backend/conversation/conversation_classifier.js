const conversationState = require("./conversation_state");

/**
 * Travel Intelligence OS - Conversation Classifier.
 *
 * Deterministic rule-based classifier for user queries.
 * Conforms to conversation_engine_spec.md.
 *
 * @module conversation_classifier
 */

const TYPES = {
  NEW_REQUEST: "NEW_REQUEST",
  FOLLOW_UP: "FOLLOW_UP",
  MODIFICATION: "MODIFICATION",
  CLARIFICATION_RESPONSE: "CLARIFICATION_RESPONSE",
  QUESTION_ABOUT_PLAN: "QUESTION_ABOUT_PLAN",
  BOOKING_REQUEST: "BOOKING_REQUEST",
  GENERAL_CHAT: "GENERAL_CHAT",
  GREETING: "GREETING",
  CANCEL: "CANCEL",
  UNKNOWN: "UNKNOWN"
};

/**
 * Checks if message is a cancellation.
 */
function isCancellation(message) {
  const clean = (message || "").trim().toLowerCase();
  return /\b(cancel|reset|forget|clear|start over|stop)\b/i.test(clean);
}

/**
 * Checks if message is a greeting.
 */
function isGreeting(message) {
  const clean = (message || "").trim().toLowerCase();
  return /\b(hi|hello|hey|greetings|hola|good morning|good afternoon|good evening|yo)\b/i.test(clean);
}

/**
 * Checks if message is a booking request.
 */
function isBookingRequest(message) {
  const clean = (message || "").trim().toLowerCase();
  return /\b(book|reserve|confirm stay|reserve hotel|get tickets|make reservation)\b/i.test(clean) || 
         clean.includes("book this") || 
         clean.includes("reserve my");
}

/**
 * Checks if message is a plan modification.
 */
function isModification(message) {
  const clean = (message || "").trim().toLowerCase();
  return /^(change|update|modify|remove|add|swap|replace|instead|make it|longer|shorter|increase|decrease)$/i.test(clean) || 
         /\b(budget is now|change to|make it \d+ days|remove day|add attraction)\b/i.test(clean) ||
         clean.startsWith("actually");
}

/**
 * Checks if message is a question about the active plan.
 */
function isQuestionAboutPlan(message, hasPlan) {
  if (!hasPlan) return false;
  const clean = (message || "").trim().toLowerCase();
  return clean.includes("?") || 
         /^(what|where|when|why|how|is there|are there|can we|does it|is it)\b/i.test(clean);
}

/**
 * Checks if message is a clarification response based on active waiting state.
 */
function isClarificationResponse(message, currentState) {
  return currentState === conversationState.STATES.WAITING_FOR_CLARIFICATION;
}

/**
 * Detects the Conversation Type based on message and state.
 *
 * @param {string} message - Raw message.
 * @param {string} currentState - Current state value.
 * @param {boolean} hasPlan - Whether an active plan exists.
 * @returns {{ type: string, rule: string }}
 */
function detectConversationType(message, currentState, hasPlan = false) {
  const clean = (message || "").trim();
  if (clean.length === 0) {
    return { type: TYPES.UNKNOWN, rule: "empty_message" };
  }

  if (isCancellation(clean)) {
    return { type: TYPES.CANCEL, rule: "cancellation_keywords" };
  }

  if (isGreeting(clean)) {
    return { type: TYPES.GREETING, rule: "greeting_keywords" };
  }

  if (isBookingRequest(clean)) {
    return { type: TYPES.BOOKING_REQUEST, rule: "booking_keywords" };
  }

  if (isModification(clean)) {
    return { type: TYPES.MODIFICATION, rule: "modification_keywords" };
  }

  if (isQuestionAboutPlan(clean, hasPlan)) {
    return { type: TYPES.QUESTION_ABOUT_PLAN, rule: "plan_question_regex" };
  }

  if (isClarificationResponse(clean, currentState)) {
    return { type: TYPES.CLARIFICATION_RESPONSE, rule: "clarification_state_match" };
  }

  // Check for new request indicators
  if (/^(i want to travel|plan a trip|go to|visit|explore|take me to|planning for)\b/i.test(clean) || 
      /\b(days|budget|flight|trip to)\b/i.test(clean)) {
    return { type: TYPES.NEW_REQUEST, rule: "new_request_indicators" };
  }

  // General follow-up if we have a plan in context
  if (hasPlan) {
    return { type: TYPES.FOLLOW_UP, rule: "general_follow_up" };
  }

  // Fallback to general chat
  return { type: TYPES.GENERAL_CHAT, rule: "general_chat_fallback" };
}

/**
 * Orchestrates classification for the entire TravelContext.
 *
 * @param {object} context - TravelContext.
 * @returns {object} Engine Response Contract.
 */
function classifyConversation(context) {
  const start = Date.now();
  const errors = [];
  const warnings = [];

  try {
    if (!context || typeof context !== "object") {
      throw new Error("Invalid context: expected an object");
    }

    const message = context.request?.query || context.originalQuery || "";
    const activeState = conversationState.getConversationState(context);
    const hasPlan = !!(context.recommendations?.optimizedItinerary || context.recommendations?.draftItinerary || context.draftItinerary);

    const { type: detectedType, rule: matchedRule } = detectConversationType(message, activeState.currentState, hasPlan);

    const data = {
      detectedType,
      confidence: detectedType === TYPES.UNKNOWN ? 0.0 : 0.95,
      matchedRules: [matchedRule],
      warnings,
      metadata: {
        messageLength: message.length,
        hasActivePlan: hasPlan,
        currentState: activeState.currentState
      }
    };

    return {
      success: true,
      data,
      errors,
      warnings,
      confidence: data.confidence,
      processingTime: Date.now() - start,
      metadata: {}
    };

  } catch (err) {
    errors.push(err.message);
    return {
      success: false,
      data: null,
      errors,
      warnings,
      confidence: 0.0,
      processingTime: Date.now() - start,
      metadata: {}
    };
  }
}

module.exports = {
  TYPES,
  classifyConversation,
  detectConversationType,
  isModification,
  isClarificationResponse,
  isGreeting,
  isBookingRequest,
  isQuestionAboutPlan,
  isCancellation
};

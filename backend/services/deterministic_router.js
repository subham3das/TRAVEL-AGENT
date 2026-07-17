const crypto = require("crypto");

/**
 * Travel Intelligence OS - Deterministic Router.
 *
 * Fast pattern matcher that runs BEFORE the conversation classifier.
 * Intercepts greetings, cancels, help, system queries, and clarifications
 * so they never touch the LLM.
 *
 * @module deterministic_router
 */

// ponytail: fixed templates, counter rotation, no randomness
const GREETING_TEMPLATES = [
  "Hi! Where would you like to travel today? \u2708\uFE0F",
  "Hello! Ready to plan your next adventure? \uD83C\uDF0D",
  "Hey there! Tell me about your dream trip \uD83D\uDE0A",
  "Welcome back! What destination are you thinking about?"
];

let greetingIndex = 0;

const ROUTES = {
  GREETING: "GREETING",
  CANCEL: "CANCEL",
  HELP: "HELP",
  SYSTEM: "SYSTEM",
  CLARIFICATION: "CLARIFICATION",
  PASS_THROUGH: "PASS_THROUGH"
};

/**
 * Fast deterministic route detection.
 * @param {string} message
 * @param {object} conversationState - current conversation state object
 * @returns {{ route: string, response?: string }}
 */
function route(message, conversationState = null) {
  const clean = (message || "").trim().toLowerCase();

  if (clean.length === 0) {
    return { route: ROUTES.PASS_THROUGH };
  }

  // 1. Greetings — cheapest check first
  if (/^(hi|hello|hey|yo|hola|greetings|good\s*(morning|afternoon|evening)|howdy|sup|what'?s\s*up)\s*[!?.]*$/i.test(clean)) {
    const response = GREETING_TEMPLATES[greetingIndex % GREETING_TEMPLATES.length];
    greetingIndex++;
    return { route: ROUTES.GREETING, response };
  }

  // 2. Short social — "how are you", "thanks", etc
  if (/^(how\s+are\s+you|thank(s| you)|bye|goodbye|see\s+you|ok|okay|cool|great|nice|awesome|got\s+it)\s*[!?.]*$/i.test(clean)) {
    const socialResponses = {
      "how are you": "I'm great, thanks! Ready to help you plan a trip. Where would you like to go?",
      "thanks": "You're welcome! Let me know if you need anything else for your trip.",
      "thank you": "You're welcome! Let me know if you need anything else for your trip.",
      "bye": "Safe travels! Come back anytime you need help planning. \uD83D\uDC4B",
      "goodbye": "Safe travels! Come back anytime you need help planning. \uD83D\uDC4B",
      "ok": "Great! What would you like to do next?",
      "okay": "Great! What would you like to do next?",
      "cool": "Glad you like it! Anything else you'd like to explore?",
      "great": "Awesome! What's next on your travel plans?",
      "nice": "Thanks! What else can I help with?",
      "awesome": "Thanks! What else can I help with?",
      "got it": "Perfect! Ready when you are."
    };

    // Match against keys
    for (const [key, resp] of Object.entries(socialResponses)) {
      if (clean.replace(/[!?.]/g, "").trim() === key) {
        return { route: ROUTES.GREETING, response: resp };
      }
    }
    // Fallback greeting
    return { route: ROUTES.GREETING, response: "How can I help with your travel plans?" };
  }

  // 3. Cancel / Reset
  if (/^(cancel|reset|clear|start\s*over|forget\s*(it|everything)|stop)\s*[!?.]*$/i.test(clean)) {
    return { route: ROUTES.CANCEL, response: "Got it! Starting fresh. Where would you like to travel?" };
  }

  // 4. Help
  if (/^(help|what\s+can\s+you\s+do|commands|features)\s*[?!.]*$/i.test(clean)) {
    return {
      route: ROUTES.HELP,
      response: "I can help you:\n\u2022 Plan trips (\"Plan a 5 day Goa trip\")\n\u2022 Calculate budgets\n\u2022 Recommend places\n\u2022 Book hotels\n\u2022 Answer travel questions\n\nJust tell me your destination!"
    };
  }

  // 5. System queries
  if (/^(system\s*status|server\s*status|health\s*check|api\s*status)\s*[?!.]*$/i.test(clean)) {
    return { route: ROUTES.SYSTEM };
  }

  // 6. Clarification — if conversation state is WAITING_FOR_CLARIFICATION
  // Supports both direct state objects and nested { state: { conversationState: ... } } structures
  const cs = conversationState?.conversationState || conversationState?.state?.conversationState;
  const currentState = cs?.currentState || conversationState?.currentState;
  if (currentState === "WAITING_FOR_CLARIFICATION") {
    return { route: ROUTES.CLARIFICATION };
  }

  // 7. Everything else → pass through to classifier/LLM
  return { route: ROUTES.PASS_THROUGH };
}

module.exports = { route, ROUTES, GREETING_TEMPLATES };

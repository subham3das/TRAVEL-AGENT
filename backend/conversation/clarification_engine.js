const conversationState = require("./conversation_state");

// Deterministic templates defined in spec
const QUESTIONS = {
  destination: "Which destination would you like to visit?",
  travelDates: "When are you planning to travel?",
  durationDays: "How many days will your trip be?",
  budget: "What is your approximate travel budget?",
  travelersType: "How many people are travelling (solo, couple, or family)?",
  travelStyle: "What is your preferred travel style (budget, mid, or luxury)?"
};

const PRIORITY_ORDER = [
  "destination",
  "travelDates",
  "durationDays",
  "budget",
  "travelersType",
  "travelStyle"
];

// Required fields for trip planning execution
const MANDATORY_PLANNING_FIELDS = [
  "destination",
  "travelDates",
  "durationDays",
  "travelersType"
];

class ClarificationEngine {
  evaluate(context) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      if (!context || typeof context !== "object") {
        throw new Error("Invalid context: expected an object");
      }

      const activeState = conversationState.getConversationState(context);
      const normalized = context.state?.normalizedEntities || {};
      const confidences = context.state?.entityConfidence || {};

      const missingFields = [];
      const questionsToAsk = [];
      let readyForExecution = true;
      let blockedPipeline = false;

      // 1. Identify missing or low confidence fields
      for (const field of PRIORITY_ORDER) {
        const val = normalized[field];
        const conf = confidences[field] !== undefined ? confidences[field] : 1.0;

        const isMandatory = MANDATORY_PLANNING_FIELDS.includes(field);

        if (val === undefined || val === null || val === "" || conf < 0.60) {
          if (isMandatory) {
            missingFields.push(field);
            readyForExecution = false;
            blockedPipeline = true;
          }
        }
      }

      // 2. Process priority fields for prompting
      if (missingFields.length > 0) {
        const targetField = missingFields[0]; // first missing in priority order

        // If target field changed, reset retry count
        if (activeState.clarificationTarget !== targetField) {
          activeState.clarificationTarget = targetField;
          activeState.clarificationCount = 0;
        }

        // Check retry limit
        if (activeState.clarificationCount >= 3) {
          throw new Error(`Max clarification retries exceeded for field: '${targetField}'`);
        }

        questionsToAsk.push({
          field: targetField,
          question: QUESTIONS[targetField],
          clarificationId: `clar_${targetField}_${Date.now()}`,
          stage: "WAITING_FOR_USER",
          retryCount: activeState.clarificationCount
        });

        // Update state metadata
        activeState.currentState = conversationState.STATES.WAITING_FOR_CLARIFICATION;
        activeState.clarificationCount++;
      } else {
        // 3. Check for Medium confidence fields (0.60 to 0.90) to generate confirmations
        for (const field of PRIORITY_ORDER) {
          const val = normalized[field];
          const conf = confidences[field] !== undefined ? confidences[field] : 1.0;

          if (val !== undefined && val !== null && conf >= 0.60 && conf <= 0.90) {
            questionsToAsk.push({
              field,
              question: `We set your ${field} to '${JSON.stringify(val)}'. Let us know if you meant something else.`,
              clarificationId: `confirm_${field}_${Date.now()}`,
              stage: "READY_FOR_EXECUTION",
              retryCount: 0
            });
          }
        }

        if (readyForExecution) {
          activeState.currentState = conversationState.STATES.PLANNING;
          activeState.clarificationTarget = null;
          activeState.clarificationCount = 0;
        }
      }

      const data = {
        requiresClarification: questionsToAsk.length > 0,
        missingFields,
        questions: questionsToAsk,
        priorityOrder: PRIORITY_ORDER,
        blockedPipeline,
        readyForExecution,
        clarificationId: questionsToAsk[0]?.clarificationId || null,
        clarificationStage: questionsToAsk[0]?.stage || "READY",
        retryCount: activeState.clarificationCount
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
      
      // If error occurs (like retry limit exceeded), update state to ERROR
      if (context && context.state && context.state.conversationState) {
        context.state.conversationState.currentState = conversationState.STATES.ERROR;
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
}

module.exports = new ClarificationEngine();

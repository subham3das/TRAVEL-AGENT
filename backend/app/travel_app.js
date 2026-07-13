const conversationState = require("../conversation/conversation_state");
const classifier = require("../conversation/conversation_classifier");
const contextUpdater = require("../conversation/context_updater");
const clarification = require("../conversation/clarification_engine");
const executionEngine = require("../execution/execution_engine");
const responseComposer = require("../response/response_composer");
const memoryEngine = require("../memory/memory_engine");

/**
 * Travel Intelligence OS - Application Entry Point.
 *
 * Coordinates end-to-end execution flow of the system.
 * Conforms to travel_app.js requirements.
 *
 * @module travel_app
 */

class TravelApp {
  async processRequest(context, previousContext = null) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];
    const appLogs = [];

    try {
      if (!context || typeof context !== "object") {
        throw new Error("Invalid request: TravelContext is required");
      }

      // Ensure state namespaces are initialized
      if (!context.state) context.state = {};
      if (!context.state.conversationState) {
        context.state.conversationState = conversationState.createConversationState();
      }

      const userId = context.state.userId || "guest-1";

      // 1. Conversation Classifier
      appLogs.push("Conversation Classifier -> RUNNING");
      const classRes = classifier.classifyConversation(context);
      if (classRes.success) {
        context.state.conversationType = classRes.data.detectedType;
        appLogs.push("Conversation Classifier -> OK");
      } else {
        warnings.push("Conversation classifier failed: using default types");
        appLogs.push("Conversation Classifier -> WARNING");
      }

      // 2. Conversation State Manager (Transition to PLANNING or active state)
      appLogs.push("Conversation State Manager -> RUNNING");
      const nextState = context.state.conversationType === "BOOKING_REQUEST" ? "BOOKING" : "PLANNING";
      conversationState.transitionConversationState(context, nextState);
      appLogs.push("Conversation State Manager -> OK");

      // 3. Context Updater (Extract entities/parameters)
      appLogs.push("Context Updater -> RUNNING");
      const updates = context.state.normalizedEntities || {};
      const updateRes = contextUpdater.applyContextUpdate(context, updates);
      if (updateRes.success) {
        appLogs.push("Context Updater -> OK");
      } else {
        warnings.push("Context updater warnings: " + updateRes.warnings.join(", "));
        appLogs.push("Context Updater -> WARNING");
      }

      // 4. Memory Engine (Load user profile & preferences)
      appLogs.push("Memory Engine (load) -> RUNNING");
      const memRes = memoryEngine.listMemory(userId);
      if (memRes.success) {
        if (!context.user) context.user = { preferences: {} };
        if (!context.user.preferences) context.user.preferences = {};
        
        memRes.data.forEach(m => {
          context.user.preferences[m.category] = m.value;
        });
        appLogs.push("Memory Engine (load) -> OK");
      } else {
        appLogs.push("Memory Engine (load) -> WARNING");
      }

      // 5. Clarification Engine (Stop execution if inputs missing)
      appLogs.push("Clarification Engine -> RUNNING");
      const clarRes = clarification.evaluate(context);
      if (clarRes.success && clarRes.data.requiresClarification) {
        appLogs.push("Clarification Engine -> WAITING_CLARIFICATION");
        
        // Populate clarification targets
        context.state.conversationState.currentState = "WAITING_FOR_CLARIFICATION";
        
        const finalResponse = responseComposer.compose(context, {
          success: true,
          data: {
            executionSummary: "Blocked on clarification: missing vital attributes.",
            executedStages: ["classifier", "state", "updater", "memory_load", "clarification"]
          }
        });
        return finalResponse;
      }
      appLogs.push("Clarification Engine -> OK");

      // 6-15. Execute Planner Pipeline (Compiler, Planner, Decision, Optimizer, Budget, Recommendation, Booking)
      appLogs.push("Execution Pipeline -> RUNNING");
      const pipelineRes = await executionEngine.execute(context, previousContext);
      if (pipelineRes.success) {
        appLogs.push("Execution Pipeline -> OK");
      } else {
        appLogs.push("Execution Pipeline -> FAILED");
        throw new Error(pipelineRes.errors[0] || "Pipeline execution failed");
      }

      // 16. Memory Engine (Save new memories / preferences updates)
      appLogs.push("Memory Engine (save) -> RUNNING");
      if (context.state?.normalizedEntities?.travelStyle) {
        memoryEngine.storeMemory({
          userId,
          category: "Travel Style",
          type: "LongTerm",
          value: context.state.normalizedEntities.travelStyle,
          confidence: 1.0,
          importance: 4
        });
      }
      appLogs.push("Memory Engine (save) -> OK");

      // 17. Response Composer
      appLogs.push("Response Composer -> RUNNING");
      const finalResponse = responseComposer.compose(context, pipelineRes);
      appLogs.push("Response Composer -> OK");

      return finalResponse;

    } catch (err) {
      errors.push(err.message);
      appLogs.push("Pipeline -> FATAL_ERROR");
      return {
        success: false,
        data: null,
        errors,
        warnings,
        confidence: 0.0,
        processingTime: Date.now() - startTime,
        metadata: {
          appLogs
        }
      };
    }
  }
}

module.exports = new TravelApp();

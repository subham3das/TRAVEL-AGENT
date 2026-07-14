import { createRequire } from "module";
import providerRegistry from "./provider_registry.js";
import { tools } from "./tools.js";

const require = createRequire(import.meta.url);
const executionEngine = require("../execution/execution_engine.js");
const responseComposer = require("../response/response_composer.js");
const conversationState = require("../conversation/conversation_state.js");

/**
 * Travel Intelligence OS - LLM Adapter.
 *
 * Core coordinator linking configuration options to target provider classes.
 * Conforms to llm_adapter_spec.md and implements native tool calling orchestration.
 *
 * @module llm_adapter
 */

class LLMAdapter {
  constructor() {
    this.defaultProvider = "gemini";
  }

  // 1. Generate text or JSON responses (Includes retry strategy on json checks)
  async generate(promptOrConfig, config = {}, providerName = this.defaultProvider) {
    const startTime = Date.now();
    const errors = [];

    // Support passing object or string
    let prompt = promptOrConfig;
    let localConfig = { ...config };
    if (promptOrConfig && typeof promptOrConfig === "object") {
      prompt = promptOrConfig.prompt;
      localConfig = { ...promptOrConfig, ...config };
    }

    const provider = providerRegistry.get(providerName);
    const modelName = localConfig.model || "default";

    try {
      const initRes = await provider.initialize();
      if (!initRes.success) {
        throw new Error(initRes.errors[0] || `Failed to initialize provider: '${providerName}'`);
      }

      let response = null;
      let retries = 0;
      const maxRetries = localConfig.responseFormat === "json" ? 3 : 1;

      while (retries < maxRetries) {
        response = await provider.generate(prompt, localConfig);
        
        if (response && response.success) {
          const isValid = provider.validateResponse(response, localConfig.responseFormat);
          if (isValid) {
            break;
          } else {
            retries++;
            if (retries >= maxRetries) {
              throw new Error("Structured JSON response parsing failed after 3 attempts.");
            }
          }
        } else {
          // If JSON mode was requested, we only retry if generation succeeded but validation failed
          throw new Error(response?.errors?.[0] || `Generation failed on provider: '${providerName}'`);
        }
      }

      return {
        success: true,
        data: {
          text: response.data.text,
          raw: response.data.raw
        },
        errors: [],
        warnings: [],
        confidence: 0.98,
        processingTime: Date.now() - startTime,
        metadata: {
          provider: providerName,
          model: modelName,
          retries,
          streamed: false,
          timestamp: new Date().toISOString()
        }
      };

    } catch (err) {
      errors.push(err.message);
      return {
        success: false,
        data: null,
        errors,
        warnings: [],
        confidence: 0.0,
        processingTime: Date.now() - startTime,
        metadata: {
          provider: providerName,
          model: modelName,
          retries: 0,
          streamed: false,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // 2. Stream completions
  async stream(promptOrConfig, config = {}, callback, providerName = this.defaultProvider) {
    try {
      const provider = providerRegistry.get(providerName);
      await provider.stream(promptOrConfig, config, callback);
    } catch (err) {
      callback({ text: "", done: true, error: err.message });
    }
  }

  // 3. Tool call resolution
  async toolCall(prompt, toolsList = [], providerName = this.defaultProvider) {
    const startTime = Date.now();
    try {
      const provider = providerRegistry.get(providerName);
      return await provider.toolCall(prompt, toolsList);
    } catch (err) {
      return {
        success: false,
        data: null,
        errors: [err.message],
        warnings: [],
        confidence: 0.0,
        processingTime: Date.now() - startTime,
        metadata: { provider: providerName, timestamp: new Date().toISOString() }
      };
    }
  }

  // 4. Health Check
  async healthCheck(providerName = this.defaultProvider) {
    try {
      const provider = providerRegistry.get(providerName);
      return await provider.healthCheck();
    } catch (err) {
      return {
        success: false,
        data: { active: false },
        errors: [err.message],
        warnings: [],
        confidence: 0.0,
        processingTime: 0,
        metadata: { timestamp: new Date().toISOString() }
      };
    }
  }

  // 5. Orchestration Pipeline
  async processNaturalLanguage(message, previousContext = null) {
    const startTime = Date.now();
    try {
      // Step 1: Ask LLM to select tool call
      const toolRes = await this.toolCall(message, tools, "gemini");
      if (!toolRes.success) {
        throw new Error(toolRes.errors[0]);
      }

      const { toolRequested, arguments: toolArgs, text } = toolRes.data;

      // Step 2: General chat branch (no tool call)
      if (!toolRequested) {
        return {
          success: true,
          data: {
            text: text || "General chat query processed.",
            toolRequested: null,
            executionSummary: "No backend tool executed."
          },
          errors: [],
          warnings: [],
          confidence: 0.98,
          processingTime: Date.now() - startTime,
          metadata: { provider: "gemini" }
        };
      }

      // Step 3: Map arguments to TravelContext
      const context = {
        originalQuery: message,
        request: { query: message },
        state: {
          intent: this.mapToolToIntent(toolRequested),
          normalizedEntities: {
            destination: toolArgs.destination || null,
            durationDays: toolArgs.durationDays || null,
            travelStyle: toolArgs.travelStyle || null,
            travelersType: toolArgs.travelersType || null,
            budget: toolArgs.budget || null,
            travelDates: toolArgs.startDate ? { startDate: toolArgs.startDate } : null,
            interests: toolArgs.interests || null
          },
          entityConfidence: {
            destination: toolArgs.destination ? 1.0 : 0.0,
            durationDays: toolArgs.durationDays ? 1.0 : 0.0,
            travelDates: toolArgs.startDate ? 1.0 : 0.0,
            travelersType: toolArgs.travelersType ? 1.0 : 0.0,
            travelStyle: toolArgs.travelStyle ? 1.0 : 0.0,
            budget: toolArgs.budget ? 1.0 : 0.0
          },
          conversationState: conversationState.createConversationState()
        }
      };

      // STEP 1 DEBUG LOGS
      console.log(`\nDetected Tool: ${toolRequested}`);
      console.log(`Parsed Arguments: ${JSON.stringify(toolArgs, null, 2)}`);
      console.log(`Generated TravelContext: ${JSON.stringify(context, null, 2)}\n`);

      // STEP 2 LOG
      console.log("Execution Engine Started");

      // STEP 3 INTERCEPT LOGGING
      const originalRegistry = { ...executionEngine.registry };
      for (const stageName of Object.keys(executionEngine.registry)) {
        const originalRun = executionEngine.registry[stageName].run;
        executionEngine.registry[stageName].run = async (...args) => {
          if (stageName === "planner") console.log("Planner Started");
          if (stageName === "decision") console.log("Decision Started");
          if (stageName === "optimizer") console.log("Route Optimizer Started");
          if (stageName === "budget") console.log("Budget Started");
          if (stageName === "recommendation") console.log("Recommendation Started");
          if (stageName === "booking") console.log("Booking Started");
          return originalRun(...args);
        };
      }

      let execRes;
      try {
        execRes = await executionEngine.execute(context, previousContext);
      } finally {
        executionEngine.registry = originalRegistry;
      }

      // STEP 3 LOG COMPOSER
      console.log("Response Composer Started");
      const composed = responseComposer.compose(context, execRes);

      // STEP 4 BLOCKED PIPELINE LOGS
      if (execRes.data?.executionStatus === "WAITING_CLARIFICATION") {
        const missingFieldsList = [];
        const MANDATORY_PLANNING_FIELDS = ["destination", "travelDates", "durationDays", "travelersType"];
        for (const field of MANDATORY_PLANNING_FIELDS) {
          const val = context.state.normalizedEntities[field];
          if (val === undefined || val === null || val === "") {
            missingFieldsList.push(field);
          }
        }
        
        console.log("Clarification Engine blocked execution.");
        console.log("Missing fields:");
        missingFieldsList.forEach(f => console.log(`- ${f}`));

        const listStr = missingFieldsList.map(f => `- ${f}`).join("\n");
        const blockedMsg = `Clarification Engine blocked execution.\nMissing fields:\n${listStr}`;

        return {
          success: true,
          data: {
            text: blockedMsg,
            toolRequested,
            toolArguments: toolArgs,
            backendOutput: composed.data,
            executionSummary: composed.data?.executionSummary || "Pipeline blocked."
          },
          errors: [],
          warnings: [],
          confidence: composed.confidence,
          processingTime: Date.now() - startTime,
          metadata: { provider: "gemini" }
        };
      }

      // Step 6: Generate final friendly natural language explanation
      let summaryText = "";
      if (composed.success) {
        const prompt = `You are a travel assistant. The backend calculated this deterministic result: ${JSON.stringify(composed.data)}. Explain it friendly, concisely, and accurately to the user. Do not add or change any travel decisions.`;
        const genRes = await this.generate(prompt, {}, "gemini");
        summaryText = genRes.success ? genRes.data.text : "Trip planned successfully.";
      } else {
        summaryText = `Failed to process plan: ${composed.errors.join(", ")}`;
      }

      return {
        success: composed.success,
        data: {
          text: summaryText,
          toolRequested,
          toolArguments: toolArgs,
          backendOutput: composed.data,
          executionSummary: composed.data?.executionSummary || "Pipeline completed."
        },
        errors: composed.errors,
        warnings: composed.warnings,
        confidence: composed.confidence,
        processingTime: Date.now() - startTime,
        metadata: {
          provider: "gemini",
          composerMetadata: composed.metadata
        }
      };

    } catch (err) {
      return {
        success: false,
        data: null,
        errors: [err.message],
        warnings: [],
        confidence: 0.0,
        processingTime: Date.now() - startTime,
        metadata: { provider: "gemini" }
      };
    }
  }

  mapToolToIntent(tool) {
    if (tool === "book_trip") return "BOOK_TRIP";
    return "GENERATE_PLAN";
  }
}

export default new LLMAdapter();

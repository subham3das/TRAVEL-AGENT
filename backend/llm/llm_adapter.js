import { createRequire } from "module";
import providerRegistry from "./provider_registry.js";

const require = createRequire(import.meta.url);
const executionEngine = require("../execution/execution_engine.js");
const responseComposer = require("../response/response_composer.js");
const conversationState = require("../conversation/conversation_state.js");
const conversationClassifier = require("../conversation/conversation_classifier.js");
const deterministicRouter = require("../services/deterministic_router.js");
const fieldParsers = require("../conversation/field_parsers.js");
const responseCache = require("../services/response_cache.js");
const telemetry = require("../services/llm_telemetry.js");
const circuitBreaker = require("../services/circuit_breaker.js");
const deduplicator = require("../services/request_deduplicator.js");
const templateRenderer = require("../response/template_renderer.js");


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
            circuitBreaker.recordSuccess();
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
      circuitBreaker.recordFailure(err.message);
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

  // 5. Orchestration Pipeline — Optimized
  async processNaturalLanguage(message, previousContext = null, sessionId = null) {
    const startTime = Date.now();
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      let context = previousContext ? JSON.parse(JSON.stringify(previousContext)) : null;

      // STATE_TRACE: LLM adapter entry
      console.log("[STATE_TRACE]", {
        stage: "LLM_ENTRY",
        request: message,
        conversationType: context?.state?.conversationType,
        clarificationTarget: context?.state?.conversationState?.clarificationTarget,
        currentState: context?.state?.conversationState?.currentState,
        hasContext: !!context,
        sessionId
      });

      // Diagnostic: trace context at LLM adapter entry
      console.log(`[DIAG-LLM] context=${!!context} state=${!!context?.state} convState=${context?.state?.conversationState?.currentState || "none"} clarTarget=${context?.state?.conversationState?.clarificationTarget || "none"}`);
      if (context?.state?.conversationState) {
        console.log(`[OBJ-ID] LLM-ENTRY csRequestId=${context.state.conversationState.requestId} csCandidateFlow=${context.state.conversationState.candidateFlow || "?"}`);
      }
      if (previousContext?.state?.conversationState) {
        console.log(`[OBJ-ID] LLM-PREV csRequestId=${previousContext.state.conversationState.requestId} csCandidateFlow=${previousContext.state.conversationState.candidateFlow || "?"}`);
      }

      // ═══════════════════════════════════════════════════════════
      // LAYER 1: Fast Deterministic Router (NO LLM)
      // ═══════════════════════════════════════════════════════════
      const routeResult = deterministicRouter.route(message, context?.state);

      // STATE_TRACE: after router
      console.log("[STATE_TRACE]", {
        stage: "AFTER_ROUTER",
        request: message,
        route: routeResult.route,
        conversationType: context?.state?.conversationType,
        clarificationTarget: context?.state?.conversationState?.clarificationTarget,
        currentState: context?.state?.conversationState?.currentState
      });

      if (routeResult.route === deterministicRouter.ROUTES.GREETING) {
        telemetry.log({
          requestId, reason: "greeting", caller: "processNaturalLanguage",
          latencyMs: Date.now() - startTime, llmSkipped: true,
          skipReason: "deterministic_greeting", tokensSaved: 500
        });
        return this.buildResponse(routeResult.response, null, null, null, context, startTime, "Greeting — no LLM.");
      }

      if (routeResult.route === deterministicRouter.ROUTES.CANCEL) {
        telemetry.log({
          requestId, reason: "cancel", caller: "processNaturalLanguage",
          latencyMs: Date.now() - startTime, llmSkipped: true,
          skipReason: "deterministic_cancel", tokensSaved: 500
        });
        return this.buildResponse(routeResult.response, null, null, null, null, startTime, "Reset — no LLM.");
      }

      if (routeResult.route === deterministicRouter.ROUTES.HELP) {
        telemetry.log({
          requestId, reason: "help", caller: "processNaturalLanguage",
          latencyMs: Date.now() - startTime, llmSkipped: true,
          skipReason: "deterministic_help", tokensSaved: 500
        });
        return this.buildResponse(routeResult.response, null, null, null, context, startTime, "Help — no LLM.");
      }

      if (routeResult.route === deterministicRouter.ROUTES.SYSTEM) {
        telemetry.log({
          requestId, reason: "system", caller: "processNaturalLanguage",
          latencyMs: Date.now() - startTime, llmSkipped: true,
          skipReason: "system_query", tokensSaved: 500
        });
        return this.buildResponse("System status is available via the status widget.", null, null, null, context, startTime, "System — no LLM.");
      }

      // ═══════════════════════════════════════════════════════════
      // LAYER 2: Deterministic Clarification Parser (NO LLM)
      // ═══════════════════════════════════════════════════════════
      if (routeResult.route === deterministicRouter.ROUTES.CLARIFICATION) {
        const targetField = context?.state?.conversationState?.clarificationTarget;
        console.log(`[DIAG-L2] CLARIFICATION route target=${targetField} message="${message}"`);
        if (targetField && context) {
          const parsed = fieldParsers.parseField(targetField, message);
          console.log(`[DIAG-L2] parsed=${JSON.stringify(parsed)}`);
          if (parsed && parsed.value !== undefined) {
            console.log("[WRITE:selectedPlaces]", {
              file: "llm_adapter.js",
              function: "LAYER 2",
              target: targetField,
              previous: context.state.normalizedEntities[targetField],
              next: parsed.value,
              clarificationTarget: targetField,
              message
            });
            context.state.normalizedEntities[targetField] = parsed.value;
            context.state.entityConfidence[targetField] = 1.0;
            context.state.conversationState.clarificationTarget = null;
            context.state.conversationState.currentState = "IDLE";

            telemetry.log({
              requestId, reason: "clarification_parse", caller: "processNaturalLanguage",
              latencyMs: Date.now() - startTime, llmSkipped: true,
              skipReason: `field_parser:${targetField}`, tokensSaved: 800
            });

            // Re-execute pipeline with updated context
            // Fall through to execution below
          } else {
            // Field parser could not interpret the reply deterministically.
            // Per AGENTS.md, clarification parsing is deterministic business
            // logic — do NOT fall back to an LLM. Leave the field unparsed so
            // the clarification engine re-prompts the same question (bounded by
            // its retry limit) instead of silently failing on a quota error.
            telemetry.log({
              requestId, reason: "clarification_parse_failed", caller: "processNaturalLanguage",
              latencyMs: Date.now() - startTime, llmSkipped: true,
              skipReason: `field_parser_failed:${targetField}`, tokensSaved: 800
            });
          }
        }
      }

      // ═══════════════════════════════════════════════════════════
      // LAYER 3: Request Deduplication
      // ═══════════════════════════════════════════════════════════
      return await deduplicator.execute(message, context, async () => {

        // Check if LLM is blocked globally
        if (!circuitBreaker.isAvailable()) {
           telemetry.log({
              requestId, reason: "circuit_breaker_open", caller: "processNaturalLanguage",
              latencyMs: Date.now() - startTime, llmSkipped: true,
              skipReason: "outage_fallback", tokensSaved: 1000
           });
           return this.buildResponse(templateRenderer.renderGreeting(), null, null, null, context, startTime, "System degraded, fell back to template.");
        }

        // ═══════════════════════════════════════════════════════════
        // LAYER 4: Conversation Classifier + Knowledge Graph Check
        // ═══════════════════════════════════════════════════════════
        const classification = conversationClassifier.detectConversationType(
          message,
          context?.state?.conversationState?.currentState || "IDLE",
          context?.recommendations ? true : false
        );

        // Travel knowledge question — try Knowledge Graph first
        // Only for actual questions (contains ? or question words), not planning statements
        const isQuestion = /\?/.test(message) || /^(what|where|when|why|how|is|are|can|does|do|tell me about)/i.test(message.trim());
        const isPlanningRequest = /\b(plan|trip|itinerary|days?\s+(in|at|to))\b/i.test(message);
        if ((classification.type === "GENERAL_CHAT" || classification.type === "QUESTION_ABOUT_PLAN") &&
            (isQuestion || !isPlanningRequest)) {
          const destination = context?.state?.normalizedEntities?.destination || this.extractDestinationFromMessage(message);

          if (destination) {
            const topic = responseCache.detectTopic(message);
            const cacheKey = responseCache.knowledgeKey(destination, topic);

            // Check cache
            const cached = responseCache.get(cacheKey);
            if (cached) {
              telemetry.log({
                requestId, reason: "knowledge_cached", caller: "processNaturalLanguage",
                latencyMs: Date.now() - startTime, llmSkipped: true,
                skipReason: "cache_hit", cacheHit: true, cacheType: "knowledge",
                tokensSaved: 1000
              });
              return this.buildResponse(cached, null, null, null, context, startTime, "Knowledge cache hit.");
            }

            // Try Knowledge Graph
            const kgAnswer = this.queryKnowledgeGraph(destination, topic);
            if (kgAnswer) {
              responseCache.set(cacheKey, kgAnswer, "knowledge");
              telemetry.log({
                requestId, reason: "knowledge_graph", caller: "processNaturalLanguage",
                latencyMs: Date.now() - startTime, llmSkipped: true,
                skipReason: "knowledge_graph_answered", tokensSaved: 1000
              });
              return this.buildResponse(kgAnswer, null, null, null, context, startTime, "Answered from Knowledge Graph.");
            }
          }
        }

        // ═══════════════════════════════════════════════════════════
        // LAYER 5: Deterministic Tool Selection (NO LLM)
        // Per AGENTS.md, routing / intent-selection is deterministic
        // business logic and must NEVER call an LLM.
        // ═══════════════════════════════════════════════════════════
        const T = conversationClassifier.TYPES;
        const planningToolMap = {
          [T.NEW_REQUEST]: "plan_trip",
          [T.FOLLOW_UP]: "plan_trip",
          [T.MODIFICATION]: "modify_trip",
          [T.BOOKING_REQUEST]: "book_trip",
          [T.QUESTION_ABOUT_PLAN]: "plan_trip"
        };

        const hasAnyDestination = context?.state?.normalizedEntities?.destination ||
          this.extractDestinationFromMessage(message);
        const isGeneralChat = classification.type === T.GENERAL_CHAT ||
          classification.type === T.UNKNOWN;

        let toolRequested = planningToolMap[classification.type] || null;

        // Pure general chat (no travel context) → LLM, guarded by circuit breaker
        if (!toolRequested && isGeneralChat && !hasAnyDestination) {
          if (!circuitBreaker.isAvailable()) {
            telemetry.log({
              requestId, reason: "circuit_open", caller: "processNaturalLanguage",
              latencyMs: Date.now() - startTime, llmSkipped: true,
              skipReason: "circuit_breaker_open", tokensSaved: 1500
            });
            return this.buildResponse(
              "I'm experiencing some issues connecting to AI services. I can still help with travel information from my knowledge base. Try asking about a specific destination!",
              null, null, null, context, startTime, "Circuit breaker open."
            );
          }

          try {
            const planCtx = context?.recommendations ? `Active Plan Context: ${JSON.stringify(context.recommendations)}` : "";
            const chatPrompt = `You are a helpful travel assistant. ${planCtx}\nUser message: ${message}\nAnswer their question directly and helpfully.`;
            const chatRes = await this.generate(chatPrompt, {}, "gemini");

            if (!chatRes.success) {
              circuitBreaker.recordFailure(chatRes.errors[0]);
              throw new Error(chatRes.errors[0] || "LLM generation failed");
            }

            circuitBreaker.recordSuccess();

            telemetry.log({
              requestId, reason: "general_chat", caller: "processNaturalLanguage",
              latencyMs: Date.now() - startTime, llmSkipped: false, tool: "generate"
            });

            return this.buildResponse(
              chatRes.data.text,
              null, null, null, context, startTime, "Answered by LLM."
            );
          } catch (err) {
            circuitBreaker.recordFailure(err.message);
            throw err;
          }
        }

        // Anything that implies travel (planning type, or mentions a destination)
        // routes to the execution engine deterministically.
        if (!toolRequested) {
          toolRequested = "plan_trip";
        }

        // Deterministic entity extraction — NO LLM
        // Reuses the adapter's own destination matcher + field_parsers
        // (both already load cleanly in this ESM module).
        // Duration/budget are keyword-gated so field_parsers (designed for
        // single-field clarification replies) does not cross-contaminate
        // numbers from unrelated parts of a free-text message.
        const msgLower = message.toLowerCase();
        const destination = this.extractDestinationFromMessage(message);
        const toolArgs = {};
        if (destination) toolArgs.destination = destination;

        if (/\b(day|days|night|nights|week|weeks|weekend|fortnight|day trip|overnight)\b/.test(msgLower)) {
          const duration = fieldParsers.parseField("durationDays", message);
          if (duration && duration.value) toolArgs.durationDays = duration.value;
        }
        // Budget: signal-gated so a duration number is never misread as budget.
        const budgetPatterns = [
          /(?:₹|rs\.?|inr)\s*(\d{2,8})\s*(k|thousand)?/i,
          /\b(\d{2,8})\s*(k|thousand)?\s*(?:rupees?|rs\.?|inr|budget)/i,
          /\bbudget(?:\s*(?:of|around|about|is))?\s*(\d{2,8})\s*(k|thousand)?/i
        ];
        for (const bp of budgetPatterns) {
          const bm = message.match(bp);
          if (bm) {
            let amt = parseInt(bm[1], 10);
            if (bm[2]) amt *= 1000;
            if (amt > 0) toolArgs.budget = amt;
            break;
          }
        }
        const style = fieldParsers.parseField("travelStyle", message);
        if (style && style.value) toolArgs.travelStyle = style.value;
        const travelers = fieldParsers.parseField("travelersType", message);
        if (travelers && travelers.value) toolArgs.travelersType = travelers.value;
        const dates = fieldParsers.parseField("travelDates", message);
        if (dates && dates.value && dates.value.startDate) toolArgs.startDate = dates.value.startDate;

        telemetry.log({
          requestId, reason: "tool_routing_deterministic", caller: "processNaturalLanguage",
          latencyMs: Date.now() - startTime, llmSkipped: true,
          tool: toolRequested, skipReason: "deterministic_classifier"
        });

        // ═══════════════════════════════════════════════════════════
        // LAYER 6: Context Building + Execution Engine
        // ═══════════════════════════════════════════════════════════
        if (!context || !context.state) {
          context = {
            originalQuery: message,
            request: { query: message },
            state: {
              intent: this.mapToolToIntent(toolRequested),
              normalizedEntities: {
                destination: null, durationDays: null, travelStyle: null,
                travelersType: null, budget: null, travelDates: null, interests: null
              },
              entityConfidence: {
                destination: 0.0, durationDays: 0.0, travelDates: 0.0,
                travelersType: 0.0, travelStyle: 0.0, budget: 0.0
              },
              conversationState: conversationState.createConversationState()
            }
          };
        }

        // Merge tool call parameters
        if (toolRequested) {
          context.state.intent = this.mapToolToIntent(toolRequested);
          if (toolArgs.destination) { context.state.normalizedEntities.destination = toolArgs.destination; context.state.entityConfidence.destination = 1.0; }
          if (toolArgs.durationDays) { context.state.normalizedEntities.durationDays = toolArgs.durationDays; context.state.entityConfidence.durationDays = 1.0; }
          if (toolArgs.travelStyle) { context.state.normalizedEntities.travelStyle = toolArgs.travelStyle; context.state.entityConfidence.travelStyle = 1.0; }
          if (toolArgs.travelersType) { context.state.normalizedEntities.travelersType = toolArgs.travelersType; context.state.entityConfidence.travelersType = 1.0; }
          if (toolArgs.budget) { context.state.normalizedEntities.budget = toolArgs.budget; context.state.entityConfidence.budget = 1.0; }
          if (toolArgs.startDate) { context.state.normalizedEntities.travelDates = { startDate: toolArgs.startDate }; context.state.entityConfidence.travelDates = 1.0; }
          if (toolArgs.interests) { context.state.normalizedEntities.interests = toolArgs.interests; context.state.entityConfidence.interests = 1.0; }
        }

        telemetry.log({
          requestId, reason: "execution_start", caller: "processNaturalLanguage",
          latencyMs: Date.now() - startTime, llmSkipped: true,
          toolRequested, tokensSaved: 0
        });

        const execRes = await executionEngine.execute(context, previousContext, sessionId);

        // Stage completed

        // Pipeline finished
        const composed = responseComposer.compose(context, execRes);

        // ═══════════════════════════════════════════════════════════
        // LAYER 7: Clarification Blocked — Structured Response (NO LLM)
        // ═══════════════════════════════════════════════════════════
        if (execRes.data?.executionStatus === "WAITING_CLARIFICATION") {

          telemetry.log({
            requestId, reason: "clarification_blocked", caller: "processNaturalLanguage",
            latencyMs: Date.now() - startTime, llmSkipped: true,
            tokensSaved: 0
          });

          // Set conversation state so deterministic router routes next message as CLARIFICATION
          // NOTE: clarificationTarget and clarificationConfig are owned by candidate_flow.js.
          // LAYER 7 must NOT overwrite them — it only formats the response.
          if (context?.state?.conversationState) {
            context.state.conversationState.currentState = "WAITING_FOR_CLARIFICATION";
          }

          // Regression diagnostic — verify candidate_flow state is preserved
          console.log("[FLOW]", {
            currentState: context.state.conversationState.currentState,
            clarificationTarget:
              context.state.conversationState.clarificationTarget,
            clarificationPrompt:
              context.state.conversationState.clarificationConfig?.prompt
          });

          // Get the single question from ClarificationEngine config (NOT a multi-field dump)
          const clarificationConfig = context?.state?.conversationState?.clarificationConfig || {};

          // The assistant text is a brief acknowledgment — the question lives in clarificationConfig
          // and is rendered by the ConversationalInput component, NOT as markdown.
          const blockedMsg = "Let's plan your trip.";

          telemetry.log({
            requestId, reason: "clarification_prompt", caller: "processNaturalLanguage",
            latencyMs: Date.now() - startTime, llmSkipped: true,
            skipReason: "template_clarification", tokensSaved: 800
          });

          console.log(`[DIAG-RET] returning WAITING_CLARIFICATION target=${context.state.conversationState.clarificationTarget} clarConfig=${!!clarificationConfig}`);

          return {
            success: true,
            data: {
              text: blockedMsg,
              toolRequested: toolRequested || "clarification_resolve",
              toolArguments: toolArgs,
              backendOutput: composed.data,
              executionSummary: composed.data?.executionSummary || "Pipeline blocked."
            },
            errors: [],
            warnings: [],
            confidence: composed.confidence,
            processingTime: Date.now() - startTime,
            metadata: { provider: "deterministic", activeContext: context }
          };
        }

        // ═══════════════════════════════════════════════════════════
        // LAYER 8: Trip Summary — Template Renderer (NO LLM)
        // ═══════════════════════════════════════════════════════════
        let summaryText = "";
        if (composed.success) {
          // Check cache first
          const cacheKey = responseCache.plannerKey(context);
          const cached = responseCache.get(cacheKey);
          if (cached) {
            summaryText = cached;
            telemetry.log({
              requestId, reason: "summary_cached", caller: "processNaturalLanguage",
              latencyMs: Date.now() - startTime, llmSkipped: true,
              skipReason: "summary_cache_hit", cacheHit: true, cacheType: "summary",
              tokensSaved: 2000
            });
          } else {
            // ponytail: template render, no LLM
            summaryText = templateRenderer.renderTripSummary(composed.data, context);
            responseCache.set(cacheKey, summaryText, "summary");

            telemetry.log({
              requestId, reason: "summary_template", caller: "processNaturalLanguage",
              latencyMs: Date.now() - startTime, llmSkipped: true,
              skipReason: "template_rendered", tokensSaved: 2000
            });
          }
        } else {
          summaryText = "I'm still preparing your itinerary. Please answer a few more questions so I can plan the perfect trip.";
        }

        return {
          success: composed.success,
          data: {
            text: summaryText,
            toolRequested: toolRequested || "clarification_resolve",
            toolArguments: toolArgs,
            backendOutput: composed.data,
            executionSummary: composed.data?.executionSummary || "Pipeline completed."
          },
          errors: composed.errors,
          warnings: composed.warnings,
          confidence: composed.confidence,
          processingTime: Date.now() - startTime,
          metadata: {
            provider: "deterministic+gemini",
            composerMetadata: composed.metadata,
            activeContext: context
          }
        };

      }); // end deduplicator.execute

    } catch (err) {
      console.error("[LLMAdapter] Fatal error:", err.message);
      return {
        success: false,
        data: { text: "Something went wrong while processing your request. Please try again." },
        errors: [err.message],
        warnings: [],
        confidence: 0.0,
        processingTime: Date.now() - startTime,
        metadata: { provider: "deterministic" }
      };
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────

  buildResponse(text, toolRequested, toolArgs, backendOutput, context, startTime, summary) {
    return {
      success: true,
      data: {
        text,
        toolRequested: toolRequested || null,
        toolArguments: toolArgs || null,
        backendOutput: backendOutput || null,
        executionSummary: summary || "Completed."
      },
      errors: [],
      warnings: [],
      confidence: 0.98,
      processingTime: Date.now() - startTime,
      metadata: {
        provider: "deterministic",
        activeContext: context
      }
    };
  }

  /**
   * Query Knowledge Graph for travel facts.
   * Returns rendered answer or null if KG has no data.
   */
  queryKnowledgeGraph(destination, topic) {
    const knowledgeService = require("../knowledge/knowledge_service.js");
    try {
      const topicToType = {
        "overview": "attraction", "beaches": "attraction", "culture": "attraction",
        "adventure": "attraction", "food": "restaurant", "accommodation": "hotel",
        "transport": "transport", "budget": "attraction", "safety": "rule",
        "tips": "rule", "shopping": "attraction", "nightlife": "attraction",
        "weather": "attraction"
      };

      const nodeType = topicToType[topic] || "attraction";
      const queryRes = knowledgeService.query({
        destinationId: destination.toLowerCase(),
        type: nodeType
      });

      if (queryRes.success && queryRes.data && queryRes.data.length > 0) {
        return templateRenderer.renderKnowledgeAnswer(destination, topic, queryRes.data);
      }
    } catch (err) {
      // KG failed — fall through to LLM
    }
    return null;
  }

  /**
   * Extract destination from a general question.
   */
  extractDestinationFromMessage(message) {
    const knowledgeService = require("../knowledge/knowledge_service.js");
    const clean = (message || "").toLowerCase();
    const destinations = ["goa", "delhi", "jaipur", "agra", "manali", "shimla",
      "rishikesh", "varanasi", "munnar", "gangtok", "guwahati", "darjeeling",
      "udaipur", "jodhpur", "kerala", "ladakh", "andaman", "meghalaya"];

    for (const dest of destinations) {
      if (clean.includes(dest)) {
        const node = knowledgeService.getNode(dest);
        if (node) return dest;
      }
    }
    return null;
  }

  mapToolToIntent(tool) {
    if (tool === "plan_trip") return "GENERATE_PLAN";
    if (tool === "modify_trip") return "MODIFY_PLAN";
    if (tool === "book_trip") return "BOOK_TRIP";
    if (tool === "calculate_budget") return "CALCULATE_BUDGET";
    if (tool === "recommend_places") return "RECOMMEND_PLACES";
    return "UNKNOWN";
  }
}

export default new LLMAdapter();


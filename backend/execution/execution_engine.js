/**
 * Travel OS — Execution Engine
 *
 * Master pipeline orchestrator. Runs engines in deterministic order.
 * Every stage is traced. Every failure is identified. No silent failures.
 *
 * Correct sequence (Phase 0 fix):
 *   classifier → updater → journeyManager → validation →
 *   recommendation → budget → candidateFlow →
 *   replan → planner → decision → optimizer → booking
 *
 * Engines that were previously in wrong order (budget/recommendation
 * ran AFTER planner) are now correctly sequenced before planner.
 */

const classifier     = require("../conversation/conversation_classifier");
const updater        = require("../conversation/context_updater");
const candidateFlow  = require("../conversation/candidate_flow");
const replan         = require("../planner/replanning_engine");
const planner        = require("../planner/trip_planner");
const decision       = require("../decision/decision_engine");
const optimizer      = require("../optimizer/route_optimizer");
const budget         = require("../budget/budget_engine");
const recommendation = require("../recommendation/recommendation_engine");
const booking        = require("../booking/booking_engine");
const { JourneyManager } = require("../journey/journey_manager");
const validationEngine   = require("../engines/validation_engine");
const plannerLock        = require("../engines/planner_lock");
const confidence         = require("../confidence/confidence_engine");
const memoryStage        = require("../memory/memory_stage");
const { validatePlannerResponse } = require("../schemas/PlannerContracts");
const eventBus       = require("../events/event_bus");
const { EVENTS }     = require("../events/event_bus");
const RequestTracer  = require("../tracing/request_tracer");

// Stage-specific timeouts (ms). Generous for external calls, tight for pure logic.
const STAGE_TIMEOUTS = {
  classifier:     1000,
  updater:        500,
  journeyManager: 500,
  memory:         500,
  validation:     300,
  recommendation: 5000,   // may query KG + search layer
  confidence:     1000,
  budget:         3000,
  candidateFlow:  5000,   // may search hotels/flights
  replan:         1000,
  planner:        8000,   // most complex stage
  decision:       3000,
  optimizer:      3000,
  booking:        5000
};

// EventBus event emitted when each stage starts
const STAGE_START_EVENTS = {
  classifier:     null,
  updater:        EVENTS.INTENT_READY,
  journeyManager: null,
  memory:         null,
  validation:     EVENTS.VALIDATION_DONE,
  recommendation: EVENTS.KG_QUERY_STARTED,
  confidence:     null,
  budget:         EVENTS.BUDGET_READY,
  candidateFlow:  EVENTS.HOTEL_SEARCH_STARTED,
  replan:         null,
  planner:        EVENTS.PLANNER_RUNNING,
  decision:       null,
  optimizer:      null,
  booking:        null
};

// EventBus event emitted when each stage completes successfully
const STAGE_DONE_EVENTS = {
  classifier:     null,
  updater:        null,
  journeyManager: null,
  memory:         EVENTS.MEMORY_LOADED,
  validation:     null,
  recommendation: EVENTS.RECOMMENDATIONS_READY,
  confidence:     EVENTS.CONFIDENCE_READY,
  budget:         EVENTS.BUDGET_READY,
  candidateFlow:  null,
  replan:         null,
  planner:        EVENTS.PLAN_READY,
  decision:       null,
  optimizer:      null,
  booking:        null
};

const journeyManagerInstance = new JourneyManager(eventBus);

class ExecutionEngine {
  constructor() {
    this.registry = {
      classifier: {
        run: (ctx) => classifier.classifyConversation(ctx),
        critical: true,
        label: "INTENT_BUILT"
      },
      updater: {
        run: (ctx) => {
          const updates = ctx.state?.normalizedEntities || {};
          if (
            ctx.state?.conversationType === "CLARIFICATION_RESPONSE" &&
            ctx.state?.conversationState?.clarificationTarget
          ) {
            const target = ctx.state.conversationState.clarificationTarget;
            const value = ctx.request?.query || ctx.originalQuery;
            console.log("[WRITE:selectedPlaces]", {
              file: "execution_engine.js",
              function: "updater",
              target,
              previous: updates.selectedPlaces,
              next: value,
              conversationType: ctx.state.conversationType,
              clarificationTarget: target,
              message: ctx.originalQuery
            });
            updates[target] = value;
          }
          return updater.applyContextUpdate(ctx, updates);
        },
        critical: true,
        label: "CONTEXT_UPDATED"
      },
      journeyManager: {
        run: (ctx) => this._runJourneyManager(ctx),
        critical: false,
        label: "JOURNEY_UPDATED"
      },
      validation: {
        run: (ctx) => validationEngine.validate(ctx),
        critical: false,
        label: "VALIDATION_DONE"
      },
      memory: {
        run: (ctx) => memoryStage.run(ctx),
        critical: false,
        label: "MEMORY_LOADED"
      },
      recommendation: {
        run: (ctx) => recommendation.recommend(ctx.state?.normalizedEntities || ctx),
        critical: false,
        label: "RECOMMENDATION_GENERATED"
      },
      confidence: {
        run: (ctx) => confidence.run(ctx),
        critical: false,
        label: "CONFIDENCE_EVALUATED"
      },
      budget: {
        run: (ctx) => budget.calculate(ctx.state?.normalizedEntities || ctx),
        critical: false,
        label: "BUDGET_ESTIMATED"
      },
      candidateFlow: {
        run: (ctx) => candidateFlow.evaluate(ctx),
        critical: true,
        label: "CANDIDATES_EVALUATED"
      },
      replan: {
        run: (ctx, prev) => replan.analyze(ctx, prev),
        critical: true,
        label: "REPLAN_ANALYZED"
      },
      planner: {
        run: (ctx) => this._runPlanner(ctx),
        critical: true,
        label: "PLANNER_EXECUTED"
      },
      decision: {
        run: (ctx) => decision.optimize(ctx),
        critical: true,
        label: "DECISION_OPTIMIZED"
      },
      optimizer: {
        run: (ctx) => optimizer.optimize(ctx),
        critical: true,
        label: "ROUTE_OPTIMIZED"
      },
      booking: {
        run: (ctx) => booking.recommendBookings(ctx),
        critical: false,
        label: "BOOKING_EVALUATED"
      }
    };

    // CORRECTED SEQUENCE — recommendation + budget now run BEFORE planner
    this.sequence = [
      "classifier",
      "updater",
      "journeyManager",
      "memory",
      "validation",
      "recommendation",
      "confidence",
      "budget",
      "candidateFlow",
      "replan",
      "planner",
      "decision",
      "optimizer",
      "booking"
    ];
  }

  registerEngine(name, runner, isCritical = false, label = null) {
    this.registry[name] = { run: runner, critical: isCritical, label: label || name.toUpperCase() };
    if (!this.sequence.includes(name)) this.sequence.push(name);
  }

  /**
   * Bridge: JourneyManager.evaluate() expects a tripAggregate shape.
   * Maps execution context → tripAggregate → result.
   */
  _runJourneyManager(ctx) {
    try {
      const entities = ctx.state?.normalizedEntities || {};
      const tripAggregate = {
        journeyState: ctx.state?.conversationState?.journeyState || "START",
        intent: {
          destination:       entities.destination,
          selectedPlaces:    entities.selectedPlaces,
          budgetConstraint:  entities.budget,
          daysConstraint:    entities.durationDays,
          selectedHotel:     entities.selectedHotel,
          selectedFlight:    entities.selectedFlight
        },
        budgetSummary: ctx.recommendations?.budgetSummary || null
      };

      const clarification = journeyManagerInstance.evaluate(tripAggregate);

      // Persist journeyState back into context
      if (ctx.state?.conversationState) {
        ctx.state.conversationState.journeyState = tripAggregate.journeyState;
      }

      return {
        success: true,
        data: {
          journeyState:   tripAggregate.journeyState,
          clarification,
          requiresAction: clarification !== null
        },
        errors: [],
        warnings: [],
        confidence: 1.0,
        processingTime: 0,
        metadata: {}
      };
    } catch (err) {
      return {
        success: false,
        data: { journeyState: "ERROR", clarification: null, requiresAction: false },
        errors: [err.message],
        warnings: [],
        confidence: 0,
        processingTime: 0,
        metadata: {}
      };
    }
  }

  /**
   * Bridge: trip_planner.plan() — handles both old (raw ctx) and new (PlannerInput) shapes.
   */
  _runPlanner(ctx) {
    // new planner/trip_planner.js expects PlannerInput contract
    const entities = ctx.state?.normalizedEntities || {};
    const plannerInput = {
      destination:       entities.destination,
      durationDays:      entities.durationDays || 3,
      travelStyle:       entities.travelStyle || "mid",
      travelersType:     entities.travelersType || "solo",
      budget:            entities.budget,
      selectedPlaces:    entities.selectedPlaces || [],
      selectedHotel:     entities.selectedHotel || null,
      selectedFlight:    entities.selectedFlight || null,
      recommendations:   ctx.recommendations || {},
      budgetSummary:     ctx.recommendations?.budgetSummary || null
    };

    return planner.plan(plannerInput);
  }

  async execute(context, previousContext = null, sessionId = null) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];
    const executedStages = [];
    const skippedStages = [];
    const failedStages = [];

    const execId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tracer = new RequestTracer(execId);

    let currentStageIndex = 0;
    let executionStatus = "READY";
    let plannerInstructions = [];
    let requiresReplanning = true;
    let downstreamFilter = null;

    // Emit REQUEST_STARTED immediately
    if (sessionId) {
      eventBus.emitEvent(sessionId, EVENTS.REQUEST_STARTED, { execId });
    }

    try {
      if (!context || typeof context !== "object") {
        throw new Error("Invalid TravelContext: expected an object");
      }

      if (!context.recommendations) context.recommendations = {};

      executionStatus = "RUNNING";
      const csEntry = context.state?.conversationState;
      console.log(`[EXEC] ENTRY convState=${csEntry?.currentState||"?"} clarTarget=${csEntry?.clarificationTarget||"?"} candidateFlow=${csEntry?.candidateFlow||"?"} dest=${context.state?.normalizedEntities?.destination||"null"}`);
      console.log(`[OBJ-ID] context=${context.__id || (context.__id = Math.random().toString(36).slice(2,10))} state=${context.state?.__id || (context.state.__id = Math.random().toString(36).slice(2,10))} cs=${csEntry?.__id || (csEntry.__id = Math.random().toString(36).slice(2,10))}`);

      while (currentStageIndex < this.sequence.length) {
        const stage = this.sequence[currentStageIndex];
        const engine = this.registry[stage];

        if (!engine) {
          throw new Error(`Unknown engine stage: '${stage}'`);
        }

        // ── Gating logic ─────────────────────────────────────────
        let shouldSkip = false;

        // booking only when explicitly requested
        if (stage === "booking" && context.state?.intent !== "BOOK_TRIP") {
          shouldSkip = true;
        }

        // downstreamFilter from replan
        if (
          downstreamFilter &&
          !downstreamFilter.includes(stage) &&
          ["planner", "decision", "optimizer", "budget", "recommendation", "booking"].includes(stage)
        ) {
          shouldSkip = true;
        }

        // skip planner stages if no replanning needed
        if (
          !requiresReplanning &&
          ["planner", "decision", "optimizer"].includes(stage)
        ) {
          shouldSkip = true;
        }

        // skip planner if PlannerLock rejects (hard gate — replaces weak _validationResult check)
        if (stage === "planner") {
          const lock = plannerLock.evaluate(context);
          if (lock.locked) {
            skippedStages.push(stage);
            tracer.record("PLANNER_LOCKED", "⚠ locked", 0, [lock.reason]);
            warnings.push(lock.reason);
            currentStageIndex++;
            continue;
          }
        }

        if (shouldSkip) {
          skippedStages.push(stage);
          tracer.record(engine.label, "⚠ skipped", 0);
          currentStageIndex++;
          continue;
        }

        // ── Emit start event ─────────────────────────────────────
        if (sessionId && STAGE_START_EVENTS[stage]) {
          eventBus.emitEvent(sessionId, STAGE_START_EVENTS[stage], { stage });
        }
        if (sessionId) {
          eventBus.emitProgress(sessionId, stage, "start");
        }

        // ── Execute with timeout ─────────────────────────────────
        const stageStart = Date.now();
        const timeout = STAGE_TIMEOUTS[stage] || 3000;
        const maxRetries = engine.critical ? 1 : 3;
        let retries = 0;
        let response = null;

        const cs0 = context.state?.conversationState;
        console.log(`[EXEC] >>> stage=${stage} convState=${cs0?.currentState||"?"} clarTarget=${cs0?.clarificationTarget||"?"} candidateFlow=${cs0?.candidateFlow||"?"}`);

        while (retries < maxRetries) {
          let timeoutId;
          try {
            const timeoutPromise = new Promise((_, reject) => {
              timeoutId = setTimeout(
                () => reject(new Error(`Timeout: stage '${stage}' exceeded ${timeout}ms`)),
                timeout
              );
            });

            const runPromise = Promise.resolve(
              stage === "replan"
                ? engine.run(context, previousContext)
                : engine.run(context)
            );

            response = await Promise.race([runPromise, timeoutPromise]);
            clearTimeout(timeoutId);

            if (response?.success) break;
            throw new Error(response?.errors?.[0] || `Stage '${stage}' returned success=false`);

          } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            retries++;
            if (retries >= maxRetries) {
              if (engine.critical) throw err;
              response = { success: false, errors: [err.message] };
              break;
            }
          }
        }

        const stageDurationMs = Date.now() - stageStart;
        const stageOk = response?.success === true;
        const cs1 = context.state?.conversationState;
        console.log(`[EXEC] <<< stage=${stage} ok=${stageOk} convState=${cs1?.currentState||"?"} clarTarget=${cs1?.clarificationTarget||"?"} candidateFlow=${cs1?.candidateFlow||"?"} ms=${stageDurationMs}`);
        console.log(`[OBJ-ID] stage=${stage} context=${context.__id} state=${context.state?.__id} cs=${cs1?.__id} csRequestId=${cs1?.requestId||"?"}`);

        // ── Trace ────────────────────────────────────────────────
        tracer.record(
          engine.label,
          stageOk ? "✓" : "✗",
          stageDurationMs,
          response?.errors || []
        );

        // ── Emit done event ──────────────────────────────────────
        if (sessionId) {
          eventBus.emitProgress(sessionId, stage, stageOk ? "done" : "error", {
            durationMs: stageDurationMs,
            errors: response?.errors || []
          });
          if (stageOk && STAGE_DONE_EVENTS[stage]) {
            eventBus.emitEvent(sessionId, STAGE_DONE_EVENTS[stage], {
              stage,
              durationMs: stageDurationMs
            });
          }
        }

        // ── Context merging ──────────────────────────────────────
        if (stageOk) {
          executedStages.push(stage);

          if (stage === "classifier") {
            context.state.conversationType = response.data.detectedType;

          } else if (stage === "validation") {
            context._validationResult = response.data;

          } else if (stage === "candidateFlow") {
            if (response.data.requiresClarification) {
              executionStatus = "WAITING_CLARIFICATION";
              tracer.record("PIPELINE_HALTED", "⚠ clarification", 0);
              break;
            }

          } else if (stage === "replan") {
            requiresReplanning = response.data.requiresReplanning;
            plannerInstructions = response.data.plannerInstructions || [];
            if (requiresReplanning && response.data.downstreamEngines) {
              downstreamFilter = response.data.downstreamEngines;
            }

          } else if (stage === "recommendation") {
            Object.assign(context.recommendations, response.data);

          } else if (stage === "budget") {
            context.recommendations.budgetSummary = response.data;
            if (response.data?.breakdown) {
              context.recommendations.categoryBreakdown = response.data.breakdown;
            }

          } else if (stage === "planner") {
            context.recommendations.draftItinerary = response.data.draftItinerary;

          } else if (stage === "decision") {
            context.recommendations.improvedItinerary = response.data.improvedItinerary;

          } else if (stage === "optimizer") {
            context.recommendations.optimizedItinerary = response.data.optimizedItinerary;

          } else if (stage === "booking") {
            context.recommendations.bookingSuggestions = response.data;
          }

          currentStageIndex++;

        } else {
          failedStages.push(stage);
          warnings.push(...(response?.warnings || []));

          if (engine.critical) {
            executionStatus = "FAILED";
            throw new Error(`Critical stage failed: '${stage}': ${response?.errors?.[0] || "unknown"}`);
          } else {
            warnings.push(`Recoverable failure in '${stage}': continuing`);
            currentStageIndex++;
          }
        }
      }

      if (executionStatus === "RUNNING") executionStatus = "COMPLETED";

    } catch (err) {
      errors.push(err.message);
      executionStatus = "FAILED";
      tracer.record("PIPELINE_FATAL", "✗", 0, [err.message]);
    }

    // Always print trace
    console.log(tracer.toLog());

    if (sessionId) {
      eventBus.emitEvent(sessionId, EVENTS.STREAM_COMPLETE, {
        execId,
        executionStatus,
        durationMs: Date.now() - startTime
      });
    }

    const totalTime = Date.now() - startTime;
    const success = executionStatus === "COMPLETED" || executionStatus === "WAITING_CLARIFICATION";
    const csExit = context.state?.conversationState;
    console.log(`[EXEC] EXIT status=${executionStatus} convState=${csExit?.currentState||"?"} clarTarget=${csExit?.clarificationTarget||"?"} candidateFlow=${csExit?.candidateFlow||"?"} dest=${context.state?.normalizedEntities?.destination||"null"} ms=${totalTime}`);

    return validatePlannerResponse({
      success,
      data: {
        executionId: execId,
        executionStatus,
        executedStages,
        skippedStages,
        failedStages,
        currentStage: null,
        nextStage: null,
        finalContext: context,
        plannerInstructions,
        executionSummary: `Pipeline: ${executionStatus}. Stages: ${executedStages.join(" → ")}`,
        trace: tracer.toObject()
      },
      errors,
      warnings,
      confidence: success ? 0.98 : 0.0,
      processingTime: totalTime,
      metadata: { stageLogs: tracer.stages }
    });
  }
}

module.exports = new ExecutionEngine();

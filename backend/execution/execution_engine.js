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
const planner        = require("../planner/trip_planner_v2");
const decision       = require("../decision/decision_engine");
const optimizer      = require("../optimizer/route_optimizer");
const budget         = require("../budget/budget_engine");
const recommendation = require("../recommendation/recommendation_engine_v2");
const bookingLayer   = require("../booking/booking_layer");
const { BookingIntent, HotelRequest, FlightRequest, TaxiRequest, ActivityRequest } = require("../booking/domain/booking_intent");
const journeyManager = require("../journey/journey_manager");
const tripManager    = require("../trip/trip_manager");
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
  booking:        5000,
  tripManager:    2000
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
  booking:        null,
  tripManager:    null
};
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
  booking:        null,
  tripManager:    null
};

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
        run: (ctx) => journeyManager.run(ctx),
        critical: false,
        label: "JOURNEY_DERIVED"
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
        run: (ctx) => this._runBooking(ctx),
        critical: false,
        label: "BOOKING_EVALUATED"
      },
      tripManager: {
        run: (ctx) => tripManager.run(ctx),
        critical: false,
        label: "TRIP_MANAGED"
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
      "booking",
      "tripManager"
    ];
  }

  registerEngine(name, runner, isCritical = false, label = null) {
    this.registry[name] = { run: runner, critical: isCritical, label: label || name.toUpperCase() };
    if (!this.sequence.includes(name)) this.sequence.push(name);
  }

  getStageMessage(stage, phase) {
    const messages = {
      classifier:     { start: "Classifying intent...", done: "Intent classified" },
      updater:        { start: "Processing your input...", done: "Input processed" },
      journeyManager: { start: "Analyzing trip requirements...", done: "Trip requirements analyzed" },
      memory:         { start: "Loading your preferences...", done: "Preferences loaded" },
      validation:     { start: "Validating trip data...", done: "Data validated" },
      recommendation: { start: "Finding best options...", done: "Options scored and ranked" },
      confidence:     { start: "Verifying recommendations...", done: "Confidence scores calculated" },
      budget:         { start: "Estimating budget...", done: "Budget estimated" },
      candidateFlow:  { start: "Preparing selections...", done: "Selections ready" },
      replan:         { start: "Checking if replanning needed...", done: "Replan评估完成" },
      planner:        { start: "Generating your itinerary...", done: "Itinerary generated" },
      decision:       { start: "Optimizing your plan...", done: "Plan optimized" },
      optimizer:      { start: "Optimizing routes...", done: "Routes optimized" },
      booking:        { start: "Checking availability...", done: "Booking options ready" },
      tripManager:    { start: "Finalizing your trip...", done: "Trip saved and learning applied" }
    };
    return messages[stage]?.[phase] || `${stage} ${phase}`;
  }

  /**
   * Bridge: trip_planner.plan() — handles both old (raw ctx) and new (PlannerInput) shapes.
   */
  _runPlanner(ctx) {
    // trip_planner_v2.js expects PlannerInput contract
    const entities = ctx.state?.normalizedEntities || {};
    const plannerInput = {
      destination:       entities.destination,
      days:              entities.durationDays || 3,
      travelStyle:       entities.travelStyle || "mid",
      travelersType:     entities.travelersType || "solo",
      budget:            entities.budget,
      places:            entities.selectedPlaces || [],
      hotel:             entities.selectedHotel || null,
      flight:            entities.selectedFlight || null,
      season:            ctx.season || "unknown",
      constraints:       {},
    };

    return planner.plan(plannerInput);
  }

  /**
   * Bridge: Build BookingIntent from context and process through BookingLayer.
   * The Planner never knows about booking APIs.
   */
  _runBooking(ctx) {
    const entities = ctx.state?.normalizedEntities || {};
    const itinerary = ctx.recommendations?.optimizedItinerary
      || ctx.recommendations?.improvedItinerary
      || ctx.recommendations?.draftItinerary;

    const hotel = ctx.recommendations?.selectedHotel || entities.selectedHotel;
    const flight = ctx.recommendations?.selectedFlight || entities.selectedFlight;

    const intent = BookingIntent({
      tripId: ctx.tripId || null,
      userId: ctx.userId || ctx.state?.userId || "anonymous",
      destination: entities.destination || "",
      startDate: entities.startDate || null,
      endDate: entities.endDate || null,
      durationDays: entities.durationDays || 3,
      travelStyle: entities.travelStyle || "mid",
      travelersType: entities.travelersType || "solo",
      budget: entities.budget || 0,
      hotel: hotel ? HotelRequest({
        destinationId: entities.destination,
        checkIn: entities.startDate,
        checkOut: entities.endDate,
        style: entities.travelStyle,
        area: hotel.location || null
      }) : null,
      flight: flight ? FlightRequest({
        origin: flight.origin || entities.origin || "DEL",
        destination: entities.destination || flight.destination,
        departureDate: entities.startDate,
        passengers: 1,
        cabinClass: entities.travelStyle === "luxury" ? "business" : "economy"
      }) : null,
      activities: [],
      metadata: {
        sessionId: ctx.sessionId,
        itineraryDays: itinerary?.dailyPlans?.length || 0
      }
    });

    // Use BookingLayer (independent from Planner)
    return bookingLayer.process(intent, {
      name: entities.userName || "",
      email: entities.userEmail || "",
      phone: entities.userPhone || ""
    }).then(reservationSet => ({
      success: true,
      data: { bookingSuggestions: reservationSet },
      errors: [],
      warnings: [],
      confidence: reservationSet.overallStatus === "CONFIRMED" ? 0.95 : 0.7,
      processingTime: 0,
      metadata: { stage: "BOOKING" }
    })).catch(err => ({
      success: false,
      data: null,
      errors: [err.message],
      warnings: [],
      confidence: 0,
      processingTime: 0,
      metadata: { stage: "BOOKING" }
    }));
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

      // Clear stale recommendations when starting fresh (no previous context)
      if (!previousContext) {
        context.recommendations = {};
      }

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

        // PlannerLock is a first-class workflow state, not an error.
        // When locked, HALT the pipeline immediately — no downstream stages run.
        if (stage === "planner") {
          const lock = plannerLock.evaluate(context);
          if (lock.locked) {
            skippedStages.push(stage);
            tracer.record("PLANNER_LOCKED", "⚠ locked", 0, [lock.reason]);
            warnings.push(lock.reason);
            // Clear stale recommendations — no cards should render during clarification
            context.recommendations = {};
            executionStatus = "WAITING_CLARIFICATION";
            tracer.record("PIPELINE_HALTED", "⚠ planner_locked", 0);
            break;
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
          eventBus.emitProgress(sessionId, stage, "start", {
            message: this.getStageMessage(stage, "start")
          });
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
            errors: response?.errors || [],
            message: this.getStageMessage(stage, stageOk ? "done" : "error")
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
              // Clear stale recommendations — no cards should render during clarification
              context.recommendations = {};
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

          } else if (stage === "tripManager") {
            context.tripResult = response.data;
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

      // Finalize memory — persist any corrections back to permanent storage
      try {
        memoryStage.finalize(context);
      } catch (memErr) {
        warnings.push(`Memory finalize failed: ${memErr.message}`);
      }

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

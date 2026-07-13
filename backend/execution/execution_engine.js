const classifier = require("../conversation/conversation_classifier");
const updater = require("../conversation/context_updater");
const clarification = require("../conversation/clarification_engine");
const replan = require("../planner/replanning_engine");
const planner = require("../planner/trip_planner");
const decision = require("../decision/decision_engine");
const optimizer = require("../optimizer/route_optimizer");
const budget = require("../budget/budget_engine");
const recommendation = require("../recommendation/recommendation_engine");
const booking = require("../booking/booking_engine");

/**
 * Travel Intelligence OS - Execution Engine.
 *
 * Master Orchestrator coordinating all engine stages deterministically.
 * Conforms to execution_engine_spec.md.
 *
 * @module execution_engine
 */

class ExecutionEngine {
  constructor() {
    this.registry = {
      classifier: { run: (ctx) => classifier.classifyConversation(ctx), critical: true },
      updater: { 
        run: (ctx) => {
          // Extracts newly incoming query text parameters
          const updates = ctx.state?.normalizedEntities || {};
          return updater.applyContextUpdate(ctx, updates);
        }, 
        critical: true 
      },
      clarification: { run: (ctx) => clarification.evaluate(ctx), critical: true },
      replan: { run: (ctx, prev) => replan.analyze(ctx, prev), critical: true },
      planner: { run: (ctx) => planner.plan(ctx), critical: true },
      decision: { run: (ctx) => decision.optimize(ctx), critical: true },
      optimizer: { run: (ctx) => optimizer.optimize(ctx), critical: true },
      budget: { run: (ctx) => budget.calculate(ctx), critical: false },
      recommendation: { run: (ctx) => recommendation.recommend(ctx), critical: false },
      booking: { run: (ctx) => booking.recommendBookings(ctx), critical: false }
    };

    // Execution sequence flow
    this.sequence = [
      "classifier",
      "updater",
      "clarification",
      "replan",
      "planner",
      "decision",
      "optimizer",
      "budget",
      "recommendation",
      "booking"
    ];
  }

  registerEngine(name, runner, isCritical = false) {
    this.registry[name] = { run: runner, critical: isCritical };
    this.sequence.push(name);
  }

  async execute(context, previousContext = null) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    const executedStages = [];
    const skippedStages = [];
    const failedStages = [];
    const stageLogs = [];

    let currentStageIndex = 0;
    let executionStatus = "READY";
    let plannerInstructions = [];

    try {
      if (!context || typeof context !== "object") {
        throw new Error("Invalid TravelContext: expected an object");
      }

      executionStatus = "RUNNING";
      const execId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      let downstreamFilter = null;
      let requiresReplanning = true;

      // Outer orchestration loop
      while (currentStageIndex < this.sequence.length) {
        const stage = this.sequence[currentStageIndex];
        const engine = this.registry[stage];

        if (!engine) {
          throw new Error(`Unknown or unregistered engine stage: '${stage}'`);
        }

        // 1. Conditional Gating Decisions
        let shouldSkip = false;

        // Skip booking if intent is planning only or not requested
        if (stage === "booking" && context.state?.intent !== "BOOK_TRIP") {
          shouldSkip = true;
        }

        // Filter based on Replanning Downstream lists
        if (downstreamFilter && !downstreamFilter.includes(stage)) {
          // Stays, routes, and planners can be filtered
          if (["planner", "decision", "optimizer", "budget", "recommendation", "booking"].includes(stage)) {
            shouldSkip = true;
          }
        }

        // Bypassing execution entirely if replanning is false
        if (!requiresReplanning && ["planner", "decision", "optimizer"].includes(stage)) {
          shouldSkip = true;
        }

        if (shouldSkip) {
          skippedStages.push(stage);
          currentStageIndex++;
          continue;
        }

        // 2. Stage Execution Block with Timeout & Retry Strategy
        const stageStart = Date.now();
        let retries = 0;
        const maxRetries = engine.critical ? 1 : 3;
        let response = null;

        while (retries < maxRetries) {
          let timeoutId;
          try {
            // Apply simulated timeout check
            const timeoutPromise = new Promise((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error(`Timeout: stage '${stage}' exceeded limit`)), 2000);
            });

            // Execute engine runner
            const runPromise = Promise.resolve(
              stage === "replan" ? engine.run(context, previousContext) : engine.run(context)
            );

            response = await Promise.race([runPromise, timeoutPromise]);
            clearTimeout(timeoutId);

            if (response && response.success) {
              break;
            }
            throw new Error(response?.errors?.[0] || `Stage '${stage}' returned success=false`);

          } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            retries++;
            if (retries >= maxRetries) {
              if (engine.critical) {
                throw err;
              } else {
                response = { success: false, errors: [err.message] };
                break;
              }
            }
          }
        }

        const stageEnd = Date.now();
        const duration = stageEnd - stageStart;

        // Log stage execution details
        stageLogs.push({
          stage,
          startTime: new Date(stageStart).toISOString(),
          endTime: new Date(stageEnd).toISOString(),
          durationMs: duration,
          status: response?.success ? "COMPLETED" : "FAILED",
          warnings: response?.warnings || [],
          errors: response?.errors || []
        });

        // 3. Post-execution Side Effects & Context Merging
        if (response && response.success) {
          executedStages.push(stage);

          // Update context namespaces (merge safely)
          if (!context.recommendations) {
            context.recommendations = {};
          }

          if (stage === "classifier") {
            context.state.conversationType = response.data.detectedType;
          } else if (stage === "clarification") {
            // Freeze pipeline if clarification triggers
            if (response.data.requiresClarification) {
              executionStatus = "WAITING_CLARIFICATION";
              break;
            }
          } else if (stage === "replan") {
            requiresReplanning = response.data.requiresReplanning;
            plannerInstructions = response.data.plannerInstructions || [];
            if (requiresReplanning && response.data.downstreamEngines) {
              downstreamFilter = response.data.downstreamEngines;
            }
          } else if (stage === "planner") {
            context.recommendations.draftItinerary = response.data.draftItinerary;
          } else if (stage === "decision") {
            context.recommendations.improvedItinerary = response.data.improvedItinerary;
          } else if (stage === "optimizer") {
            context.recommendations.optimizedItinerary = response.data.optimizedItinerary;
          } else if (stage === "budget") {
            context.recommendations.budgetSummary = response.data.budgetSummary;
          } else if (stage === "recommendation") {
            Object.assign(context.recommendations, response.data);
          } else if (stage === "booking") {
            context.recommendations.bookingSuggestions = response.data;
          }

          // Advance pipeline
          currentStageIndex++;
        } else {
          // Recoverable failure handling
          failedStages.push(stage);
          if (engine.critical) {
            executionStatus = "FAILED";
            throw new Error(`Critical stage failed: '${stage}'`);
          } else {
            warnings.push(`Recoverable failure in stage '${stage}': proceeding anyway`);
            currentStageIndex++;
          }
        }
      }

      if (executionStatus === "RUNNING") {
        executionStatus = "COMPLETED";
      }

      const totalTime = Date.now() - startTime;
      const data = {
        executionId: execId,
        executionStatus,
        executedStages,
        skippedStages,
        failedStages,
        currentStage: null,
        nextStage: null,
        finalContext: context,
        plannerInstructions,
        executionSummary: `Pipeline terminated with status: '${executionStatus}'`
      };

      return {
        success: executionStatus === "COMPLETED" || executionStatus === "WAITING_CLARIFICATION",
        data,
        errors,
        warnings,
        confidence: 0.98,
        processingTime: totalTime,
        metadata: {
          stageLogs
        }
      };

    } catch (err) {
      errors.push(err.message);
      return {
        success: false,
        data: {
          executionStatus: "FAILED",
          executedStages,
          skippedStages,
          failedStages,
          finalContext: context
        },
        errors,
        warnings,
        confidence: 0.0,
        processingTime: Date.now() - startTime,
        metadata: {
          stageLogs
        }
      };
    }
  }
}

module.exports = new ExecutionEngine();

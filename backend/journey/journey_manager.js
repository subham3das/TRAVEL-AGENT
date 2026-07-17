/**
 * Travel OS Journey Manager
 * 
 * Central State Machine for the Travel Operating System.
 * Replaces the legacy candidate_flow.js.
 */
const { validateTrip, validateIntent } = require("../contracts/EngineContracts");

const STAGES = {
  START: "START",
  DESTINATION: "DESTINATION",
  INTERESTS: "INTERESTS",
  PLACE_SELECTION: "PLACE_SELECTION",
  BUDGET_ESTIMATION: "BUDGET_ESTIMATION",
  USER_BUDGET: "USER_BUDGET",
  DAY_ESTIMATION: "DAY_ESTIMATION",
  USER_DAYS: "USER_DAYS",
  HOTEL_SELECTION: "HOTEL_SELECTION",
  TRANSPORT_SELECTION: "TRANSPORT_SELECTION",
  REVIEW: "REVIEW",
  GENERATING: "GENERATING",
  READY: "READY",
  DRAFT: "DRAFT",
  FINALIZED: "FINALIZED",
  BOOKED: "BOOKED",
  COMPLETED: "COMPLETED"
};

class JourneyManager {
  constructor(eventBus = null) {
    this.eventBus = eventBus; // Decoupled event bus
  }

  /**
   * Initializes a new journey or loads an existing one.
   * Returns a valid Trip Aggregate.
   */
  initializeJourney(existingTrip = null) {
    if (existingTrip) {
      return validateTrip(existingTrip);
    }
    return validateTrip({
      journeyState: STAGES.START
    });
  }

  /**
   * Advances the state machine based on the current context and user intent.
   * Returns a ClarificationConfig if input is needed, or null if the pipeline can continue.
   */
  evaluate(tripAggregate) {
    let currentState = tripAggregate.journeyState;
    const intent = tripAggregate.intent || {};
    
    // We determine the next stage deterministically based on missing data
    if (currentState === STAGES.START || currentState === STAGES.DESTINATION) {
      if (!intent.destination) {
        tripAggregate.journeyState = STAGES.DESTINATION;
        return this._buildClarification("destination", "Where would you like to travel?");
      }
      currentState = STAGES.INTERESTS;
      tripAggregate.journeyState = STAGES.INTERESTS;
    }

    if (currentState === STAGES.INTERESTS) {
      if (!intent.selectedPlaces || intent.selectedPlaces.length === 0) {
        tripAggregate.journeyState = STAGES.PLACE_SELECTION;
        return null; // Signals the orchestrator to run RecommendationEngine
      }
      currentState = STAGES.BUDGET_ESTIMATION;
      tripAggregate.journeyState = STAGES.BUDGET_ESTIMATION;
    }

    if (currentState === STAGES.BUDGET_ESTIMATION) {
      if (!tripAggregate.budgetSummary) {
        return null; // Signals the orchestrator to run BudgetEstimator
      }
      currentState = STAGES.USER_BUDGET;
      tripAggregate.journeyState = STAGES.USER_BUDGET;
    }

    if (currentState === STAGES.USER_BUDGET) {
      if (!intent.budgetConstraint) {
        return this._buildClarification("budgetConstraint", "What is your budget?");
      }
      currentState = STAGES.DAY_ESTIMATION;
      tripAggregate.journeyState = STAGES.DAY_ESTIMATION;
    }

    if (currentState === STAGES.DAY_ESTIMATION) {
      if (!intent.daysConstraint) {
        return this._buildClarification("daysConstraint", "How many days are you planning for?");
      }
      currentState = STAGES.HOTEL_SELECTION;
      tripAggregate.journeyState = STAGES.HOTEL_SELECTION;
    }

    if (currentState === STAGES.HOTEL_SELECTION) {
      if (!intent.selectedHotel) {
        return null; // Signals the orchestrator to run Provider (Hotels)
      }
      currentState = STAGES.TRANSPORT_SELECTION;
      tripAggregate.journeyState = STAGES.TRANSPORT_SELECTION;
    }

    if (currentState === STAGES.TRANSPORT_SELECTION) {
      if (!intent.selectedFlight) {
        return null; // Signals the orchestrator to run Provider (Flights)
      }
      currentState = STAGES.REVIEW;
      tripAggregate.journeyState = STAGES.REVIEW;
    }

    if (currentState === STAGES.REVIEW) {
      // Could show a final review screen, or jump straight to generation
      tripAggregate.journeyState = STAGES.GENERATING;
      currentState = STAGES.GENERATING;
    }
    
    if (currentState === STAGES.GENERATING) {
      return null; // Signals the orchestrator to run Planner
    }

    return null; // No clarification needed
  }

  _buildClarification(target, prompt) {
    return {
      type: "text",
      target: target,
      prompt: prompt,
      options: []
    };
  }
}

module.exports = {
  STAGES,
  JourneyManager
};

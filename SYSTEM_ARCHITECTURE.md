# Travel Intelligence OS - Master System Architecture

This document serves as the Single Source of Truth for the architecture, lifecycle, and interaction model of the Travel Intelligence OS.

---

## 1. Vision

The long-term goal of the Travel Intelligence OS is to build a deterministic, hyper-intelligent travel operating system. 
- **It is NOT a chatbot.**
- **It is NOT an LLM wrapper.**
Competitive advantage comes from structured, programmatic travel knowledge, deterministic scoring matrices, exact path optimization, and strict rule bounds. Language Models (LLMs) are restricted entirely to parsing user queries and formatting compiled responses; they never make planning or optimization decisions.

---

## 2. High-Level Architecture

The system is structured as an isolated, layered monorepo:

```
┌─────────────────────────────────────────────────────────┐
│                        Frontend                         │
└────────────────────────────┬────────────────────────────┘
                             │ JSON APIs
                             ▼
┌─────────────────────────────────────────────────────────┐
│                    Execution Layer                      │
│     (ExecutionEngine orchestrates Pipeline Flow)       │
└────────────────────────────┬────────────────────────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ Conversation │       │  Planning &  │       │  Knowledge   │
│    Layer     │       │ Optimization │       │    Layer     │
│ (Classifier, │       │   (Planner,  │       │  (Loader,    │
│ State,       │       │   Decision,  │       │  Cache,      │
│ Clarification│       │   Router,    │       │  Validator,  │
│ Updater)     │       │   Budget)    │       │  Query)      │
└──────────────┘       └──────────────┘       └──────────────┘
```

- **Compiler Layer**: Identifies intent and parses inputs.
- **Knowledge Layer**: Exposes destination nodes and metadata schemas.
- **Conversation Layer**: Evaluates dialogue state machines, loops, and updates.
- **Planning/Optimization Layer**: Builds, orders, and scores daily paths.
- **Booking Layer**: Compares rates using registered booking providers.
- **Response Layer**: Merges engine states into a unified frontend payload.

---

## 3. Request Lifecycle

1. **User input query** enters the system $\rightarrow$ parsed by the `Compiler`.
2. `ConversationClassifier` identifies conversation type; `ContextUpdater` updates parameters.
3. `ClarificationEngine` checks required fields. If inputs are missing, halts execution and prompts user.
4. `ReplanningEngine` calculates change severity. If destination changes, runs full planning; if budget changes, runs partial updates.
5. `TripPlanner` creates the base itinerary.
6. `DecisionEngine` applies heuristics, weather swaps, and fatigue buffers.
7. `RouteOptimizer` runs TSP reordering and transport selector.
8. `BudgetEngine` aggregates costs and estimates risk.
9. `RecommendationEngine` enriches itinerary with safety guidelines and cultural advice.
10. `BookingEngine` selects optimal flights and hotels.
11. `ResponseComposer` creates the final response contract payload.

---

## 4. TravelContext Lifecycle

`TravelContext` is the shared, immutable state container passed across execution scopes.
- **Namespace isolation**: No engine may overwrite another engine's context property.
- **State mappings**:
  - `context.state.normalizedEntities`: Parameters extracted from user query.
  - `context.state.conversationState`: State machine metrics and counts.
  - `context.recommendations.draftItinerary`: Base planner day structure.
  - `context.recommendations.optimizedItinerary`: Fully-sorted routes and times.
  - `context.recommendations.budgetSummary`: Daily and category budgets.

---

## 5. Engine Dependency Graph

### 1. Intent Detector / Entity Extractor
- **Purpose**: Identify query intent and extract values (destination, dates).
- **Outputs**: Raw entity logs.

### 2. Knowledge Service
- **Purpose**: Expose cached node lookups and tag queries.
- **Dependencies**: None.

### 3. Conversation State Manager
- **Purpose**: Manage transitions, retry limits, and counts.
- **Dependencies**: None.

### 4. Clarification Engine
- **Purpose**: Verify required planning parameters and block downstream steps if missing.
- **Dependencies**: `Conversation State`.

### 5. Replanning Engine
- **Purpose**: Compare current and previous entities to determine down-stream changes.
- **Dependencies**: `TravelContext`.

### 6. Trip Planner
- **Purpose**: Plan day slots and attractions.
- **Dependencies**: `Knowledge Service`.

### 7. Decision Engine
- **Purpose**: Swap activities based on weather or fatigue.
- **Dependencies**: `TripPlanner` output.

### 8. Route Optimizer
- **Purpose**: Resolve distances, order slots, and insert travel buffers.
- **Dependencies**: `DecisionEngine` output.

### 9. Budget Engine
- **Purpose**: Aggregate spending and generate cost-savings suggestions.
- **Dependencies**: `RouteOptimizer` output.

### 10. Booking Engine
- **Purpose**: Match provider options.
- **Dependencies**: `BudgetEngine` output.

---

## 6. Execution Pipeline

Synchronous execution order:
`classifier` $\rightarrow$ `updater` $\rightarrow$ `clarification` $\rightarrow$ `replan` $\rightarrow$ `planner` $\rightarrow$ `decision` $\rightarrow$ `optimizer` $\rightarrow$ `budget` $\rightarrow$ `recommendation` $\rightarrow$ `booking`.

### Conditional Gates
- If clarification is needed, abort immediately.
- If `requiresReplanning` is `false`, skip planner, decision, and route optimization.
- If only budget changes, skip planner and decision, execute budget, recommendations, and booking only.

---

## 7. Knowledge Graph

- **Schemas**: JSON-schema checks for Destination, Attraction, Restaurant, Hotel, Transport, and Rule.
- **Loader**: Scans directories, parses JSON, and validates formatting.
- **Cache**: Stores all loaded nodes in-memory with indices for `id`, `destinationId`, and `type`.
- **Validator**: Verifies referential integrity (e.g. check if attractions point to valid destinations).

---

## 8. Conversation Architecture

- **State machine**: Manages conversation flow (IDLE $\leftrightarrow$ COLLECTING $\leftrightarrow$ WAITING $\leftrightarrow$ PLANNING $\leftrightarrow$ COMPLETED).
- **Classifier**: Rules-based keyword/regex parsing.
- **Updater**: Mutates TravelContext parameters with safety guards.
- **Clarification**: Controls loop bounds and limits retries to 3 attempts.

---

## 9. Planning Architecture

- **TripPlanner**: Uses target scorer matrices (interest, travel style, popularity, season).
- **DecisionEngine**: Runs rule-based swaps (e.g., replace beaches with indoor museums if rainy).
- **RouteOptimizer**: Solves TSP ordering to minimize transit time.

---

## 10. Response Architecture

- **ExecutionEngine**: Executes stages dynamically from registry, applying timeouts and failovers.
- **ResponseComposer**: Consolidates results into a single payload and computes weighted system confidence scores.

---

## 11. Engine Response Contract

```json
{
  "success": true,
  "data": { ... },
  "errors": [],
  "warnings": [],
  "confidence": 0.98,
  "processingTime": 1.2,
  "metadata": {}
}
```

---

## 12. Folder Structure

```
backend/
├── booking/         (Booking options aggregator & providers)
├── budget/          (Budget calculations & saving recommendations)
├── conversation/    (Conversation state, classifiers, and updaters)
├── decision/        (Post-plan rule optimizer)
├── execution/       (Master orchestrator engine)
├── knowledge/       (Graph loading, schemas, caching, and validating)
├── optimizer/       (Traveling Salesman Route Engine)
├── planner/         (Itinerary generation, scoring, and replanning)
├── recommendation/  (Packing checklists, safety tips, cultural customs)
├── response/        (Final Consolidated payload generator)
└── tests/           (Scenarios test suites)
```

---

## 13. Future Architecture

- **Memory Engine**: Tracks traveler history and past ratings.
- **Feedback Engine**: Captures user ratings and tunes planner scores.
- **Learning Engine**: Adapts scoring weights based on user feedback.
- **LLM Adapter**: Maps Response Composer JSON structures into natural language.

---

## 14. Scalability

- **Database migration**: Move in-memory Knowledge Graph to neo4j or Amazon Neptune.
- **Caching**: Integrate Redis for session and context caching.
- **Parallel processing**: Use parallel workers (e.g. BullMQ) to resolve provider rates.

---

## 15. Guiding Principles

1. **Deterministic Execution**: Scoring, planning, and routing must remain 100% reproducible.
2. **Strict Modular Isolation**: Modules communicate only via context properties.
3. **Decoupled API Providers**: Flight, stay, and map interfaces must remain abstract strategies.

---

## 16. Roadmap

- **Completed**: Knowledge graph, validator, planner scoring, trip planner, decision engine, route optimizer, budget tracker, recommendation engine, booking registry, state machine, classifier, context updater, clarification engine, replanning analyzer, execution engine, and response composer.
- **Planned**: Memory profiling, feedback loops, neo4j migrations.

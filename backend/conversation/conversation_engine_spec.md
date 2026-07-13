# Travel Intelligence OS - Conversation Engine Specification

This document defines the architecture and state model for the Conversation Engine (`backend/conversation/conversation_engine.js`). It manages conversation states and orchestrates compiler pipeline execution deterministically without implementing planning or booking logic.

---

## 1. Purpose

The Conversation Engine acts as the orchestrator of interactions between the user's input and the internal Travel Intelligence compiler pipeline. 

### Core Boundaries
- **It Owns**: Conversation classification, conversation state transitions, clarification loops, and replanning triggers.
- **It Must Never**:
  - Generate itineraries or routes (delegated to `TripPlanner` / `RouteOptimizer`).
  - Recommend activities, restaurants, or lodging (delegated to `RecommendationEngine`).
  - Perform or request bookings (delegated to `BookingEngine`).
  - Invoke external APIs.
  - Rely on non-deterministic LLM reasoning for workflow or state transitions.

---

## 2. Responsibilities

1. **User Message Analysis**: Parse incoming text to extract structural intents and updates.
2. **Context Evaluation**: Assess `TravelContext` to identify missing parameters (destination, dates, budget).
3. **Conversation Classification**: Classify input messages into canonical types (e.g. `NEW_REQUEST`, `MODIFICATION`).
4. **Clarification Orchestration**: Trigger structured clarification questions when critical fields are missing.
5. **Replanning Triggering**: Detect when user modifications require partial or full itinerary rebuilding.
6. **State Transitions**: Transition the user's journey between states (`IDLE`, `COLLECTING`, `PLANNING`, etc.).

---

## 3. Inputs

The Conversation Engine reads the following objects from `TravelContext`:
- **`Latest User Message`**: The raw text query submitted by the user.
- **`TravelContext.state`**: Includes `intent` and `normalizedEntities` from the compiler pipeline.
- **`TravelContext.recommendations`**: The active draft itinerary (if generated).
- **`Conversation History`**: Chronological log of previous user messages, classifications, and system outputs.
- **`Memory State`**: User profile parameters (travel style preferences, accessibility flags).

---

## 4. Outputs

Conforms strictly to the standard Engine Response Contract:

```json
{
  "success": true,
  "data": {
    "conversationType": "MODIFICATION",
    "nextAction": "TRIGGER_REPLAN",
    "clarificationRequired": false,
    "clarificationQuestion": null,
    "updatedContext": { ... },
    "continuePipeline": true,
    "triggerReplan": true
  },
  "errors": [],
  "warnings": [],
  "confidence": 0.95,
  "processingTime": 1.5,
  "metadata": {
    "currentState": "REPLANNING"
  }
}
```

---

## 5. Conversation Types

Input queries are deterministically classified into one of these types:

- **`NEW_REQUEST`**: Initiating a new travel search (e.g., "I want to go to Goa for 3 days").
- **`FOLLOW_UP`**: Asking informational questions about the current itinerary ("Is Baga Beach family friendly?").
- **`MODIFICATION`**: Directly changing parameters of the plan ("Actually, make it 5 days").
- **`CLARIFICATION_RESPONSE`**: Providing details requested in a previous system question ("My budget is ₹30,000").
- **`GREETING`**: General hello/goodbye.
- **`GENERAL_CHAT`**: Conversations outside travel planning scopes.
- **`BOOKING_REQUEST`**: Direct request to start booking ("Book this hotel now").
- **`CANCEL`**: Resets conversation state and wipes context.
- **`UNKNOWN`**: Inputs that cannot be mapped.

---

## 6. State Machine

```
      GREETING / NEW_REQUEST
[IDLE] ───────────────────────► [COLLECTING_INFORMATION]
  ▲                                    │
  │ CANCEL                             │ Missing Core Data
  │                                    ▼
  │                           [WAITING_FOR_CLARIFICATION]
  │                                    │
  │                                    │ All Info Received
  │                                    ▼
  │                             [PLANNING]
  │                                    │
  │                                    ▼
  │                           [PLAN_COMPLETED]
  │                                    │
  │                                    ├─► MODIFICATION ──► [REPLANNING]
  │                                    │                       │
  │                                    │                       ▼
  │                                    │               [PLAN_COMPLETED]
  │                                    │
  └────────────────────────────────────┴─► BOOKING ─────► [BOOKED]
```

### Transition Rules
1. **`IDLE` $\rightarrow$ `COLLECTING_INFORMATION`**: Triggered by user intent classification matching `NEW_REQUEST`.
2. **`COLLECTING_INFORMATION` $\rightarrow$ `WAITING_FOR_CLARIFICATION`**: Triggered if any core fields (destination, duration) are missing.
3. **`WAITING_FOR_CLARIFICATION` $\rightarrow$ `PLANNING`**: Triggered once all missing parameters are resolved.
4. **`PLAN_COMPLETED` $\rightarrow$ `REPLANNING`**: Triggered by `MODIFICATION` type input (e.g., date shift, duration change).
5. **`PLAN_COMPLETED` $\rightarrow$ `IDLE`**: Triggered by `CANCEL` command.

---

## 7. Clarification Strategy

If the compiler has missing or ambiguous variables, the Conversation Engine triggers `clarificationRequired: true` and defines the target field.

### Priority Order for Clarification
1. **Destination**: Cannot plan without a target region.
2. **Duration**: Necessary for day-by-day slot allocation.
3. **Travel Dates / Month**: Necessary for weather profiles and seasonality.
4. **Budget**: Required for lodging and transport constraints.
5. **Travelers / Profile**: Required for solo/family scoring weights.

### Ambiguity Handling
If the normalizer returns multiple destination options (e.g. "I want to go to Goa or Mumbai"), the engine flags this as `Ambiguous Location` and outputs a clarification prompt requesting a single selection.

---

## 8. Replanning Strategy

When the engine detects a `MODIFICATION` conversation type, it determines the depth of the change required:

### Full Replanning (Triggered by Core Changes)
- **Triggers**: Destination change, start date change, duration change.
- **Action**: Resets `optimizedItinerary` and `dailyPlans` and re-runs the entire pipeline starting from `TripPlanner`.

### Partial Replanning (Triggered by Soft Changes)
- **Triggers**: Budget cap change, travel style update (e.g., budget to luxury), specific node deletion (e.g., "Remove Baga Beach").
- **Action**: Passes the existing draft itinerary back to `DecisionEngine` and `RouteOptimizer` to swap or reorder nodes in-place without rebuilding the base itinerary.

---

## 9. Workflow Integration

The Conversation Engine acts as the outer gatekeeper within the `WorkflowManager`:

1. **User input** arrives $\rightarrow$ normalizer extracts entity updates.
2. **Conversation Engine** evaluates the state:
   - If `WAITING_FOR_CLARIFICATION` is true, halts pipeline execution and returns the clarification question to the user.
   - If all parameters are satisfied, sets `continuePipeline: true`, routing context to `TripPlanner`, `DecisionEngine`, `RouteOptimizer`, `BudgetEngine`, and `RecommendationEngine`.
3. If user updates parameters, sets `triggerReplan: true` to invoke optimization passes.

---

## 10. TravelContext Interaction

### Allowed Reads
- `context.request.query` (Latest user message)
- `context.state.normalizedEntities` (Extracted parameters)
- `context.recommendations` (Active draft plan)

### Allowed Modifies
- `context.state.conversationState` (Current state machine value)
- `context.state.clarificationTarget` (Active missing field)
- `context.state.history` (Appends current interaction logs)

---

## 11. Error Handling

- **Empty Messages**: Returns `warnings: ["Empty query received"]` and retains current state.
- **Malformed Context**: If `state` or `history` is corrupted, resets to `IDLE` state and flags `errors: ["Malformed context structure"]`.
- **Clarification Loop Prevention**: If the user fails to provide a requested field 3 times consecutively, defaults to destination averages (e.g., ₹5,000 budget, 2 days duration) and proceeds to `PLANNING` state.
- **Contradictory Inputs**: If user states "No flights" but style is "luxury", flags warning and defaults to driving/cab transport.

---

## 12. Edge Cases

- **"Actually make it 5 days."**
  - Classified as `MODIFICATION`. Transition state to `REPLANNING`. Set `triggerReplan: true` with full replan flag.
- **"Remove Day 2."**
  - Classified as `MODIFICATION`. Transition to `REPLANNING`. Instructs planner/decision engine to prune Day 2 slots and re-run route optimization.
- **"Forget Goa."**
  - Classified as `CANCEL`. Resets context, wipes itinerary, transitions to `IDLE`.
- **"My budget is now 40k."**
  - Classified as `MODIFICATION`. Sets new budget and triggers partial replanning.
- **"I'm travelling with kids."**
  - Classified as `MODIFICATION`. Sets traveler type to `family`, updating attraction scoring profiles.

---

## 13. Future Integration

The Conversation Engine remains fully deterministic. LLM integration (Gemini/OpenAI) is restricted strictly to:
1. **Entity Extraction / Semantic Classification**: Mapping user text to semantic conversation types (e.g. mapping "actually make it shorter" to `MODIFICATION`).
2. **Response Generation**: Converting the engine's structured outputs and clarification targets (e.g. `clarificationTarget: "duration"`) into conversational natural language.

No business logic, state routing, or optimization logic is delegated to the LLM.

---

## 14. Success Criteria

1. **Deterministic State Routing**: Transitions must match the state machine matrix 100% of the time.
2. **Zero Planner Dependency**: No planning coordinates, durations, or itinerary logic is written inside this engine.
3. **No External APIs**: Zero network requests.
4. **Workflow Compliance**: Conforms strictly to standard Response Contract and successfully blocks or allows workflow execution.

# Travel Intelligence OS - Replanning Engine Specification

This document defines the architecture, change detection logic, preservation rules, and execution directives for the Replanning Engine (`backend/planner/replanning_engine.js`). It determines how changes to user preferences or parameters modify an existing itinerary while minimizing recomputation.

---

## 1. Purpose

The Replanning Engine sits between the Conversation/Context Layer and the core Execution Engines (Planner, Decision, Optimizer, Budget, Recommendation, Booking). 

It prevents expensive and disruptive full itinerary regenerations when soft changes occur (such as budget shifts, transport tweaks, or duration adjustments). It ensures previously optimized decisions and confirmed bookings are preserved wherever possible.

```
          Conversation Layer
                  │
                  ▼
         Clarification Engine
                  │
                  ▼
         [Replanning Engine]  ◄─── (Compares Contexts & Identifies Modifications)
                  │
                  ├───► (Full Replan) ──────► TripPlanner (Rebuild Itinerary)
                  │
                  ├───► (Partial Replan) ───► Decision Engine / Route Optimizer
                  │
                  └───► (No-op / Minor) ────► Route / Budget Recalculator
```

---

## 2. Responsibilities

- **Context Comparison**: Compare the current `TravelContext` with the previous `TravelContext` state to identify mutations.
- **Classification of Scope**: Classify modification scopes (e.g., Destination shift, budget update, duration shift).
- **Region Separation**: Identify affected itinerary days and preserved days.
- **Preservation Application**: Preserve existing bookings, routes, or nodes according to mapping rules.
- **Instruction Generation**: Formulate explicit downstream directives (e.g., `REBUILD_ROUTE_ONLY`, `REPLACE_HOTELS`).
- **Pipeline Orchestration**: Determine which engines must run to execute the update.

---

## 3. Inputs

- **`TravelContext`** (Current proposed state).
- **`Previous TravelContext`** (Historical state containing the active draft/final itinerary).
- **`Current Normalized Entities`** (Newly parsed parameters).
- **`Previous Normalized Entities`** (Parameters used to build the previous plan).
- **`Conversation State`** (Replanning counts, current transitions).
- **`Validation Results`** (Latest validation logs).

---

## 4. Output Contract

Conforms strictly to the Engine Response Contract:

```json
{
  "success": true,
  "data": {
    "requiresReplanning": true,
    "replanningScope": "PARTIAL",
    "changedFields": ["budget"],
    "affectedDays": [1, 2],
    "preservedDays": [3],
    "preservedBookings": ["book_hotel_goa_beach_inn"],
    "preservedRoutes": [],
    "plannerInstructions": ["RECALCULATE_BUDGET", "REPLACE_HOTELS"],
    "reason": "Budget cap reduced from 20000 to 10000 requires stay swaps."
  },
  "errors": [],
  "warnings": [],
  "confidence": 1.0,
  "processingTime": 1.2,
  "metadata": {}
}
```

---

## 5. Change Detection

The engine detects mutations across the following fields:
- **`destination`**: Destination changes (e.g., Goa $\rightarrow$ Mumbai).
- **`budget`**: Budget limit updates.
- **`durationDays`**: Shortening or extending duration.
- **`travelStyle`**: Style parameter changes (e.g., mid $\rightarrow$ luxury).
- **`travelDates`**: Shift in calendar dates or seasonality.
- **`travelersType`**: Traveler group updates (solo, couple, family).
- **`interests`**: Addition/subtraction of interest tags.
- **`preferences`**: Accommodation, transport, or food preference adjustments.

---

## 6. Replanning Scope Matrix

Deterministic mapping of modifications to execution scope:

| Detected Change | Scope | Downstream Directive | Primary Target Engine |
| :--- | :--- | :--- | :--- |
| **Destination Changed** | `FULL` | `FULL_REPLAN` | `TripPlanner` |
| **Dates Changed (Season Shift)** | `FULL` | `FULL_REPLAN` | `TripPlanner` |
| **Duration Increased** | `PARTIAL` | `PLAN_NEW_DAYS` | `TripPlanner` (New days only) |
| **Duration Reduced** | `PARTIAL` | `TRIM_ITINERARY` | `DecisionEngine` |
| **Budget Decreased** | `PARTIAL` | `REPLACE_HOTELS` | `DecisionEngine` & `BudgetEngine` |
| **Travel Style Changed** | `PARTIAL` | `REPLACE_HOTELS_ACTIVITIES`| `DecisionEngine` |
| **Transport Preference Changed** | `PARTIAL` | `REBUILD_ROUTE_ONLY` | `RouteOptimizer` |
| **Interests Updated** | `PARTIAL` | `SWAP_ACTIVITIES` | `DecisionEngine` |

---

## 7. Preservation Rules

Rules for component preservation:

- **Stays/Hotels**: When budget decreases, preserve attractions but replace stays. If budget increases or is unchanged, preserve active stays.
- **Attractions**: Keep scheduled attractions unless interests change or duration is shortened (requires trimming last days).
- **Routes**: Keep routes if order is unchanged. If transport preference changes, recalculate durations/costs without reordering nodes.
- **Confirmed Bookings**: Locked items (flagged `booked: true` or inside `preservedBookings`) are completely immutable and must not be replaced.

---

## 8. Change Severity

Categorized by severity rules:

- **`NONE`**: No change in entities. No replanning.
- **`LOW`**: Minor tweaks (e.g., transport style, food preferences). Re-run `RouteOptimizer` / `BudgetEngine` only.
- **`MEDIUM`**: Budget updates, interest swaps. Re-run `DecisionEngine` and downstream.
- **`HIGH`**: Duration shifts. Trim or append days.
- **`CRITICAL`**: Destination change or date season shift. Complete reset.

---

## 9. Planner Instructions

Directives returned in the response contract:
- **`FULL_REPLAN`**: Clear itinerary and run entire pipeline.
- **`PLAN_NEW_DAYS`**: Append new days and plan activities for them only.
- **`TRIM_ITINERARY`**: Slice daily plans array to the new duration limit.
- **`REPLACE_HOTELS`**: Swap stays matching new budget/style.
- **`REBUILD_ROUTE_ONLY`**: Re-run TSP router and transport selector.
- **`RECALCULATE_BUDGET`**: Re-run cost calculator and risk calculations.
- **`KEEP_EXISTING`**: Do-nothing instruction.

---

## 10. Dependency Matrix

Indicates downstream execution flow required:

| Instruction | Planner | Decision | Optimizer | Budget | Recs | Booking |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `FULL_REPLAN` | Yes | Yes | Yes | Yes | Yes | Yes |
| `PLAN_NEW_DAYS` | Yes | Yes | Yes | Yes | Yes | Yes |
| `TRIM_ITINERARY` | No | Yes | Yes | Yes | Yes | Yes |
| `REPLACE_HOTELS` | No | Yes | No | Yes | Yes | Yes |
| `REBUILD_ROUTE_ONLY` | No | No | Yes | Yes | Yes | Yes |
| `RECALCULATE_BUDGET` | No | No | No | Yes | Yes | Yes |

---

## 11. Conflict Resolution

- **Conflicting Updates**: If budget decreases below confirmed booking cost, emit warnings and ignore budget reduction.
- **Missing Previous Itinerary**: Fall back to `FULL_REPLAN`.
- **Impossible Trims**: If duration is shortened but Day 3 has confirmed bookings, trim unconfirmed days first.

---

## 12. Error Handling

- **Missing Context**: Fails response contract.
- **Corrupted Itinerary**: If context has itinerary but structure is invalid, fallback to `FULL_REPLAN` with warning.
- **Unknown Modification**: Triggers `warnings: ["Unknown change category"]` and defaults to `FULL_REPLAN`.

---

## 13. Loop Prevention

1. **Max Replans Limit**: Restrict consecutive replans to **5 iterations**.
2. **Cycle Breaker**: If same entity toggles back and forth, locks field modification and triggers error.
3. **No-op detection**: If updated value matches previous value, instantly returns `requiresReplanning: false`.

---

## 14. Integration

The Replanning Engine sits as the entry controller in the Execution Layer. The `WorkflowManager` queries this engine first:
- If `requiresReplanning` is `false`, bypasses planner execution.
- If `requiresReplanning` is `true`, passes the generated instructions to the workflow stages.

---

## 15. Future Extensibility

- **Flight delays**: Re-route optimization automatically if flight arrival shifts.
- **Weather updates**: Trigger partial swaps if monsoon conditions are flagged in real-time forecast.

---

## 16. Verification Plan

Verify the following scenarios:
1. **No changes**: Correctly returns `requiresReplanning: false` and `severity: NONE`.
2. **Budget decrease**: Triggers `REPLACE_HOTELS` and `severity: MEDIUM`.
3. **Duration increase**: Triggers `PLAN_NEW_DAYS`.
4. **Duration decrease**: Triggers `TRIM_ITINERARY`.
5. **Destination change**: Triggers `FULL_REPLAN` and `severity: CRITICAL`.
6. **Transport preference change**: Triggers `REBUILD_ROUTE_ONLY` and `severity: LOW`.
7. **Missing previous itinerary**: Defaults to `FULL_REPLAN`.

# Travel Intelligence OS - Response Composer Specification

This document defines the architecture, data merging rules, confidence calculations, formatting requirements, and response contracts for the Response Composer (`backend/response/response_composer.js`). It creates a unified deterministic output payload from all engine results.

---

## 1. Purpose

The Response Composer acts as the final deterministic stage in the Travel Intelligence System. While downstream execution engines produce isolated outputs (daily plans, routes, costs, places), the Response Composer aggregates and formats these inputs into a single, cohesive response. This formatted schema acts as the interface layer consumed by frontend components or LLM prompt summarizers.

---

## 2. Responsibilities

- **Data Aggregation**: Merge partial results from `TripPlanner`, `DecisionEngine`, `RouteOptimizer`, `BudgetEngine`, `RecommendationEngine`, `BookingEngine`, and `ClarificationEngine`.
- **Duplicate De-duplication**: Aggregate and sort warnings/errors by severity level.
- **Weighted Confidence Calculation**: Compute a system-wide confidence score based on the performance of individual modules.
- **Payload Composition**: Produce the unified payload without altering or recalculating itinerary optimization data.
- **Execution Lifecycle Reporting**: Map active conversation and execution statuses to consumer-ready directives (e.g. `nextActions`).

---

## 3. Inputs

- **`TravelContext`** (Fully executed state).
- **`Execution Summary`** (List of executed/failed/skipped stages).
- **`Planner Output`** (Base draft plan).
- **`Decision Output`** (Swapped / updated plan).
- **`Optimizer Output`** (Ordered routes with transit metrics).
- **`Budget Output`** (Daily spend aggregates).
- **`Recommendation Output`** (Cultural advice, shopping, safety tips).
- **`Booking Output`** (Provider options).
- **`Conversation State`** (Current state value).

---

## 4. Output Contract

Conforms strictly to the Engine Response Contract:

```json
{
  "success": true,
  "data": {
    "tripSummary": {
      "destination": "Goa",
      "durationDays": 3,
      "travelStyle": "mid",
      "travelersType": "solo",
      "totalDistanceKm": 48.5,
      "totalCost": 12244,
      "budgetRisk": "low"
    },
    "dailyPlan": [ ... ],
    "transportPlan": {
      "totalTravelTimeMinutes": 150,
      "walkingDistanceKm": 2.5,
      "transportCost": 520,
      "primaryMode": "driving"
    },
    "stayPlan": {
      "hotelName": "Goa Beach Inn",
      "pricePerNight": 2500,
      "bookingStatus": "suggested"
    },
    "budgetSummary": { ... },
    "bookingSummary": { ... },
    "recommendations": { ... },
    "packingChecklist": [ ... ],
    "safetyTips": [ ... ],
    "localTips": [ ... ],
    "importantWarnings": [ ... ],
    "executionSummary": "Pipeline completed successfully.",
    "conversationState": "PLAN_COMPLETED",
    "nextActions": ["BOOK_TRIP", "REPLAN"]
  },
  "errors": [],
  "warnings": [],
  "confidence": 0.98,
  "processingTime": 1.5,
  "metadata": {}
}
```

---

## 5. Composition Rules

The Response Composer merges segments according to domain ownership:
- **`TripPlanner` / `RouteOptimizer`** own the structure of `dailyPlans` (slots, sequences, times).
- **`BudgetEngine`** owns budget ratios, risk levels, and saving recommendations.
- **`BookingEngine`** owns suggestions and provider mappings.
- **`RecommendationEngine`** owns cultural advice, tips, packing checklists, and alternatives.

No fields may overlap or overwrite other domains.

---

## 6. Formatting Rules

Daily plans are formatted inside the `dailyPlan` array in chronological order:
- **`Morning`**: Slots between 08:00 AM and 12:00 PM.
- **`Lunch`**: Slots between 12:00 PM and 01:30 PM.
- **`Afternoon`**: Slots between 01:30 PM and 05:00 PM.
- **`Evening`**: Slots between 05:00 PM onwards.
- **`Travel`**: Embedded transit descriptions (distance, duration, mode).
- **`Stay`**: Embedded lodging details at the start and end of the day.

---

## 7. Confidence Aggregation

The system-wide confidence score is computed as a weighted average:

$$Confidence_{Global} = w_{planner} \cdot C_{planner} + w_{decision} \cdot C_{decision} + w_{budget} \cdot C_{budget} + w_{booking} \cdot C_{booking} + w_{recs} \cdot C_{recs}$$

### Weight Matrix
- **`Planner`**: 0.30
- **`Decision`**: 0.20
- **`Budget`**: 0.15
- **`Booking`**: 0.15
- **`Recommendation`**: 0.20

If a stage was skipped (e.g. `booking` is skipped), its weight is distributed proportionally to `Planner` and `Decision`.

---

## 8. Missing Data Handling

- **Missing Stays/Hotels**: Leaves `stayPlan` as `null` and appends warnings.
- **Clarification pending**: If `ClarificationEngine` was activated, returns `requiresClarification: true` and replaces itinerary data with `clarificationPrompt` fields.
- **Cancelled Execution**: Returns empty daily plans and resets next actions to `["INIT_PLAN"]`.

---

## 9. Warning Aggregation

Collects warning arrays from all executed stages:
1. De-duplicates warning strings.
2. Orders warnings:
   - **High Severity**: Budget overspends, route safety flags.
   - **Medium Severity**: Seasonal beach closures, high crowd warnings.
   - **Low Severity**: Accommodation style swaps.

---

## 10. Error Aggregation

If the execution manager returns `success: false`:
- Response Composer extracts critical error descriptions from the execution logs.
- Merges stage-level errors into the top-level `errors` field.
- Ensures the final response outputs `success: false` with complete stack trace/message descriptions.

---

## 11. Response Variants

- **`Planning Complete`**: Full itinerary, budget summary, recommended places, packing checklist. Next actions: `["BOOK_TRIP", "MODIFY_PLAN"]`.
- **`Clarification Needed`**: Contains state `WAITING_FOR_CLARIFICATION`, empty daily plans, and clarification target question.
- **`Booking Only`**: Contains stay/transit bookings and pricing details.
- **`Execution Failed`**: success: `false`, populated `errors` array, status: `"FAILED"`.

---

## 12. Future LLM Integration

When a natural language UI is requested:
1. Deterministic engines run first.
2. The Response Composer formats the structured results.
3. The LLM reads this composed response *only* and generates natural conversation text. The LLM is restricted from reading raw engine outputs or context logs directly.

---

## 13. Future Frontend Integration

The JSON response output matches a locked schema:
- Maps are rendered using coordinate properties inside `dailyPlan.slots.coordinates`.
- Timeline components read slot arrays directly.
- Status bars bind directly to `executionStatus` and `budgetRisk`.

---

## 14. Verification Plan

Verify the following:
1. **Complete itinerary**: Verify correct parsing and merging of Goa 3-day itinerary data.
2. **Missing bookings**: Ensure budget is calculated even if booking engine is skipped.
3. **Duplicate warnings**: Verify identical warning strings are filtered.
4. **Confidence calculations**: Confirm the weighted average evaluates to 0.98.
5. **Clarification prompts**: Verify target question is set when clarification is pending.

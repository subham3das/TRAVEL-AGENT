# Travel Intelligence OS - Clarification Engine Specification

This document defines the architecture and validation rules for the Clarification Engine (`backend/conversation/clarification_engine.js`). It evaluates the completeness and confidence of user inputs and determines whether down-stream execution (planning, booking, recommending) can safely continue.

---

## 1. Purpose

The Clarification Engine operates as a gatekeeper between the Conversation Layer (classifier, context updater) and the Execution Layer (planner, route optimizer, decision engine).

```
          Conversation Input
                  │
                  ▼
       Conversation Classifier
                  │
                  ▼
           Context Updater
                  │
                  ▼
        [Clarification Engine]  ◄─── (Blocks execution if info missing/low confidence)
                  │
                  ├───► (Yes) ──► Clarification Question Prompted to User
                  │
                  └───► (No) ───► Execution Engines (Planner, Route Optimizer, etc.)
```

---

## 2. Responsibilities

- **Inspect TravelContext**: Read `normalizedEntities` and `conversationState` to audit the completeness of parameters.
- **Inspect Entity Confidence**: Compare parsed entity confidence values against defined thresholds to decide if confirmation is needed.
- **Inspect Validation Warnings**: Capture conflicts and constraints from the schema validation layer.
- **Determine Clarification Need**: Evaluate if execution block is necessary.
- **Determine Missing/Low-Confidence Target**: Map exact fields requiring clarification or confirmation.
- **Generate Clarification Questions**: Select pre-defined questions or confirmation prompts.
- **Prevent Redundancy**: Audit history to ensure identical questions are not prompted multiple times.

---

## 3. Required Inputs

- **`TravelContext`**: The canonical context object.
- **`Conversation State`**: Tracks current state, current retry counts, and targets.
- **`Normalized Entities`**: Fields extracted from the latest request (destination, dates, budget).
- **`Entity Confidence`**: Mapping of entity types to parsing confidence scores (0.0 to 1.0).
- **`Validation Output`**: Warnings, schema failures, or contradictory parameters.
- **`Current Intent`**: Selected conversational intent (`NEW_REQUEST`, `MODIFICATION`, etc.).
- **`Conversation History`**: History of previous prompts and questions.

---

## 4. Output Contract

Conforms strictly to the Engine Response Contract:

```json
{
  "success": true,
  "data": {
    "requiresClarification": true,
    "missingFields": ["durationDays"],
    "questions": [
      {
        "field": "durationDays",
        "question": "How many days will your trip be?",
        "clarificationId": "clar_goa_duration_01",
        "stage": "WAITING_FOR_USER",
        "retryCount": 0
      }
    ],
    "priorityOrder": ["destination", "travelDates", "durationDays", "budget"],
    "blockedPipeline": true,
    "readyForExecution": false
  },
  "errors": [],
  "warnings": [],
  "confidence": 1.0,
  "processingTime": 1.1,
  "metadata": {}
}
```

---

## 5. Required Fields Matrix

Different intent pipelines require different mandatory fields to execute.

| Execution Intent | Mandatory Fields | Optional Fields |
| :--- | :--- | :--- |
| **`GENERATE_PLAN`** | Destination, Duration (Days), Travel Dates / Season, Travelers Type | Budget (defaults to `mid`), Travel Style (defaults to `mid`), Interests |
| **`BOOK_TRIP`** | Confirmed Itinerary, Traveler Details (Name/IDs), Contact Info, Payment Status | Stays choices, Transit choices |
| **`GET_RECOMMENDATIONS`**| Destination | Interests, Budget, Stays |

---

## 6. Clarification Priority

If multiple fields are missing, the Clarification Engine requests information in a strict priority order:

1. **`destination`**: Must know *where* to retrieve knowledge files from.
2. **`travelDates`**: Must know *season* to check weather suitability.
3. **`durationDays`**: Must know *duration* to structure day slots.
4. **`budget`**: Must know *limit* to filter stays/restaurants.
5. **`travelersType`**: Must know *travelers* to apply scoring weights (solo/couple/family).
6. **`travelStyle`**: Must know *style* to filter activities and stays.

---

## 7. Question Templates

All prompts are static templates.

| Missing Field | Question Template |
| :--- | :--- |
| **`destination`** | "Which destination would you like to visit?" |
| **`travelDates`** | "When are you planning to travel?" |
| **`durationDays`** | "How many days will your trip be?" |
| **`budget`** | "What is your approximate travel budget?" |
| **`travelersType`** | "How many people are travelling (solo, couple, or family)?" |
| **`travelStyle`** | "What is your preferred travel style (budget, mid, or luxury)?" |

---

## 8. Clarification State Machine

```
      Init / Missing Info
[READY] ───────────────► [NEEDS_CLARIFICATION]
  ▲                             │
  │ Resolved                    ▼
  │                     [WAITING_FOR_USER] ◄─── (Prompt Question)
  │                             │
  │                             ├───► Invalid Answer ──► [RECHECK] (Increment retry)
  │                             │                           │
  │                             │                           ▼ (If retry > limit)
  │                             │                        [ERROR_ABORT]
  │                             │
  └─────────────────────────────┴───► Valid Answer ──► [READY_FOR_EXECUTION]
```

---

## 9. Duplicate Prevention

- **Audit Logs**: Before prompting a question, the engine scans `context.state.history`.
- **Match Flag**: If a question targeting the same field was asked in the immediately preceding system message, and the user provided an unparseable response, the engine increments the retry counter rather than repeating the question without context. On the third attempt, it falls back to a default value.

---

## 10. Confidence Rules

The engine routes inputs based on confidence levels extracted by the normalizer:

- **`Confidence > 0.9`**: Accept automatically. Update context and transition.
- **`Confidence 0.6 to 0.9`**: Accept but append confirmation flag in system output (e.g. "We set your destination to Goa. Let us know if you meant somewhere else.").
- **`Confidence < 0.6`**: Treat field as missing and trigger clarification loop.

---

## 11. Clarification Completion

- **Ready for execution**: Set `readyForExecution: true` and `requiresClarification: false` when all mandatory fields (matrix) are satisfied and confidence is validated.
- **Abort execution**: If retry count exceeds 3 for any field, aborts calculation, returns `success: false` with escalation errors.

---

## 12. Error Handling

- **Invalid Context**: Throws schema error and blocks execution.
- **Impossible Clarification**: If user requests impossible constraints (e.g., "5-day trip but budget ₹500 including luxury hotels"), aborts planning phase.
- **Contradictory Answers**: If user inputs "solo traveller with my kids", flags warning, defaults travelersType to `"family"`.

---

## 13. Loop Prevention

1. **Max Retry Count**: A maximum of 3 clarification attempts per field is allowed.
2. **Defensive Defaults**: If count reaches 3, the engine automatically injects destination averages:
   - Budget $\rightarrow$ ₹10,000.
   - Duration $\rightarrow$ 3 days.
   - TravelersType $\rightarrow$ `"solo"`.
3. **Reset**: When a field is successfully resolved, the count resets to 0.

---

## 14. Integration

1. **State Manager**: The Clarification Engine updates state to `WAITING_FOR_CLARIFICATION` if fields are missing.
2. **Classifier**: If State is `WAITING_FOR_CLARIFICATION`, the classifier knows to prioritize `CLARIFICATION_RESPONSE` routing.
3. **Execution Manager**: Blocks compiler stages from invoking `TripPlanner` until `readyForExecution` is true.

---

## 15. Future Extensibility

- **Voice/Audio**: Clarification output schemas will support audio prompt tokens.
- **Images**: Location/receipt clarification schemas will match OCR-extracted values.

---

## 16. Verification Plan

The unit tests must verify:
1. **Missing Destination**: Trigger clarification for destination.
2. **Missing Duration**: Trigger clarification for duration.
3. **Low Confidence Check**: Trigger clarification when destination confidence is 0.4.
4. **Multiple Missing Fields**: Ensure priority sorting returns destination prompt first.
5. **Duplicate Prevention**: Ensure question is not repeated in loop without warning/retry updates.
6. **Retry Exceeded**: Ensure engine inserts defensive defaults after 3 failures.
7. **Successful Completion**: Transition to `readyForExecution: true` when all fields are resolved.

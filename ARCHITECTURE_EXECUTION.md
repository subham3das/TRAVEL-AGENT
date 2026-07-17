# Travel OS — Phase A: Frontend/Backend Integration Stabilization

## Objective

The architecture already exists.

Do NOT add new features.

Do NOT redesign the architecture.

Do NOT create new engines unless absolutely required.

The goal of this phase is to make the existing Travel OS work correctly from end-to-end.

The system must consume backend responses exactly as produced instead of replacing them with fallback chat messages.

---

# Primary Problem

The frontend currently behaves like a normal chatbot instead of a Travel Operating System.

Backend engines produce structured execution states, candidate cards, clarification questions, recommendations, and planner results.

The frontend ignores most of this data and replaces successful responses with:

```
Trip planned.
```

This hides the actual backend output.

---

# Rules

## NEVER

- Never hardcode fallback text like "Trip planned."
- Never replace backend payloads with generic assistant messages.
- Never ignore structured backend data.
- Never calculate anything inside the frontend.
- Never fabricate cards.
- Never fabricate itinerary data.
- Never silently swallow backend fields.

---

## ALWAYS

The frontend must render exactly what the backend returns.

If the backend asks a clarification question,
render clarification cards.

If the backend returns candidate cards,
render candidate cards.

If the backend returns planner output,
render JourneyView.

If the backend returns execution state,
route the UI accordingly.

The backend is the single source of truth.

---

# Current Bug

Inside

frontend/hooks/useSSE.ts

the following code exists:

```ts
cleanup(
    "complete",
    res.data?.composedText || "Trip planned."
);
```

This is incorrect.

If composedText is missing, every successful response becomes

```
Trip planned.
```

This destroys all backend output.

This fallback must be removed.

---

# Required Fixes

## 1. Remove Generic Success Fallback

Do NOT replace missing composedText with

```
Trip planned.
```

Instead:

If composedText exists

→ display it

Else

→ inspect backend response and route accordingly.

---

## 2. Handle Execution States

The frontend must understand states such as

```
WAITING_DESTINATION
WAITING_PLACES
WAITING_DATES
WAITING_BUDGET
WAITING_HOTEL
WAITING_FLIGHT
GENERATING
COMPLETED
```

These states determine which UI component renders.

---

## 3. Consume Structured Backend Data

Support all backend payloads including

```
questions
candidateFlow
backendOutput
recommendations
candidateCards
hotelCandidates
flightCandidates
budgetSummary
dailyPlan
executionSummary
journey
trip
plannerOutput
```

Do not ignore any supported field.

---

## 4. Clarification Routing

If

```
requiresClarification == true
```

render clarification UI.

Never display a completed trip message.

---

## 5. Candidate Routing

If

```
candidateCards
```

exist

render Selection Cards.

Never convert them into chat text.

---

## 6. Hotel Routing

If

```
hotelCandidates
```

exist

render Hotel Grid.

---

## 7. Flight Routing

If

```
flightCandidates
```

exist

render Flight Grid.

---

## 8. Planner Routing

If

```
dailyPlan
```

exists

render JourneyView.

Do not render plain text.

---

## 9. Generation Routing

When EventBus emits

```
GENERATION_START
```

show

GenerationScene.

When planner completes

hide GenerationScene.

---

## 10. Preserve Backend Data

Every backend payload must be stored.

Do not discard

```
backendOutput
executionSummary
activeContext
candidateFlow
```

These objects are required by later interactions.

---

# Debug Requirements

Trace one request:

```
trip to goa
```

Log every stage.

For each stage print

```
Input
Output
Execution Time
Next Stage
Errors
Dropped Fields
```

Identify the FIRST point where backend data is discarded.

---

# Validation

The following conversation must work.

User

```
trip to goa
```

↓

Destination detection

↓

Place recommendations

↓

Place cards

↓

Budget estimate

↓

Budget selection

↓

Date picker

↓

Hotel cards

↓

Flight cards

↓

Generation Scene

↓

Journey View

↓

Save Draft

↓

Finalize

↓

My Trips

No generic fallback text should appear.

---

# Constraints

Do NOT redesign the architecture.

Do NOT create duplicate engines.

Do NOT add mock data.

Do NOT change engine contracts.

Only fix integration between backend and frontend.

---

# Deliverables

When finished provide ONLY:

## Root Cause(s)

## Files Modified

## Why Each Change Was Required

## Verification Performed

## Remaining Risks

## Regression Results

## Production Readiness Score

Do NOT claim success unless every verification has actually passed.

If something cannot be verified write

NOT VERIFIED

Never fabricate successful tests.

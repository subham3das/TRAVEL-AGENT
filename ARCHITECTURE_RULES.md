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
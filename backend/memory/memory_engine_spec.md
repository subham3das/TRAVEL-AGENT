# Travel Intelligence OS - Memory Engine Specification

This document defines the architecture, schemas, and state management strategies for the Memory Engine (`backend/memory/memory_engine.js`). It manages short-term and long-term user preferences, travel histories, and feedback records to ensure personalization without modifying planning or booking execution logic.

---

## 1. Purpose

The Memory Engine exists to enable persistent user personalization across dialogue sessions. By tracking user preferences, past travel pacing, and accepted/rejected suggestions:
- Minimizes repetitive clarification questions.
- Adapts daily scoring priorities dynamically based on historical traveler behaviors.
- Retains context configurations when dialogue sessions timeout or reset.

---

## 2. Responsibilities

- **Persistence Management**: Store and retrieve user preferences, profile states, and interaction logs.
- **Context Merging**: Hydrate `TravelContext.user` properties during initialization.
- **Conflict Filtering**: Identify and resolve conflicting updates (e.g. if the user says "I want budget" but has a permanent preference for "luxury").
- **Audit Versioning**: Track incremental schema changes to preferences.
- **Expiration Gating**: Handle session clearing, temporary overrides, and permanent archiving.

---

## 3. Memory Categories

Stored data is organized into the following categories:

- **`Travel Preferences`**: Travel style (luxury, mid, budget), travel pace, accessibility constraints.
- **`Lodging / Stays`**: Hotel ratings, average nightly spends, hotel brands, favorite amenities.
- **`Transit / Transport`**: Preferred transport modes (flight, train, bus, rental cars).
- **`Food / Dining`**: Cuisine preferences (vegetarian, seafood, local shacks), meal budgets.
- **`Historical Logs`**:
  - `Search History`: Previously queried destinations.
  - `Trip History`: Completed optimized itineraries.
  - `Feedback Logs`: Accepted or rejected attraction recommendations.
  - `User Corrections`: Explicit overrides made during planning.

---

## 4. Memory Types

- **`Short-Term / Session`**: Volatile context properties (e.g. current destination, duration for this specific trip). Cleared when state transitions to `IDLE` or conversation resets.
- **`Long-Term / Permanent`**: Deep profile configurations (e.g. food allergies, preferred airlines, seating choices). Retained permanently unless deleted by the user.
- **`Temporary Override`**: Short-term adjustments valid only for the active execution thread (e.g. "I usually travel luxury, but this trip is budget").

---

## 5. Memory Schema

Each memory record conforms to the following schema:

```json
{
  "memoryId": "mem_pref_style_001",
  "userId": "usr_9921_abc",
  "category": "travelStyle",
  "value": "luxury",
  "confidence": 0.95,
  "source": "user_correction",
  "createdAt": "2026-07-14T02:00:00Z",
  "updatedAt": "2026-07-14T02:10:00Z",
  "expiresAt": null,
  "version": 2,
  "importance": 5,
  "accessCount": 12,
  "lastAccessed": "2026-07-14T02:12:00Z"
}
```

---

## 6. Retrieval Strategy

When hydrating `TravelContext` at initialization, the engine compiles preferences based on:

1. **Category**: Load all entries matching target configuration category.
2. **Confidence**: Filter out items with confidence scores $< 0.60$.
3. **Recency**: Sort remaining items by `updatedAt`.
4. **Overrides**: Apply active Temporary Override flags to replace Long-Term preferences during the active thread.

---

## 7. Update Strategy

- **`Merge`**: Append new tags (e.g. adding a new interest tag `"museums"` to `interests` list).
- **`Overwrite`**: Replace existing values if the update source is an explicit correction (e.g., `source: "user_correction"` overrides `source: "implicit_extraction"`).
- **`Ignore`**: Reject updates if confidence of extracted entity is too low.

---

## 8. Expiration Strategy

- **`Session memory`**: Automatically wiped when conversation state transitions to `IDLE` or `CANCELLED`.
- **`Temporary overrides`**: Cleared once execution pipeline returns the final `ResponseComposer` output.
- **`Permanent memory`**: Retained indefinitely with no expiration timestamp (`expiresAt: null`).

---

## 9. Integration

- **Execution Engine**: Invokes Memory Engine at the start of a request to hydrate `TravelContext.user`.
- **Context Updater**: Consults Memory Engine to identify entity conflicts before committing changes.
- **Planner / Scorer**: Reads `TravelContext.user.preferences` to configure scoring weights.

---

## 10. Future Storage

1. **Vector DB (e.g. Pinecone)**: Semantically query past search history and user feedback.
2. **Graph DB (e.g. Neo4j)**: Map user interactions to specific knowledge graph nodes (e.g., track that traveler frequently accepts `"seafood"` restaurants).
3. **Relational DB (PostgreSQL)**: House core permanent profile tables.

---

## 11. Privacy

- **User Ownership**: Users must be able to download their entire compiled preference graph.
- **Purge boundary**: The engine must support `forgetAll(userId)` and `forgetCategory(userId, category)` commands.
- **Data Encryption**: Personal Identifiable Information (PII) must be encrypted at-rest.

---

## 12. Verification Plan

Verify the following:
1. **Store memory**: Verify successful storage of stay preferences (e.g. `wantsPool: true`).
2. **Merge interest lists**: Ensure adding `"beaches"` does not overwrite `"hiking"` tag.
3. **Conflict checks**: Verify temporary overrides successfully bypass permanent settings.
4. **Wipe session**: Check that session-level constraints are cleared on cancel commands.
5. **Confidence decay**: Verify confidence scores decay if a preference is rejected multiple times.

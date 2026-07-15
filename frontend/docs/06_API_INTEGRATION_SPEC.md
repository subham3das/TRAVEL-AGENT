# API Integration Specification - Travel Intelligence OS

This document specifies the network integration architecture, data payloads, streaming lifecycle, and responsive API synchronization policies.

---

## 1. Streaming Lifecycle (SSE Chat Endpoint)
When the traveler sends a message, the frontend initiates a **Server-Sent Events (SSE)** connection to `/api/chat` to stream orchestrator explanations and receive the final itinerary structure:

```
[Client]                                         [API Gateway]
   │                                                   │
   ├─ POST /api/chat (Message payload) ───────────────>│
   │                                                   │
   │<─ 200 OK (text/event-stream) ─────────────────────┤
   │                                                   │
   │<─ Event: "token" { word: "Planning" } ────────────┤ (Token Stream)
   │                                                   │
   │<─ Event: "token" { word: " your" } ───────────────┤
   │                                                   │
   │<─ Event: "trace" { log: "Planner Started" } ─────┤ (System Intercept Logs)
   │                                                   │
   │<─ Event: "result" { responseContract } ───────────┤ (Final Result payload)
   │                                                   │
   └─ Connection Closed ───────────────────────────────┘
```

---

## 2. API Retry & Timeout Policies
- **Request Timeout**: All static JSON requests timeout after `8000ms`. The SSE stream times out if no tokens are received for `12000ms`.
- **Automatic Reconnection**:
  - Max retries: `3`.
  - Backoff pattern: Exponential delay (`1s`, `3s`, `9s`).
- **Error Mapping**:
  - `503 Service Unavailable` $\rightarrow$ Render inline warning: `Server is busy. Re-trying...`
  - `401 Unauthorized` $\rightarrow$ Re-route to Authentication workspace.
  - `400 Bad Request` $\rightarrow$ Print details to the console, notify user of bad query format.

---

## 3. Responsive API Load & Sync Policies

### Mobile Layout (390px)
- **Low Payload Limits**: Mobile requests ask for lightweight payload structures (e.g. coordinates and titles only) to minimize data consumption. Expanded reviews or photo paths are queried only on slot selection.
- **SSE Stream Throttling**: Renders token packets in larger batch groups (every 5-10 tokens) rather than single characters to reduce UI repaint load on mobile CPU.

### Tablet Layout (768px)
- **Standard Payload**: Background rehydration retrieves standard details.

### Desktop Layout (1280px+)
- **Full Payload Fetch**: Retrieves complete, comprehensive detail structures on first request (reviews, transport schedules, maps parameters).
- **Parallel Query Execution**: Concurrent updates on multiple days are batch-saved in parallel to optimize processing time.

---

## 4. Optimistic Updates Implementation
When the user swaps an attraction:
1. **Apply changes locally**: Modify the local day plan in `useItineraryStore` immediately.
2. **Send network request**: POST mutation details to `/api/trips/modify` in the background.
3. **Compare Result**:
   - If the API returns success, update local values with the exact backend-calculated parameters (pricing, transit times).
   - If the API returns an error or times out, immediately roll back the itinerary to the previous state using `useContextStore.undo()` and show a warning toast.

---

## 5. API Versioning
All request payloads include a header:
`X-TravelOS-Version: v1.0.0`
This header guarantees that payload structures match the active backend release specifications, preventing parsing issues on service updates.

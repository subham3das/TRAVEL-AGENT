# State Management Specification - Travel Intelligence OS

This document specifies the client-side state architecture, data stores, offline strategy, and responsive state policies.

---

## 1. Global State Architecture (Zustand Stores)
We separate the application state into four independent stores to minimize re-renders:

```
[UIStore]            --> Theme, Sidebar state, Focus elements
[ChatStore]          --> Active messages thread, input query, streaming tokens
[ItineraryStore]     --> Active days timeline, budget configurations, selected items
[ContextStore]       --> TravelContext, Session state, History stack
```

---

## 2. Store Implementations

### UI Store (`useUIStore`)
```typescript
interface UIState {
  theme: "dark" | "light";
  activeDayIndex: number;
  sidebarOpen: boolean;
  selectedSlotId: string | null;
  activeMobileTab: "chat" | "timeline" | "map"; // Responsive layout tab
  setTheme: (theme: "dark" | "light") => void;
  setActiveDay: (index: number) => void;
  toggleSidebar: () => void;
  setSelectedSlot: (id: string | null) => void;
  setActiveMobileTab: (tab: "chat" | "timeline" | "map") => void;
}
```

### Chat Store (`useChatStore`)
```typescript
interface ChatState {
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    text: string;
    timestamp: string;
  }>;
  isStreaming: boolean;
  currentTokens: string;
  addMessage: (text: string, role: "user" | "assistant") => void;
  setStreaming: (active: boolean) => void;
  appendTokens: (tokens: string) => void;
}
```

### Context Store (`useContextStore`)
Tracks session persistence and mirrors the backend execution context state:
```typescript
interface ContextState {
  activeContext: TravelContext | null;
  history: TravelContext[];
  setContext: (ctx: TravelContext) => void;
  pushHistory: (ctx: TravelContext) => void;
  undo: () => void;
  reset: () => void;
}
```

---

## 3. Responsive State Behaviors

### Mobile Layout (390px)
- **Active Tab Management**: The state `activeMobileTab` governs which viewport is currently rendered (Timeline, Chat, or Map). Switching tabs automatically triggers focus changes.
- **Dampened Gesture States**: Swipe coordinates are processed inside the gesture store to trigger tab switches (`activeMobileTab` changes) when a threshold drag width is exceeded.

### Tablet Layout (768px)
- **Overlay States**: Tablet layout reads `sidebarOpen` to overlay the navigation drawer without displacing the timeline.
- **Dampened Maps snap**: Tap coordinates snap center map markers.

### Desktop Layout (1280px+)
- **Concurrent Workspace States**: The active view state is disabled since all views are visible simultaneously. Drag-and-drop states govern card sorting and list re-ordering inside the `ItineraryStore`.

---

## 4. Synchronization & Persistence
- **State Hydration**: The global context and chat stores utilize the `persist` middleware from Zustand to hydrate state from `localStorage` under `travel-os:session`.
- **Session Swapping**: Switch triggers load context logs matching the saved trip index.
- **Node Cache Policy**: Coordinates, names, and static rules are cached in memory for `3600` seconds. Cache is wiped when a new destination is queried.

---

## 5. Offline Recovery System
- **State Lock**: If the browser detects offline status (`navigator.onLine === false`), it sets the global uiState to `offlineLock` mode.
- **Offline UI**: The "Ask Travel Assistant" textbox is locked with a placeholder: `Offline mode. Re-plan is disabled.`.
- **Queued Mutations**: Itinerary mutations (swapping items, changing budgets) are saved to an offline queue. On reconnect, the UI pushes the queue sequentially to the server and re-aligns.
- **Recovery Notification**: Shows a toast: `Connection restored. Synchronizing your itinerary...`.

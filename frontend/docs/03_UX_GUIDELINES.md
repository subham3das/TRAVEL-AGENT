# UX Guidelines - Travel Intelligence OS

This document details the user experience philosophy, interaction paradigms, and responsive flows for the Travel Intelligence OS.

---

## 1. Core UX Philosophy: Zero-Friction Planning
Planning a trip is historically stressful. The Travel OS reduces mental friction by:
- **Conversational Orchestration**: Let the traveler state their desires in natural language.
- **Progressive Disclosure**: Only show options and metrics when they are relevant.
- **Graceful Clarification**: Never halt the workspace with modal alerts. If the Clarification Engine needs details, highlight the missing parameter fields in-line inside the chat thread.

---

## 2. Conversation-to-Itinerary Evolution
The transition from chat query to structured itinerary must feel continuous:

```
[Chat Entry]
"Plan a 5-day trip to Jaipur starting Oct 10"
      ↓
[In-line Clarification]
"Who is traveling?" -> User clicks "Couple"
      ↓
[Cinema Transition]
Chat pane pushes left. A clean skeleton timeline animates on the right.
      ↓
[Map Sync]
The Map fades in, plotting the coordinate dots of selected stays and attractions.
```

---

## 3. Responsive UX Interactions

### Mobile Layout (390px)
- **One-Handed Focus**: Placing the primary action buttons (e.g. Chat Input, swap triggers, and confirmation triggers) in the bottom third of the screen.
- **Tabbed Progressive Disclosure**: Since space is limited, the timeline, chat, and map are presented in full-screen tabs. Swipe gestures switch viewports seamlessly.
- **Bottom Drawers**: Details sheets and configuration menus open as bottom sheets that slide up from the screen bottom, supporting one-thumb dismissal.

### Tablet Layout (768px)
- **Collapsible Split Panel**: Sidebar navigation collapses to dynamic icon triggers. Chat slides out as an overlay sheet on top of the active timeline view.
- **Interactive Map Sync**: Map fits on half of the viewport. Tapping a timeline card centers the map coordinates.

### Desktop Layout (1280px+)
- **Concurrently Pinned Workspace**: Timeline, Chat, and Map panels are permanently pinned side-by-side. 
- **Low Interaction Friction**: Drag-and-drop support is enabled to quickly re-order timeline slots or move items between days. Maps support real-time zoom snapping on scroll movements.

---

## 4. Loader and Streaming Experience
- **Never freeze the UI**. Show animated line trackers that represent movement between destinations.
- **Stream responses**. When the LLM adapter is calculating, stream the reasoning explanation in small, faded text blocks above the itinerary cards.
- **Explain background decisions**. When the budget optimizer runs, display a mini log trace: `[System] Optimizing hotel ratings against ₹40,000 budget...`
- **Graceful Error Recovery**: If an API call fails or a route cannot be optimized, show a helpful inline message and revert the context to the last stable state.

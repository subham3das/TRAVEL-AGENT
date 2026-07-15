# Production Folder Architecture - Travel Intelligence OS

This document maps out the production Next.js App Router tree structure and folder rules for the Travel OS.

---

## 1. Directory Tree Structure

All source code resides inside the `frontend/` folder, structured as follows:

```
frontend/
├── app/                        # Next.js App Router root
│   ├── layout.js               # Root HTML structure and global CSS imports
│   ├── page.js                 # Landing / Redirect to workspaces
│   ├── globals.css             # Tailwind & theme variables setup
│   ├── providers.js            # Global store and theme providers
│   ├── api/                    # Serverless API routes
│   │   ├── chat/
│   │   │   └── route.js        # SSE stream and chat orchestrator handler
│   │   └── trips/
│   │       └── route.js        # Trips saving/loading API endpoint
│   ├── onboarding/
│   │   └── page.js             # Initial profile preferences gather
│   └── workspace/
│       ├── layout.js           # Navigation layouts & core grid
│       └── page.js             # Active interactive workspaces panel
├── components/                 # Reusable Presentational UI Elements
│   ├── chat/
│   │   ├── ChatInput.jsx       # Chat textbox component
│   │   └── MessageList.jsx     # Messages feed renderer
│   ├── itinerary/
│   │   ├── ItineraryTimeline.jsx # Daily chronological grid
│   │   ├── SlotCard.jsx        # Activity/lunch/stay slot card
│   │   └── BudgetSummary.jsx   # Budget progression sidebar card
│   ├── map/
│   │   └── LeafletMap.jsx      # Mapbox / Leaflet interactive map renderer
│   └── ui/                     # Primitives (shadcn style elements)
│       ├── button.jsx
│       ├── input.jsx
│       ├── dialog.jsx
│       └── dropdown.jsx
├── docs/                       # Specifications & architecture documentation
├── hooks/                      # Custom React Hooks
│   ├── useSSE.js               # SSE connection hook
│   └── useKeyboard.js          # Hotkeys setup helper
├── lib/                        # Common utilities
│   ├── utils.js                # Tailwind CSS merger
│   └── api.js                  # Axios client setup
└── store/                      # Zustand State Management Store files
    ├── chatStore.js
    ├── itineraryStore.js
    └── uiStore.js
```

---

## 2. Folder Convention Rules
- **Components Folder**: Do NOT import state modifiers inside presentational components under `components/`. State adjustments must occur via Zustand hooks or handlers passed down from workspaces page.
- **API routes**: Keep routes stateless. API routes merely map parameters and delegate execution pipelines to the backend.
- **Store Files**: Keep stores independent. State updates that span multiple stores must be orchestrated by custom workspace controllers.

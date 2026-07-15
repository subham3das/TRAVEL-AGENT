# Production Folder Architecture - Travel Intelligence OS

This document maps out the production Next.js App Router tree structure and folder rules for the Travel OS.

---

## 1. Directory Tree Structure

All source code resides inside the `frontend/` folder, structured as follows:

```
frontend/
├── app/                        # Next.js App Router root
│   ├── layout.tsx              # Root HTML structure and global CSS imports
│   ├── page.tsx                # Landing / Redirect to workspaces
│   ├── globals.css             # Tailwind & theme variables setup
│   ├── providers.tsx           # Global store and theme providers
│   ├── api/                    # Serverless API routes
│   │   ├── chat/
│   │   │   └── route.ts        # SSE stream and chat orchestrator handler
│   │   └── trips/
│   │       └── route.ts        # Trips saving/loading API endpoint
│   ├── onboarding/
│   │   └── page.tsx            # Initial profile preferences gather
│   └── workspace/
│       ├── layout.tsx          # Navigation layouts & core grid
│       └── page.tsx            # Active interactive workspaces panel
├── components/                 # Reusable Presentational UI Elements
│   ├── chat/
│   │   ├── ChatInput.tsx       # Chat textbox component
│   │   └── MessageList.tsx     # Messages feed renderer
│   ├── itinerary/
│   │   ├── ItineraryTimeline.tsx # Daily chronological grid
│   │   ├── SlotCard.tsx        # Activity/lunch/stay slot card
│   │   └── BudgetSummary.tsx   # Budget progression sidebar card
│   ├── map/
│   │   └── LeafletMap.tsx      # Mapbox / Leaflet interactive map renderer
│   └── ui/                     # Primitives (shadcn style elements)
│       ├── button.tsx
│       ├── input.tsx
│       ├── dialog.tsx
│       └── dropdown.tsx
├── docs/                       # Specifications & architecture documentation
├── hooks/                      # Custom React Hooks
│   ├── useSSE.ts               # SSE connection hook
│   └── useKeyboard.ts          # Hotkeys setup helper
├── lib/                        # Common utilities
│   ├── utils.ts                # Tailwind CSS merger
│   └── api.ts                  # Axios client setup
└── store/                      # Zustand State Management Store files
    ├── chatStore.ts
    ├── itineraryStore.ts
    └── uiStore.ts
```

---

## 2. Responsive Folder Conventions

To build a single codebase, we enforce responsive conventions inside file structures:

### Mobile Component Adaptations
- Component files (e.g. `SlotCard.tsx`) must contain internal mobile responsive layouts (e.g. check screen state or use Tailwind class properties like `md:hidden` / `hidden md:block`) rather than creating separate component files.

### Layout File Splits
- The main layouts in `workspace/layout.tsx` use CSS grid systems (`grid-cols-1 lg:grid-cols-[240px_1fr_400px]`) that automatically rearrange layouts based on screen viewports, ensuring the codebase is unified.

---

## 3. Folder Convention Rules
- **Components Folder**: Do NOT import state modifiers inside presentational components under `components/`. State adjustments must occur via Zustand hooks or handlers passed down from workspaces page.
- **API routes**: Keep routes stateless. API routes merely map parameters and delegate execution pipelines to the backend.
- **Store Files**: Keep stores independent. State updates that span multiple stores must be orchestrated by custom workspace controllers.

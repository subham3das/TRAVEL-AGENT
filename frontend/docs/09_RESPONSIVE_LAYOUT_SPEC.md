# Responsive Layout Specification - Travel Intelligence OS

This document defines layout breakpoints, structural adaptations, touch interactions, and keyboard navigation systems.

---

## 1. Breakpoint Grid System

We define four responsive breakpoints to scale the workspace smoothly:

- **`Mobile`**: `< 768px` (Single column focus: Workspace sidebar collapsed; Tab switcher controls active screen)
- **`Tablet`**: `768px - 1024px` (Two column focus: Collapsible Navigation, combined Chat + Itinerary feed, fixed Map sheet)
- **`Desktop`**: `1024px - 1440px` (Three panels: Navigation sidebar, Itinerary Timeline view, Map viewer)
- **`Ultrawide`**: `> 1440px` (Four panels: Navigation, Chat Panel, Itinerary Timeline, Map view)

---

## 2. Multi-Panel Adaptation Layouts

```
┌──────────────────────────────────────────────────────────────┐
│                  ULTRAWIDE DISPLAY LAYOUT                    │
├─────────┬──────────────┬──────────────────────┬──────────────┤
│ Nav     │ Chat Panel   │ Itinerary Timeline   │ Map View     │
│ (240px) │ (360px)      │ (Fluid)              │ (400px)      │
└─────────┴──────────────┴──────────────────────┴──────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    MOBILE DISPLAY LAYOUT                     │
├──────────────────────────────────────────────────────────────┤
│                   ACTIVE WORKSPACE SCREEN                    │
│                                                              │
│ [Itinerary Timeline (Scrollable)]                            │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Tabs Navigation Bar: [Itinerary] | [Map] | [Chat]            │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Responsive Screen Behaviors

### Mobile Layout (390px)
- **Single Column Viewport**: Navigation sidebar, chat inputs, timeline view, and map view collapse into a single panel.
- **Bottom Navigation Tab Bar**: Tab bar triggers switch the active panel state `activeMobileTab` (`chat`, `timeline`, `map`). Buttons use large touch boundaries (`48px`).
- **Collapsible Widgets**: Cards stack vertically with horizontal margins of `16px`.

### Tablet Layout (768px)
- **Split Workspace View**: Screen split between timeline and map. Navigation bar is rendered on the left, but collapses into an icon list.
- **Pop-out Chat Overlay**: Chat panel appears as a slide-out overlay sheet rather than taking up grid columns.

### Desktop Layout (1280px+)
- **Concurrency Workspace**: Sidebar, Chat, Itinerary, and Map are all visible concurrently.
- **Information Density**: Side panels reveal metrics, weather charts, and rule inspectors.

---

## 4. Keyboard Navigation Controls
The application is fully navigable via keyboard hotkeys:
- `CMD + K` / `CTRL + K` $\rightarrow$ Toggle Global Search.
- `Alt + 1` / `Alt + 2` / `Alt + 3` $\rightarrow$ Switch responsive tabs on mobile.
- `Tab` / `Shift + Tab` $\rightarrow$ Cycles focus sequentially through interactive cards and inputs.
- `Escape` $\rightarrow$ Closes detail sheets and menus.
- `Arrow Keys` $\rightarrow$ Navigate days on the timeline.

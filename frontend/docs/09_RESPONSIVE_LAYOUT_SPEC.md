# Responsive Layout Specification - Travel Intelligence OS

This document details the responsive breakpoints, fluid typography formulas, panel adaptations, and device-specific layouts.

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

## 3. Mobile Navigation Tab Bar
On screens below `768px`, a fixed bottom navigation bar is loaded. The bar contains three triggers:
1. **`Timeline Tab`**: Renders the day timeline. Day selection is controlled by a sticky horizontal top bar.
2. **`Map Tab`**: Renders the Map view full-screen, with floating action buttons to swap layers.
3. **`Chat Tab`**: Renders the chat input field with floating bubbles.

---

## 4. Keyboard Navigation Controls
The application is fully navigable via keyboard hotkeys:
- `CMD + K` / `CTRL + K` $\rightarrow$ Toggle Global Search.
- `Alt + 1` / `Alt + 2` / `Alt + 3` $\rightarrow$ Switch responsive tabs on mobile.
- `Tab` / `Shift + Tab` $\rightarrow$ Cycles focus sequentially through interactive cards and inputs.
- `Escape` $\rightarrow$ Closes detail sheets and menus.
- `Arrow Keys` $\rightarrow$ Navigate days on the timeline.

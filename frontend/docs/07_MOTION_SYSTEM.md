# Motion System Specification - Travel Intelligence OS

This document details the Framer Motion transition curves, gesture animation physics, and responsive panel/card animation properties for the Travel OS.

---

## 1. Core Transition Curves (The Physics)

We define three key physics settings for spring animations:

```typescript
export const transitions = {
  // Ultra-reactive micro-interactions (switches, buttons, tags)
  micro: {
    type: "spring",
    stiffness: 450,
    damping: 35
  },
  
  // Standard enters, panel slides, and card swaps
  panel: {
    type: "spring",
    stiffness: 280,
    damping: 28
  },
  
  // Cinematic enters (Onboarding text fade-ins, display headers)
  cinematic: {
    type: "spring",
    stiffness: 140,
    damping: 20
  }
};
```

---

## 2. Page & Workspace Transitions

### Workspace Slide Animation
Swapping between Chat and Itinerary workspaces slides panels horizontally:
```typescript
export const workspaceVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: transitions.panel
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
    transition: transitions.panel
  })
};
```

---

## 3. Responsive Motion Adaptations

### Mobile Layout (390px)
- **Swipe-to-Close Gestures**: Details sheets support dragging down to dismiss:
  `drag="y" dragConstraints={{ top: 0, bottom: 200 }} dragElastic={0.2}`.
- **Scroll Snapping**: Vertical scrolling snaps on day boundaries using simple CSS snap-points:
  `scroll-snap-type: y mandatory`.
- **Streamlined Transitions**: Disables complex multi-element layout animations to prevent frame drops on mobile processors.

### Tablet Layout (768px)
- **Overlay Drawer enters**: Sidebar menu slides out from the left:
  `initial={{ x: "-100%" }} animate={{ x: 0 }}`.

### Desktop Layout (1280px+)
- **Shared Layout Animations (`layoutId`)**: Tapping a card expands it in-line to show details, animating layout recalculations smoothly across the workspace.
- **Drag-to-Reorder animations**: Reordering list items animates changes in sibling heights.

---

## 4. Card & List Animations

### Itinerary Days Stagger Enter
When the itinerary page loads, day cards slide in from the bottom in sequence:
```typescript
export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const itemCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.panel
  }
};
```

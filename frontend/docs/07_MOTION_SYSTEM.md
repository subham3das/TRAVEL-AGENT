# Motion System Specification - Travel Intelligence OS

This document details the Framer Motion transition curves, gesture animation physics, and structural page/card animation properties for Travel OS.

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

## 3. Card & List Animations

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

---

## 4. Gesture & Scroll Animations
- **`Drag-to-Reorder List`**: Framer Motion's `<Reorder.Group>` is configured with `layout` animations to smoothly shift items when dragged.
- **`Scroll-Linked Maps Refocus`**: We use Framer Motion's `useScroll` Hook on the daily timeline to track the visible day card. The active day index triggers map coordinate refocusing.
- **`Hover Actions`**: Cards lift slightly on hover (`y: -2`) using `whileHover={{ y: -2, transition: transitions.micro }}`.
- **`Streaming Glow Animation`**: A pulsing CSS box-shadow glows on the chat boundary while messages are streaming.

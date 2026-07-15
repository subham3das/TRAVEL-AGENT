# Component Specification - Travel Intelligence OS

This document provides technical design specifications for every reusable UI component in the Travel Intelligence OS.

---

## 1. ChatInput Component
- **Purpose**: Captures user natural language queries and options selections.
- **Props**:
  ```typescript
  interface ChatInputProps {
    onSend: (message: string) => void;
    placeholder?: string;
    disabled?: boolean;
  }
  ```
- **States**:
  - `query` (string)
  - `isFocused` (boolean)
- **Variants**:
  - `idle`: Gray border (`hsl(240, 5%, 12%)`).
  - `active`: Amber border (`hsl(38, 92%, 50%)`).
  - `disabled`: Grayed background, no interaction.
- **Accessibility**: ARIA labels defined (`aria-label="Ask Travel Assistant"`). Focus outline ring visible on tab selection.
- **Loading / Error / Empty States**:
  - *Loading*: Input is disabled while streaming is active.
  - *Error*: Outline turns crimson if post fails.
- **Animations**: Subtle spring hover scale transition.
- **Responsive Behavior**:
  - *Mobile*: Fixed to screen bottom, height `54px`, large text, full-width.
  - *Tablet*: Fixed to bottom of Chat panel, height `48px`.
  - *Desktop*: Embedded in the Chat sidebar panel.
- **API Dependency**: Posts message directly to `/api/chat`.

---

## 2. SlotCard Component
- **Purpose**: Represents an activity, restaurant, or hotel stay slot inside the day timeline.
- **Props**:
  ```typescript
  interface SlotCardProps {
    id: string;
    type: "activity" | "lunch" | "stay";
    title: string;
    time: string;
    category?: string;
    transitTimeMinutes?: number;
    price?: number;
    rating?: number;
    onSwap: (id: string) => void;
  }
  ```
- **States**:
  - `isHovered` (boolean)
  - `isExpanded` (boolean)
- **Variants**:
  - `activity`: Standard slate card (`bg-card`).
  - `lunch`: Sleeker outline card with dining icon.
  - `stay`: Deep background stay anchor node at bottom of day.
- **Accessibility**: Screen reader reads titles, types, and times sequentially. Elements have `role="button"` when swap is enabled.
- **Loading / Error / Empty States**:
  - *Loading*: Displays skeletal placeholder when replanning is active.
- **Animations**: Slide up enter stagger. Scale hover (`1.01x`).
- **Responsive Behavior**:
  - *Mobile*: Height `80px` card. Tap reveals details. Swiping left triggers swap action directly (one-hand friendly gesture).
  - *Tablet*: Dynamic height based on content. Swap icon visible on card edge.
  - *Desktop*: Drag-to-reorder enabled. Interactive hover reveals quick action popups.
- **API Dependency**: Calls `/api/chat` with modification context on swap.

---

## 3. BudgetSummaryCard Component
- **Purpose**: Visualizes cost breakdown and allows budget cap adjustments.
- **Props**:
  ```typescript
  interface BudgetSummaryCardProps {
    totalCost: number;
    budgetLimit: number;
    breakdown: {
      stays: number;
      activities: number;
      food: number;
      transport: number;
    };
    onBudgetChange: (limit: number) => void;
  }
  ```
- **States**:
  - `draggingLimit` (number)
- **Variants**:
  - `normal`: Cost is within budget limits.
  - `risk`: Cost is near or exceeds limits (Yellow/Red indicator bars).
- **Accessibility**: Color-blind friendly icons. Screen reader reads cost percentages.
- **Animations**: Smooth progress bar transition.
- **Responsive Behavior**:
  - *Mobile*: Renders as a top-screen pull-down header element. Tap expands details list.
  - *Tablet*: Slides out from the top navigation bar.
  - *Desktop*: Sticky right-side panel card, showing detailed price breakdown charts.
- **API Dependency**: Calls `/api/chat` with updated budget values.

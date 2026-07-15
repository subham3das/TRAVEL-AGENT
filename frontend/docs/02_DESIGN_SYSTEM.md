# Design System Specification - Travel Intelligence OS

This document details the visual guidelines, grid scales, surface hierarchies, and components styling for the Travel Intelligence OS.

---

## 1. Visual Hierarchy & Surface Hierarchy
Travel OS uses a multi-layered surface structure that mimics depth and focus. 

- **Layer 0 (Background)**: HSL Dark Obsidian (`hsl(240, 10%, 4%)`). The flat base layer.
- **Layer 1 (Card & Content)**: HSL Deep Slate (`hsl(240, 6%, 7%)`). Used for floating trip cards, text boxes, and panel backdrops.
- **Layer 2 (Interactions & Sheets)**: HSL Muted Slate (`hsl(240, 5%, 12%)`). Used for hover states, dropdown sheets, and dialog overlays.

---

## 2. Grid & Container Spacing Scale (8pt Grid)
We enforce a strict 8pt grid scale for spacing, margins, padding, and heights:

```
Token       | Value  | Use Case
────────────────────────────────────────────────────────────────
--space-1   | 8px    | Micro-margins, gaps between inline badges
--space-2   | 16px   | Inner padding of standard cards, button gaps
--space-3   | 24px   | Section margins, padding of main panels
--space-4   | 32px   | Gutters between multi-column views
--space-5   | 48px   | Hero offset margins
--space-6   | 64px   | Page boundary padding
```

- **Container Widths**:
  - *Main Workspace*: Max-width `1200px` (centered).
  - *Chat Feed Container*: Max-width `720px` (centered to optimize reading line length).
  - *Settings & Profile Sheet*: Max-width `640px`.

---

## 3. Typography Hierarchy
We pair **Outfit** (editorial, headers) with **Inter** (precision, UI control).

- **Display**: Outfit, size `48px`, weight `500`, tracking `-0.03em`. Used for destination names and primary titles.
- **Heading 1**: Outfit, size `32px`, weight `500`, tracking `-0.02em`. Used for Day numbers (`Day 1`).
- **Heading 2**: Outfit, size `20px`, weight `500`, tracking `-0.01em`. Used for slot card titles.
- **Body Large**: Inter, size `16px`, weight `400`, line-height `1.6`. Used for chat bubbles.
- **Body Small**: Inter, size `14px`, weight `400`, line-height `1.5`. Used for details and metrics.
- **Caption**: Inter, size `12px`, weight `500`, uppercase, tracking `0.05em`. Used for tags and minor headers.

---

## 4. Cards & Buttons System
- **Cards**: All cards have a border radius of `12px`, border width of `1px` (`hsl(240, 5%, 12%)`), and background of `hsl(240, 6%, 7%)`. There are NO drop shadows; depth is achieved via solid contrast.
- **Buttons Hierarchy**:
  - *Primary Button*: White text, background warm gold (`hsl(38, 92%, 50%)`), radius `6px`. Used for booking and finalizing plans.
  - *Secondary Button*: White text, border `1px solid hsl(240, 5%, 12%)`, transparent background, radius `6px`. Used for options and details.
  - *Destructive Button*: Red text (`hsl(0, 84%, 60%)`), border `1px solid hsl(0, 84%, 20%)`, transparent background. Used for deleting plans.

---

## 5. Input System & State Colors
- **Inputs**: Radius `8px`, border `1px solid hsl(240, 5%, 12%)`, background `hsl(240, 6%, 7%)`, text color `hsl(0, 0%, 98%)`.
- **Status Colors**:
  - *Success*: HSL Emerald (`hsl(142, 70%, 45%)`).
  - *Warning*: HSL Gold-Yellow (`hsl(48, 96%, 50%)`).
  - *Error*: HSL Crimson (`hsl(0, 84%, 60%)`).
  - *Focus Indicator*: Ring outline (`2px solid hsl(38, 92%, 50%)`) with `offset-2`.

---

## 6. Photography & Imagery Rules
- **Travel Photography**: Never use generic, bright tourism stock photos. All images must be desaturated by `15%`, featuring warm, cinematic color grades (golden hour feel) and high shadow details.
- **Icon Sizes**: Standardized to `18px` for buttons, and `24px` for headers.

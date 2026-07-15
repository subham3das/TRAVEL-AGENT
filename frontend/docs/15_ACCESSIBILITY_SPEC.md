# Accessibility Specification - Travel Intelligence OS

This document outlines the accessibility compliance standards, keyboard accessibility schemas, and ARIA markup requirements for the Travel OS.

---

## 1. Compliance Level & Contrast
We commit to achieving **WCAG 2.1 Level AA** compliance across all workspaces.

- **Contrast Ratios**: 
  - Standard body text must maintain a minimum contrast ratio of `4.5:1` against the card background.
  - Large headings (Outfit size `>= 24px`) must remain above `3.0:1`.
- **Contrast Checkers**: Standard automated testing (e.g. `cypress-axe`) is configured on all merge requests.

---

## 2. Keyboard Navigation Schema
All interactive elements must support complete keyboard navigation:

- **Focus Ring Style**: Focused components must display a clear focus ring matching the primary amber color:
  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`.
- **Keyboard Tab Order**:
  1. Main Navigation Sidebar controls.
  2. Chat Input field and action buttons.
  3. Chronological timeline list cards.
  4. Budget summary panel selectors.
- **Escape Key Control**: Tapping `Escape` closes any expanded detail card or settings overlay instantly.

---

## 3. ARIA & Screen Reader Standards
All custom components must declare descriptive ARIA roles and labels:

- **Timeline Slots**: Each slot card declares:
  `aria-label="Activity slot: Baga Beach. Scheduled for 09:00 AM - 12:00 PM"`
- **Streaming Explainers**: The streaming container uses the `aria-live="polite"` attribute to announce newly arrived tokens without interrupting screen reader focus.
- **Visual-only Images**: Decorator imagery or desaturated photography details carry an empty `alt=""` attribute to prevent screen reader noise.

---

## 4. Mobile & Touch Screen targets
- **Touch Target Size**: Interactive buttons, swap icons, and timeline links must have a minimum target size of `44px` x `44px` on mobile layouts.
- **Dampened Motion support**: The application reads `prefers-reduced-motion: reduce`. When active, all sliding panel transitions and staggers are disabled, reverting transitions to instant fades.

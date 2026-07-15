# Design Tokens - Travel Intelligence OS

This document provides the complete key-value dictionary for design tokens inside the Travel Intelligence OS.

---

## 1. Color Tokens
All values are HSL-coded for ease of opacity styling.

### Theme Neutrals
- `color-bg-dark`: `240 10% 4%` (Dark base background)
- `color-bg-light`: `0 0% 98%` (Light base background)
- `color-fg-dark`: `0 0% 98%` (High contrast text in dark mode)
- `color-fg-light`: `240 10% 4%` (High contrast text in light mode)
- `color-card-dark`: `240 6% 7%` (Elevated card background)
- `color-card-light`: `0 0% 100%` (Card background in light mode)
- `color-border-dark`: `240 5% 12%` (Card & divider lines)
- `color-border-light`: `240 5% 90%` (Divider lines in light mode)

### Accent & Branding Colors
- `color-primary-amber`: `38 92% 50%` (Warm sun/exploration gold)
- `color-accent-teal`: `198 80% 45%` (Deep water/ocean teal)
- `color-accent-blue`: `217 91% 60%` (Clean transport/air sky)

### Status Indicators
- `color-status-success`: `142 70% 45%` (Verified bookings, green)
- `color-status-warning`: `48 96% 50%` (Near budget limits, yellow)
- `color-status-error`: `0 84% 60%` (Failed operations, crimson)

---

## 2. Spacing Scale (8pt Grid)
- `space-1`: `8px`
- `space-2`: `16px`
- `space-3`: `24px`
- `space-4`: `32px`
- `space-5`: `48px`
- `space-6`: `64px`

---

## 3. Shapes & Borders
- `radius-sm`: `4px` (Tags, badges, simple buttons)
- `radius-md`: `8px` (Dropdown selectors, inputs, textareas)
- `radius-lg`: `12px` (Itinerary day blocks, chat bubbles, drawers)
- `border-thin`: `1px` (Card borders, panel separators)
- `border-medium`: `2px` (Focus rings, active selections)

---

## 4. Typography Scale

### Font Families
- `font-header`: `Outfit, sans-serif`
- `font-body`: `Inter, sans-serif`

### Size Scales
- `size-display`: `48px`
- `size-h1`: `32px`
- `size-h2`: `20px`
- `size-body-large`: `16px`
- `size-body-small`: `14px`
- `size-caption`: `12px`

---

## 5. Elevation & Effects
- `opacity-muted`: `0.65` (Disabled text, helper titles)
- `opacity-subtle`: `0.4` (Background overlay masks)
- `blur-sm`: `4px` (Dropdown menus backdrop filter)
- `blur-md`: `8px` (Navigation panel backdrop filter)
- `shadow-none`: `none` (No shadows on cards, contrast achieved by borders)

---

## 6. Motion & Transitions
- `duration-fast`: `150ms` (Interactive hover states)
- `duration-normal`: `300ms` (Transitions, layout swaps)
- `duration-slow`: `500ms` (Cinematic onboarding entries)

---

## 7. Responsive Breakpoints
- `breakpoint-mobile`: `768px`
- `breakpoint-tablet`: `1024px`
- `breakpoint-desktop`: `1440px`

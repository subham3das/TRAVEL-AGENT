# Theme System Specification - Travel Intelligence OS

This document details the color variable maps, dark/light theme configurations, and WCAG contrast rules for the Travel OS.

---

## 1. HSL CSS Token Declarations

All color variables are declared in HSL values to allow dynamic alpha adjustments (e.g. transparent overlays):

```css
@theme {
  --background: var(--bg);
  --foreground: var(--fg);
  --card: var(--card-bg);
  --border: var(--border-color);
  --primary: var(--primary-color);
  --accent: var(--accent-color);
  --muted: var(--muted-color);
}

:root {
  /* Light Mode Variables */
  --bg: 0 0% 98%;
  --fg: 240 10% 4%;
  --card-bg: 0 0% 100%;
  --border-color: 240 5% 90%;
  --primary-color: 38 92% 45%;
  --accent-color: 198 80% 40%;
  --muted-color: 240 5% 45%;
}

.dark {
  /* Dark Mode Variables */
  --bg: 240 10% 4%;
  --fg: 0 0% 98%;
  --card-bg: 240 6% 7%;
  --border-color: 240 5% 12%;
  --primary-color: 38 92% 50%;
  --accent-color: 198 80% 45%;
  --muted-color: 240 5% 65%;
}
```

---

## 2. Responsive Theme Adaptations

### Mobile Layout (390px)
- **High-contrast Boundaries**: Mobile screens lack spacing depth. Borders (`border-border`) must render as solid `#1e1e24` (dark mode) / `#e4e4e9` (light mode) to separate cards cleanly under outdoor lighting conditions.
- **Backdrop Filters Override**: Backdrop blurs (`backdrop-filter`) are simplified to solid card background colors to reduce CPU overhead.

### Tablet Layout (768px)
- **Overlay Opacity**: Sheet overlay overlays use a darker alpha (`0.6`) mask to isolate focus.

### Desktop Layout (1280px+)
- **Refined Gradients**: Permits subtle background glowing radial highlights under map panels to indicate focus.

---

## 3. Contrast & Accessibility Verification
- **Minimum Contrast ratio**: Body text must maintain a contrast ratio of `4.5:1` against cards. Larger titles (sizes `>= 24px`) must remain above `3.0:1`.
- **Keyboard Selection**: When focused, custom controls display a high-contrast focus ring:
  `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`.
- **No Reliance on Color Alone**: Warning indicators (e.g. budget exceed alerts) must display text/icons (e.g., `⚠️ Over Budget`) alongside the yellow status color.

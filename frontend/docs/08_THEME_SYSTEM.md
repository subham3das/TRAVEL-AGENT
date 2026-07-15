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

## 2. Utility Class Mapping

We enforce strict visual mapping rules:

- **Surface Base**: `bg-background` (obsidian/pearl).
- **Surface Elevation 1**: `bg-card` (deep slate/pure white).
- **Surface Elevation 2**: `bg-muted` or `hover:bg-muted` (dark slate highlights).
- **Borders**: `border-border` (`1px` width).
- **Accents**: `text-primary` for action triggers, and `text-accent` for destinations and navigation indicators.

---

## 3. Contrast & Accessibility Verification
- **Minimum Contrast ratio**: Body text must maintain a contrast ratio of `4.5:1` against cards. Larger titles (sizes `>= 24px`) must remain above `3.0:1`.
- **Keyboard Selection**: When focused, custom controls display a high-contrast focus ring:
  `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`.
- **No Reliance on Color Alone**: Warning indicators (e.g. budget exceed alerts) must display text/icons (e.g., `⚠️ Over Budget`) alongside the yellow status color.

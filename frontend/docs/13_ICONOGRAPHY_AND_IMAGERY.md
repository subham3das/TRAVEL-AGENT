# Iconography and Imagery - Travel Intelligence OS

This document outlines the icon families, stroke styling, maps rendering guides, and image filters for the Travel OS.

---

## 1. Icon Selection Rules
- **One Icon Family**: We enforce the use of **Feather Icons** or **Lucide Icons** exclusively. Mixing icons from Lucide with Material Icons, FontAwesome, or custom SVGs is strictly prohibited.
- **Stroke Width**: All icons must use a consistent stroke width:
  - Default state: `1.5px` (clean, thin visual profile).
  - Hover/Selected state: `2.0px`.
- **Sizes**:
  - Tiny (within inline text/tags): `14px` x `14px`.
  - Normal (within buttons/slots): `18px` x `18px`.
  - Large (headers/navigation keys): `24px` x `24px`.

---

## 2. Illustration Guidelines
- **No Cliché Cartoon Graphics**: Travel OS does not contain cartoons, flat airplanes, suitcases, or passport graphics.
- **Abstract Geometry**: If illustrations are required (e.g. empty states, error sheets), use thin, wireframe abstract geometries, coordinate grids, or maps topologies instead.
- **SVG Format Only**: All assets must be inline SVGs to ensure crisp rendering at any display resolution.

---

## 3. Travel & Destination Photography Rules
- **Color Grading**: All photos must use a muted, slightly desaturated, cinematic warm color grade. Highly saturated, neon blue, or commercial postcard imagery is forbidden.
- **Desaturation**: Images must carry a default `15%` desaturation filter:
  `filter: grayscale(15%) contrast(105%) brightness(95%)`.
- **Loading Phase**: When images are loading, they must render inside a solid Deep Slate card container (`hsl(240, 6%, 7%)`) utilizing a pulsing opacity shimmer.

---

## 4. Vector Map Styles
- **Tile Styling**: Maps use a custom dark vector theme (`CartoDB DarkMatter` or custom Mapbox style) to match the Obsidian background.
- **Marker Elements**:
  - *Stays*: A circle marker with a small home icon in warm gold.
  - *Activities*: A small pin marker in teal.
  - *Route Lines*: Polylines connecting locations must use a dashed, semi-transparent warm gold line (`stroke-dasharray="4, 4"`).

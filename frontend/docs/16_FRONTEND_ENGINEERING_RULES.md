# Frontend Engineering Rules - Travel Intelligence OS

This document defines the code standards, naming conventions, component design principles, and responsive performance targets for the Travel OS frontend.

---

## 1. Component Rules & Composition Pattern
- **Presentational Component Purity**: All components under `components/` must remain pure presentational elements. They receive data through props and emit mutations via handlers. Importing Zustand stores inside `components/` is strictly prohibited.
- **No Prop Drilling**: Prop drilling beyond `2` levels deep is forbidden. Use Zustand hooks or React context for deep state management.
- **Composition over Inheritance**: Build complex interfaces by wrapping simple UI components (e.g. `<Dialog>` containing custom `<ItinerarySummary>` cards).

---

## 2. Naming Conventions

We enforce a consistent capitalization model:

- **Folders**: Lowercase-first, dash-separated (e.g., `components/itinerary/`, `store/`).
- **Files & Components**: PascalCase for React components (e.g., `SlotCard.tsx`), camelCase for hooks and store hooks (e.g., `useChatStore.js`, `useKeyboard.js`).
- **CSS Classes**: Strict Tailwind usage. Custom CSS declarations are mapped inside HSL theme tokens in `globals.css`.

---

## 3. State & API Integration Rules
- **Stateless API Routes**: Next.js API routes are only responsible for mapping client parameters to the backend engine. They must not contain business or database query logic.
- **Payload Validation**: All payloads sent to API routes must carry explicit client schema validation.
- **Zustand Store Seclusion**: Stores should avoid holding duplicate context fields. The `ContextStore` contains the canonical `TravelContext` object.

---

## 4. Responsive & Device Performance Rules

### Mobile Layout (390px)
- **Minimum Hydration Cost**: Component nodes must be kept simple. Do not initialize heavy map scripts or SVG graphs on initial page load; lazy load them using React Dynamic.
- **Render Throttling**: Limit concurrent element updates. Debounce range sliders by `150ms` on mobile drag states to avoid main-thread freeze.

### Tablet Layout (768px)
- **Standard re-renders limits**: Debounce sliders by `50ms`.

### Desktop Layout (1280px+)
- **Virtualization Required**: Timelines exceeding 7 days must virtualize lists using `react-window` to minimize DOM nodes.

---

## 5. Performance Targets & Testing
- **Lighthouse Scores**: All core planning workspaces must maintain a minimum Lighthouse performance score of `90`.
- **Image Optimization**: All photos must render via Next.js `<Image />` with defined layout sizes.
- **Testing Requirements**:
  - Critical workflows (e.g. chat entry, budget adjustment) must include E2E tests (`Cypress` or `Playwright`).
  - Zustand state modifications must carry unit tests (`Jest` or `Vitest`).

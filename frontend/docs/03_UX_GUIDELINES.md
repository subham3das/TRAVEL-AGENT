# UX Guidelines - Travel Intelligence OS

This document details the user experience philosophy, interaction paradigms, and flows for the Travel Intelligence OS.

---

## 1. Journey & AI Conversation Philosophy
- **The Journey Begins in the App**: We treat planning as part of the travel experience. The interface should feel calm, fluid, and structured.
- **AI as a Silent Navigator**: The AI handles the heavy calculations (budgets, routes, schedules) in the background. It does not speak in paragraphs; it replies with short, helpful explanations and updates the visual workspace.

---

## 2. Information Hierarchy & progressive Disclosure
- **Avoid Cognitive Overload**: Never present the entire trip's details (full address, check-in rules, restaurant menus) at once.
- **Progressive Disclosure Pattern**:
  1. *High-level timeline*: Displays day headers and slot names.
  2. *Interactive hover/click*: Clicking a slot slides open a right-hand sheet showing reviews, contact numbers, and coordinate highlights on the map.
  3. *Expanded inspection*: Deeper details (booking slips, tickets) are accessed inside overlay cards.

---

## 3. Interaction Flows

### Clarification Flow
1. If the user query is missing mandatory entities (e.g. `destination` or `durationDays`), the **Clarification Engine** intercepts.
2. Instead of popping up a blocking dialog, a **Clarification Card** is injected directly into the chat stream.
3. The card displays quick-select pill options. Selecting a pill updates the state and unlocks the planning pipeline.

### Editing & Modification Flow
- **Direct Selection**: Any slot can be selected to change it.
- **Regenerate Slot**: Tapping the "swap" icon prompts the engine to query replacement options. Selecting a new option immediately recalculates budget totals and updates transit times.
- **Undo Action**: Tapping `Ctrl+Z` or clicking the "Undo" notification banner immediately reverts the state to the previous TravelContext snapshot.

### Booking Flow
1. Once an itinerary is finalized, a "Book Trip" button appears at the top.
2. Clicking this slides in a booking sheet. Stays, local transport, and flights are itemized.
3. User selects "Confirm Booking". The system animates a loading checkmark, then displays a consolidated confirmation screen with printable PDFs.

---

## 4. Trust & System Feedback
- **System Integrity Logs**: During calculations, show the active step the system is executing (e.g., `[Optimizer] Finding optimal route from Baga Beach to Panaji...`).
- **Memory indicators**: When the user states a preference (e.g. "I prefer vegetarian food"), a small badge floats into the "Travel Profile" sidebar, showing that the system has permanently saved this preference.

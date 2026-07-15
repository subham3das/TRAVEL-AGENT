# Copywriting Guidelines - Travel Intelligence OS

This document details the copywriting standards, voice tone definitions, microcopy structures, and error messaging formats for the Travel OS.

---

## 1. Brand Voice & Tone
- **Voice**: Expert, travel-native, minimal, and calm.
- **Tone**: Professional and encouraging. It speaks like a luxury travel guide, never using slang, casual emojis (e.g. `✈️`, `🌍`), or verbose introductions.
- **AI Personality Constraints**: The system never uses introductory fluff (e.g. `Sure! I'd be happy to help you plan that trip. Let me compile some options for you...`). It jumps straight to the data and reports the plan status: `Plan complete for Goa. 5 days structured.`

---

## 2. Microcopy & Button Labels
- **Inputs Placeholders**:
  - *Standard*: `Where would you like to travel next?`
  - *Contextual*: `Specify date or travel style...`
- **Button Labels**: We use active, verb-first, lowercase-first UI labels (except first letter capitalized):
  - *Accept*: `Generate itinerary`
  - *Swap*: `Swap accommodation`
  - *Confirm*: `Confirm booking`

---

## 3. System Messaging Scripts

### Loading State Messages
During calculations, the loader cycles through descriptive, programmatic updates:
- `[System] Scanning destination attractions...`
- `[System] Allocating budget against hotel pricing...`
- `[System] Generating route polylines...`

### Error Messages
All error notifications must state what went wrong, and the immediate corrective action available:
- *Failed API*: `Plan could not be generated. Please check your internet connection and try again.`
- *Over Budget Warning*: `Selected hotel exceeds budget by INR 4,500. Swap hotel or increase budget limit.`

### Clarification Prompts
Proposals for missing entities must be explicit and direct:
- `Select travelers group configuration to finalize planning:`
- `Provide start date to calculate weather profiles:`

---

## 4. Confirmation & Success Cards
Upon successful action resolution, show concise status summaries:
- `Itinerary saved to your workspace profile.`
- `Booking complete. Tickets and vouchers are attached.`

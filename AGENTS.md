# Travel Intelligence OS - Project Rules

## Identity

This project is NOT a chatbot.
This project is NOT an LLM wrapper.

We are building an AI-powered Travel Intelligence Platform whose competitive advantage comes from deterministic planning, structured travel knowledge, and intelligent software engineering.

---

## Architecture Rules

Never redesign the architecture unless explicitly instructed.

Never rename folders, files, modules, or interfaces.

Implement only the requested module.

Keep all modules independent and follow the Single Responsibility Principle.

---

## LLM Rules

Gemini is ONLY responsible for:

- Understanding natural language
- Reasoning over structured data
- Explaining recommendations
- Answering follow-up questions

Gemini must NEVER:

- Calculate budgets
- Optimize routes
- Rank hotels
- Decide itineraries
- Perform business logic

Business logic must always be deterministic.

---

## Engineering Rules

Always write production-quality JavaScript.

Keep code modular.

Avoid duplicate logic.

Handle errors gracefully.

Write reusable functions.

Use meaningful names.

Never create unnecessary abstractions.

---

## Response Contract

Every engine must return:

{
  success,
  data,
  errors,
  warnings,
  confidence,
  processingTime,
  metadata
}

Never invent different response formats.

---

## Development Rules

Do not change architecture automatically.

Do not add features that were not requested.

Do not simplify or restructure the project.

If a better approach exists, explain it first instead of implementing it automatically.

---

## Project Goal

Our objective is to build a Travel Intelligence Engine that creates better travel plans than ChatGPT, Gemini, Google Maps, or existing travel apps.

Every implementation must strengthen this objective.
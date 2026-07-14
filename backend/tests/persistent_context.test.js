const assert = require("assert").strict;
const knowledgeService = require("../knowledge/knowledge_service.js");

// Initialize Knowledge Graph
knowledgeService.loadKnowledge();

process.env.GEMINI_API_KEY = "mock-key";

async function run() {
  console.log("=== STARTING PERSISTENT CONTEXT TEST ===");

  const { default: adapter } = await import("../llm/llm_adapter.js");
  const { default: registry } = await import("../llm/provider_registry.js");

  const geminiProvider = registry.get("gemini");

  // Stub provider client to simulate dynamic turns:
  // Turn 1: plan_trip Goa 5 days
  // Turn 2: clarification response "starting 20 August"
  // Turn 3: general chat question "is it raining?"
  let currentTurn = 1;
  const mockModel = {
    async generateContent(req) {
      if (req.config?.tools) {
        if (currentTurn === 1) {
          return {
            functionCalls: [
              {
                name: "plan_trip",
                args: { destination: "goa", durationDays: 5 }
              }
            ]
          };
        } else {
          // Turn 2 and 3 do not request tools natively
          return { functionCalls: null };
        }
      }

      // JSON parsing or summary responses
      if (req.config?.responseMimeType === "application/json") {
        if (req.contents.includes("clarification on: 'travelDates'")) {
          return {
            text: JSON.stringify({ value: { startDate: "2026-08-20" } })
          };
        }
      }

      if (currentTurn === 3) {
        return {
          text: "Mocked weather response directly from LLM."
        };
      }

      return {
        text: "Mocked trip summary response."
      };
    }
  };

  geminiProvider.client = {
    models: mockModel
  };

  let activeContext = null;

  // Turn 1: Plan Goa 5 days
  console.log("\n--- TURN 1: Plan Goa 5 days ---");
  let res = await adapter.processNaturalLanguage("Plan me a 5 day Goa trip.", activeContext);
  assert.ok(res.success);
  assert.strictEqual(res.data.toolRequested, "plan_trip");
  assert.ok(res.data.text.includes("Clarification Engine blocked execution"));
  assert.ok(res.metadata.activeContext);
  
  activeContext = res.metadata.activeContext;
  assert.strictEqual(activeContext.state.normalizedEntities.destination, "goa");
  assert.strictEqual(activeContext.state.normalizedEntities.durationDays, 5);
  assert.strictEqual(activeContext.state.normalizedEntities.travelDates, null);

  // Turn 2: Provide date clarification
  currentTurn = 2;
  console.log("\n--- TURN 2: Provide date clarification ---");
  res = await adapter.processNaturalLanguage("starting 20 August", activeContext);
  assert.ok(res.success);
  assert.strictEqual(res.data.toolRequested, "clarification_resolve");
  
  activeContext = res.metadata.activeContext;
  assert.strictEqual(activeContext.state.normalizedEntities.destination, "goa");
  assert.strictEqual(activeContext.state.normalizedEntities.durationDays, 5);
  // Verify date clarification was correctly merged into active context!
  assert.ok(activeContext.state.normalizedEntities.travelDates);
  assert.strictEqual(activeContext.state.normalizedEntities.travelDates.startDate, "2026-08-20");

  // Turn 3: Ask general weather question (LLM Chat Bypass)
  currentTurn = 3;
  console.log("\n--- TURN 3: Ask general weather question ---");
  res = await adapter.processNaturalLanguage("What is the weather like there?", activeContext);
  assert.ok(res.success);
  assert.strictEqual(res.data.toolRequested, null);
  assert.strictEqual(res.data.text, "Mocked weather response directly from LLM.");
  assert.strictEqual(res.data.executionSummary, "Answered directly by LLM.");

  console.log("\n=== ALL PERSISTENT CONTEXT TESTS PASSED ===");
}

run().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

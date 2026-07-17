const assert = require("assert").strict;
const knowledgeService = require("../knowledge/knowledge_service.js");

// Initialize Knowledge cache for underlying trip planning engine calls
knowledgeService.loadKnowledge();

// Set dummy API key for testing
process.env.GEMINI_API_KEY = "mock-key";

async function runAll() {
  console.log("=== STARTING LLM ADAPTER E2E MOCK TESTS ===");

  // Dynamic imports for the ES modules
  const { default: adapter } = await import("../llm/llm_adapter.js");
  const { default: registry } = await import("../llm/provider_registry.js");
  const { default: BaseLLMProvider } = await import("../llm/providers/base_provider.js");
  const { default: GeminiProvider } = await import("../llm/providers/gemini_provider.js");
  const { default: config } = await import("../config/llm.config.js");

  const geminiProvider = registry.get("gemini");

  // Inject mock client to simulate official Google SDK responses deterministically
  const mockModel = {
    async generateContent(req, opts) {
      await new Promise(resolve => setTimeout(resolve, 10));

      if (opts && opts.signal && opts.signal.aborted) {
        const err = new Error("Aborted");
        err.name = "AbortError";
        throw err;
      }
      
      if (req.contents === "trigger-empty") {
        return { text: "" };
      }

      if (req.config?.tools) {
        return {
          functionCalls: [
            {
              name: "plan_trip",
              args: { 
                destination: "goa", 
                durationDays: 3, 
                travelStyle: "budget",
                travelersType: "solo",
                startDate: "2026-07-15"
              }
            }
          ]
        };
      }

      const isJson = req.config?.responseMimeType === "application/json";
      return {
        text: isJson 
          ? '{"destination": "goa", "durationDays": 3, "travelStyle": "budget"}' 
          : "Mocked natural language trip explanation."
      };
    },
    
    async generateContentStream() {
      return [
        { text: "Gemini" },
        { text: " stream" },
        { text: " output" }
      ];
    }
  };

  geminiProvider.client = {
    models: mockModel
  };

  // 1. Registry
  console.log("Running Test: Provider Registry...");
  const gemini = registry.get("gemini");
  assert.ok(gemini);
  assert.strictEqual(gemini.constructor.name, "GeminiProvider");

  class DummyProvider extends BaseLLMProvider {
    async healthCheck() { return { success: true }; }
  }
  registry.register("dummy", new DummyProvider());
  const dummy = registry.get("dummy");
  assert.strictEqual(dummy.constructor.name, "DummyProvider");
  console.log("  => Provider Registry passed!");

  // 2. Invalid Provider
  console.log("Running Test: Invalid Provider...");
  assert.throws(() => registry.get("non-existent"), /Unregistered LLM provider/);
  console.log("  => Invalid Provider passed!");

  // 3. Missing Key
  console.log("Running Test: Missing API Key...");
  const oldKey = process.env.GEMINI_API_KEY;
  const oldConfigKey = config.apiKey;
  delete process.env.GEMINI_API_KEY;
  config.apiKey = null;
  
  const prov = new GeminiProvider();
  let res = await prov.initialize();
  assert.strictEqual(res.success, false);
  assert.ok(res.errors[0].includes("Missing API key"));

  process.env.GEMINI_API_KEY = oldKey;
  config.apiKey = oldConfigKey;
  console.log("  => Missing API Key passed!");

  // 4. Invalid Credentials
  console.log("Running Test: Invalid Credentials...");
  const oldKey2 = process.env.GEMINI_API_KEY;
  const oldConfigKey2 = config.apiKey;
  process.env.GEMINI_API_KEY = "invalid-key";
  config.apiKey = "invalid-key";

  const prov2 = new GeminiProvider();
  res = await prov2.initialize();
  assert.strictEqual(res.success, false);
  assert.ok(res.errors[0].includes("Invalid API key"));

  process.env.GEMINI_API_KEY = oldKey2;
  config.apiKey = oldConfigKey2;
  console.log("  => Invalid Credentials passed!");

  // 5. Normal Gen
  console.log("Running Test: Gemini Normal Generation...");
  res = await adapter.generate("Hello", {}, "gemini");
  assert.ok(res.success);
  assert.strictEqual(res.data.text, "Mocked natural language trip explanation.");
  assert.strictEqual(res.metadata.provider, "gemini");
  console.log("  => Gemini Normal Generation passed!");

  // 6. JSON
  console.log("Running Test: Structured JSON Parsing...");
  res = await adapter.generate("Convert to JSON", { responseFormat: "json" }, "gemini");
  assert.ok(res.success);
  const parsed = JSON.parse(res.data.text);
  assert.strictEqual(parsed.destination, "goa");
  assert.strictEqual(parsed.durationDays, 3);
  console.log("  => Structured JSON Parsing passed!");

  // 7. Timeout
  console.log("Running Test: Timeout Handling...");
  res = await adapter.generate("Hello", { timeout: 1 }, "gemini");
  assert.strictEqual(res.success, false);
  assert.ok(res.errors[0].includes("Request timeout exceeded"));
  console.log("  => Timeout Handling passed!");

  // 8. Empty
  console.log("Running Test: Empty Response Handling...");
  res = await adapter.generate("trigger-empty", {}, "gemini");
  assert.strictEqual(res.success, false);
  assert.ok(res.errors[0].includes("Empty response returned"));
  console.log("  => Empty Response Handling passed!");

  // 9. Stream
  console.log("Running Test: Streaming Interface...");
  const output = [];
  await adapter.stream("Hello stream", {}, (chunk) => {
    output.push(chunk.text);
  }, "gemini");
  assert.strictEqual(output.join(""), "Gemini stream output");
  console.log("  => Streaming Interface passed!");

  // 10. Health check
  console.log("Running Test: Health Check...");
  const originalGenerate = geminiProvider.generate;
  geminiProvider.generate = async () => ({
    success: true,
    data: { text: "OK" }
  });
  res = await adapter.healthCheck("gemini");
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.active, true);
  geminiProvider.generate = originalGenerate;
  console.log("  => Health Check passed!");

  // 11. Orchestration
  console.log("Running Test: Orchestration Pipeline (processNaturalLanguage)...");
  res = await adapter.processNaturalLanguage("I want to plan a 3-day budget trip to Goa", {
    state: {
      normalizedEntities: {
        travelDates: { startDate: "2026-07-15" },
        travelersType: "solo"
      },
      conversationState: { currentState: "IDLE" },
      entityConfidence: { travelDates: 1.0, travelersType: 1.0 }
    }
  });
  assert.ok(res.success);
  assert.strictEqual(res.data.toolRequested, "plan_trip");
  assert.strictEqual(res.data.toolArguments.destination, "goa");
  assert.ok(res.data.text.length > 0, "Trip summary text should not be empty");
  // ponytail: template renderer produces markdown, not LLM mock text
  assert.ok(res.data.text.includes("Trip") || res.data.text.includes("Goa") || res.data.text.includes("Day") || res.data.text.includes("planned"), `Summary should reference trip: ${res.data.text.substring(0, 80)}`);
  assert.ok(res.data.backendOutput.tripSummary);
  console.log("  => Orchestration Pipeline passed!");

  console.log("\n=== ALL LLM ADAPTER TESTS PASSED ===");
}

runAll().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

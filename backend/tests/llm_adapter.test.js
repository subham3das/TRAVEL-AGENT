const assert = require("assert").strict;

// Set dummy API key for testing
process.env.GEMINI_API_KEY = "mock-key";

const adapter = require("../llm/llm_adapter");
const registry = require("../llm/provider_registry");
const BaseLLMProvider = require("../llm/providers/base_provider");

const geminiProvider = registry.get("gemini");

// Inject mock client to simulate official Google SDK responses deterministically
const mockModel = {
  async generateContent(req, opts) {
    // Small delay to allow AbortSignal timeout to fire in event loop
    await new Promise(resolve => setTimeout(resolve, 10));

    if (opts && opts.signal && opts.signal.aborted) {
      const err = new Error("Aborted");
      err.name = "AbortError";
      throw err;
    }
    
    // Simulate empty response case
    if (req.contents?.[0]?.parts?.[0]?.text === "trigger-empty") {
      return { response: { text: () => "" } };
    }

    const isJson = req.generationConfig?.responseMimeType === "application/json";
    return {
      response: {
        text: () => isJson 
          ? '{"destination": "goa", "durationDays": 3, "travelStyle": "budget"}' 
          : "Gemini response text"
      }
    };
  },
  
  async generateContentStream() {
    return {
      stream: [
        { text: () => "Gemini" },
        { text: () => " stream" },
        { text: () => " output" }
      ]
    };
  }
};

geminiProvider.client = {
  getGenerativeModel: () => mockModel
};

async function testProviderRegistry() {
  console.log("Running Test: Provider Registry...");
  const gemini = registry.get("gemini");
  assert.ok(gemini);
  assert.strictEqual(gemini.constructor.name, "GeminiProvider");

  class DummyProvider extends BaseLLMProvider {
    async healthCheck() { return true; }
  }
  registry.register("dummy", new DummyProvider());
  const dummy = registry.get("dummy");
  assert.strictEqual(dummy.constructor.name, "DummyProvider");
  console.log("  => Provider Registry passed!");
}

async function testInvalidProvider() {
  console.log("Running Test: Invalid Provider...");
  assert.throws(() => registry.get("non-existent"), /Unregistered LLM provider/);
  console.log("  => Invalid Provider passed!");
}

async function testMissingAPIKey() {
  console.log("Running Test: Missing API Key...");
  const oldKey = process.env.GEMINI_API_KEY;
  const config = require("../config/llm.config");
  const oldConfigKey = config.apiKey;
  
  delete process.env.GEMINI_API_KEY;
  config.apiKey = null;
  
  const GeminiProvider = require("../llm/providers/gemini_provider");
  const prov = new GeminiProvider();
  
  await assert.rejects(
    async () => await prov.initialize(),
    /Missing API key/
  );

  process.env.GEMINI_API_KEY = oldKey;
  config.apiKey = oldConfigKey;
  console.log("  => Missing API Key passed!");
}

async function testInvalidCredentials() {
  console.log("Running Test: Invalid Credentials...");
  const oldKey = process.env.GEMINI_API_KEY;
  const config = require("../config/llm.config");
  const oldConfigKey = config.apiKey;

  process.env.GEMINI_API_KEY = "invalid-key";
  config.apiKey = "invalid-key";

  const GeminiProvider = require("../llm/providers/gemini_provider");
  const prov = new GeminiProvider();

  await assert.rejects(
    async () => await prov.initialize(),
    /Invalid API key/
  );

  process.env.GEMINI_API_KEY = oldKey;
  config.apiKey = oldConfigKey;
  console.log("  => Invalid Credentials passed!");
}

async function testGeminiNormalGeneration() {
  console.log("Running Test: Gemini Normal Generation...");
  const res = await adapter.generate("Hello", {}, "gemini");
  
  assert.ok(res.success);
  assert.strictEqual(res.data.text, "Gemini response text");
  assert.strictEqual(res.metadata.provider, "gemini");
  console.log("  => Gemini Normal Generation passed!");
}

async function testStructuredJsonParsing() {
  console.log("Running Test: Structured JSON Parsing...");
  const res = await adapter.generate("Convert to JSON", { responseFormat: "json" }, "gemini");

  assert.ok(res.success);
  const parsed = JSON.parse(res.data.text);
  assert.strictEqual(parsed.destination, "goa");
  assert.strictEqual(parsed.durationDays, 3);
  console.log("  => Structured JSON Parsing passed!");
}

async function testTimeoutHandling() {
  console.log("Running Test: Timeout Handling...");
  const res = await adapter.generate("Hello", { timeout: 1 }, "gemini");
  assert.strictEqual(res.success, false);
  assert.ok(res.errors[0].includes("Timeout: stage exceeded limit"));
  console.log("  => Timeout Handling passed!");
}

async function testEmptyResponseHandling() {
  console.log("Running Test: Empty Response Handling...");
  const res = await adapter.generate("trigger-empty", {}, "gemini");
  assert.strictEqual(res.success, false);
  assert.ok(res.errors[0].includes("Empty response returned"));
  console.log("  => Empty Response Handling passed!");
}

async function testStreamingInterface() {
  console.log("Running Test: Streaming Interface...");
  const output = [];
  
  await adapter.stream("Hello stream", {}, (chunk) => {
    output.push(chunk.text);
  }, "gemini");

  assert.strictEqual(output.join(""), "Gemini stream output");
  console.log("  => Streaming Interface passed!");
}

async function testHealthCheck() {
  console.log("Running Test: Health Check...");
  const ok = await adapter.healthCheck("gemini");
  assert.strictEqual(ok, true);
  console.log("  => Health Check passed!");
}

async function runAll() {
  console.log("=== STARTING LLM ADAPTER E2E MOCK TESTS ===");
  await testProviderRegistry();
  await testInvalidProvider();
  await testMissingAPIKey();
  await testInvalidCredentials();
  await testGeminiNormalGeneration();
  await testStructuredJsonParsing();
  await testTimeoutHandling();
  await testEmptyResponseHandling();
  await testStreamingInterface();
  await testHealthCheck();
  console.log("\n=== ALL LLM ADAPTER TESTS PASSED ===");
}

runAll().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

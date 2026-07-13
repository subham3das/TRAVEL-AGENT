const assert = require("assert").strict;
const adapter = require("../llm/llm_adapter");
const registry = require("../llm/provider_registry");
const BaseLLMProvider = require("../llm/providers/base_provider");

async function testProviderRegistry() {
  console.log("Running Test: Provider Registry...");
  
  const gemini = registry.get("gemini");
  assert.ok(gemini);
  assert.strictEqual(gemini.constructor.name, "GeminiProvider");

  // Verify custom provider registration
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

async function testJsonRetryFailure() {
  console.log("Running Test: JSON Retry Failure...");
  
  // Register a failing provider that outputs invalid json
  class BrokenJsonProvider extends BaseLLMProvider {
    async initialize() { return true; }
    async generate() {
      return { success: true, text: "invalid-non-json-string" };
    }
    validateResponse() { return false; }
  }
  registry.register("broken-json", new BrokenJsonProvider());

  const res = await adapter.generate("Try", { responseFormat: "json" }, "broken-json");
  assert.strictEqual(res.success, false);
  assert.ok(res.errors[0].includes("Structured JSON response parsing failed"));
  console.log("  => JSON Retry Failure passed!");
}

async function testStreamingInterface() {
  console.log("Running Test: Streaming Interface...");
  const output = [];
  
  await adapter.stream("Hello stream", {}, (chunk) => {
    output.push(chunk.text);
  }, "gemini");

  // Output should match concatenated chunks
  assert.strictEqual(output.join(""), "Gemini stream output");
  console.log("  => Streaming Interface passed!");
}

async function testToolCalling() {
  console.log("Running Test: Tool Calling...");
  const res = await adapter.toolCall("Plan trip", [{ name: "processTravelRequest" }], "gemini");

  assert.ok(res.success);
  assert.strictEqual(res.data.toolRequested, "processTravelRequest");
  assert.strictEqual(res.data.arguments.destination, "goa");
  console.log("  => Tool Calling passed!");
}

async function testHealthCheck() {
  console.log("Running Test: Health Check...");
  const ok = await adapter.healthCheck("gemini");
  assert.strictEqual(ok, true);
  console.log("  => Health Check passed!");
}

async function runAll() {
  console.log("=== STARTING LLM ADAPTER TESTS ===");
  await testProviderRegistry();
  await testInvalidProvider();
  await testGeminiNormalGeneration();
  await testStructuredJsonParsing();
  await testJsonRetryFailure();
  await testStreamingInterface();
  await testToolCalling();
  await testHealthCheck();
  console.log("\n=== ALL LLM ADAPTER TESTS PASSED ===");
}

runAll().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

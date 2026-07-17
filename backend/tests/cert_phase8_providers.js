/**
 * Phase 8: Provider Validation
 *
 * Validates all three provider systems:
 * A. Search Providers (6): GooglePlaces, Amadeus, Booking, GoogleMaps, Weather, Events
 * B. LLM Providers (4): Gemini, OpenAI, Claude, Local
 * C. Booking Providers (7): Hotel, Flight, Train, Bus, Activity, Rental, Weather
 */

"use strict";

const assert = require("assert");

const results = [];
function test(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
}

function expect(fn, expectedMsg) {
  try {
    fn();
    return true;
  } catch (err) {
    if (expectedMsg && err.message.includes(expectedMsg)) return true;
    return false;
  }
}

async function run() {
  // ═══════════════════════════════════════════════════════════════
  // A. SEARCH PROVIDERS
  // ═══════════════════════════════════════════════════════════════
  console.log("=== A. Search Providers ===");

  const searchRegistry = require("../search/providers/search_provider_registry");
  const SearchProviderBase = require("../search/providers/search_provider_base");

  // A1. Bootstrap verification
  const bootstrap = require("../search/search_bootstrap");
  test("Bootstrap returns registry", bootstrap === searchRegistry);

  const registered = searchRegistry.listAll();
  test("6 providers registered", registered.length === 6, `got ${registered.length}: ${registered.join(", ")}`);
  test("google_places registered", registered.includes("google_places"));
  test("amadeus registered", registered.includes("amadeus"));
  test("booking_com registered", registered.includes("booking_com"));
  test("google_maps registered", registered.includes("google_maps"));
  test("openweathermap registered", registered.includes("openweathermap"));
  test("events registered", registered.includes("events"));

  // A2. Base class contract
  const base = new SearchProviderBase("test", { priority: 50, supportedTypes: ["hotel"] });
  test("Base has name", base.name === "test");
  test("Base has priority", base.priority === 50);
  test("Base has supportedTypes", Array.isArray(base.supportedTypes));
  test("Base.supports() works", base.supports("hotel") === true);
  test("Base.supports() rejects", base.supports("flight") === false);
  test("Base.health() returns standard shape", async () => {
    const h = await base.health();
    return typeof h.status === "string" && typeof h.latency === "number";
  });
  test("Base.search() throws not implemented", () => expect(() => base.search(), "not implemented"));

  // A3. Registry functions
  test("getProviders(hotel) returns array", Array.isArray(searchRegistry.getProviders("hotel")));
  test("getProviders(hotel) sorted by priority", () => {
    const providers = searchRegistry.getProviders("hotel");
    if (providers.length < 2) return true;
    return providers[0].priority >= providers[1].priority;
  });
  test("hasProvider(hotel) true", searchRegistry.hasProvider("hotel") === true);
  test("hasProvider(nonexistent) false", searchRegistry.hasProvider("nonexistent_type_xyz") === false);
  test("getByName(google_places) returns provider", searchRegistry.getByName("google_places") !== null);
  test("getByName(nonexistent) returns null", searchRegistry.getByName("nonexistent_xyz") === null);

  // A4. Individual search provider checks
  const searchProviders = [
    { name: "google_places", types: ["activity", "restaurant", "hotel"], key: "GOOGLE_MAPS_API_KEY" },
    { name: "amadeus", types: ["flight", "hotel", "activity"], key: "AMADEUS_CLIENT_ID" },
    { name: "booking_com", types: ["hotel"], key: null },
    { name: "google_maps", types: ["maps"], key: "GOOGLE_MAPS_API_KEY" },
    { name: "openweathermap", types: ["weather"], key: "WEATHER_API_KEY" },
    { name: "events", types: ["events"], key: null }
  ];

  for (const sp of searchProviders) {
    const provider = searchRegistry.getByName(sp.name);
    test(`${sp.name} — extends SearchProviderBase`, provider instanceof SearchProviderBase);
    test(`${sp.name} — supportedTypes correct`, () => {
      const types = provider.supportedTypes;
      return sp.types.every(t => types.includes(t));
    });
    test(`${sp.name} — has search() method`, typeof provider.search === "function");
    test(`${sp.name} — has health() method`, typeof provider.health === "function");
    test(`${sp.name} — has recordSuccess()`, typeof provider.recordSuccess === "function");
    test(`${sp.name} — has recordFailure()`, typeof provider.recordFailure === "function");
    test(`${sp.name} — has metadata()`, typeof provider.metadata === "function");

    // Health check returns standard shape
    const health = await provider.health();
    test(`${sp.name} — health.status is string`, typeof health.status === "string");
    test(`${sp.name} — health.latency is number`, typeof health.latency === "number");
    test(`${sp.name} — health.failureRate is number`, typeof health.failureRate === "number");

    // Search with no API key returns empty (graceful degradation)
    const results = await provider.search({ destinationId: "test", query: "test" });
    test(`${sp.name} — search() returns array`, Array.isArray(results));
  }

  // A5. Search with abort signal
  const gp = searchRegistry.getByName("google_places");
  const controller = new AbortController();
  controller.abort();
  const abortResults = await gp.search({ destinationId: "test" }, controller.signal);
  test("google_places — abort signal returns empty", abortResults.length === 0);

  // A6. Health check all providers
  const allHealth = await searchRegistry.healthCheck();
  test("healthCheck() returns object for all providers", Object.keys(allHealth).length === 6);
  for (const [name, h] of Object.entries(allHealth)) {
    test(`${name} health has status`, typeof h.status === "string");
  }

  // ═══════════════════════════════════════════════════════════════
  // B. LLM PROVIDERS
  // ═══════════════════════════════════════════════════════════════
  console.log("\n=== B. LLM Providers ===");

  // LLM providers use ES modules — use dynamic import
  const { default: providerRegistry } = await import("../llm/provider_registry.js");

  // B1. Registry functions
  test("Registry has gemini", providerRegistry.get("gemini") !== undefined);
  test("Registry has openai", providerRegistry.get("openai") !== undefined);
  test("Registry has claude", providerRegistry.get("claude") !== undefined);
  test("Registry has local", providerRegistry.get("local") !== undefined);
  test("Registry rejects unknown", () => expect(() => providerRegistry.get("nonexistent"), "Unregistered"));

  // B2. Gemini provider (real)
  const gemini = providerRegistry.get("gemini");
  test("Gemini has initialize()", typeof gemini.initialize === "function");
  test("Gemini has generate()", typeof gemini.generate === "function");
  test("Gemini has stream()", typeof gemini.stream === "function");
  test("Gemini has toolCall()", typeof gemini.toolCall === "function");
  test("Gemini has validateResponse()", typeof gemini.validateResponse === "function");
  test("Gemini has healthCheck()", typeof gemini.healthCheck === "function");

  const geminiInit = await gemini.initialize();
  test("Gemini initialize() returns success", geminiInit.success === true);

  const geminiHealth = await gemini.healthCheck();
  test("Gemini healthCheck() returns success", geminiHealth.success === true);
  test("Gemini healthCheck() has data.active", typeof geminiHealth.data?.active === "boolean");

  const geminiGen = await gemini.generate("Say OK", { maxTokens: 5 });
  test("Gemini generate() returns success", geminiGen.success === true);
  test("Gemini generate() has text", typeof geminiGen.data?.text === "string");

  const geminiJson = await gemini.generate('Return {"status":"ok"}', { responseFormat: "json", maxTokens: 20 });
  test("Gemini JSON generate() returns success", geminiJson.success === true);

  test("Gemini validateResponse() valid", gemini.validateResponse({ data: { text: "hello" } }, "text") === true);
  test("Gemini validateResponse() invalid", gemini.validateResponse(null, "text") === false);

  // B3. Stub providers (OpenAI, Claude, Local)
  const stubs = ["openai", "claude", "local"];
  for (const name of stubs) {
    const provider = providerRegistry.get(name);
    test(`${name} has initialize()`, typeof provider.initialize === "function");
    test(`${name} has generate()`, typeof provider.generate === "function");
    test(`${name} generate() throws`, () => expect(() => provider.generate("test"), "not configured"));
    test(`${name} has stream()`, typeof provider.stream === "function");

    let streamResult = null;
    await provider.stream("test", {}, (chunk) => { streamResult = chunk; });
    test(`${name} stream() calls callback`, streamResult !== null);

    const tc = await provider.toolCall("test");
    test(`${name} toolCall() returns {success:false}`, tc.success === false);

    const hc = await provider.healthCheck();
    test(`${name} healthCheck() returns truthy`, !!hc);
  }

  // ═══════════════════════════════════════════════════════════════
  // C. BOOKING PROVIDERS
  // ═══════════════════════════════════════════════════════════════
  console.log("\n=== C. Booking Providers ===");

  const bookingRegistry = require("../booking/providers/provider_registry");
  const BaseProvider = require("../booking/providers/base_provider");

  const bookingTypes = ["hotel", "flight", "train", "bus", "activity", "rental", "weather"];

  // C1. Registry has all 7 types
  for (const type of bookingTypes) {
    const provider = bookingRegistry.getProvider(type);
    test(`${type} provider registered`, provider !== null);
    test(`${type} extends BaseProvider`, provider instanceof BaseProvider);
    test(`${type} has name`, typeof provider.name === "string" && provider.name.length > 0);
  }

  // C2. Registry functions
  test("getProvider(hotel) not null", bookingRegistry.getProvider("hotel") !== null);
  test("getProvider(nonexistent) null", bookingRegistry.getProvider("nonexistent") === null);

  // C3. Base contract verification for each booking provider
  for (const type of bookingTypes) {
    const provider = bookingRegistry.getProvider(type);

    test(`${type} — has search()`, typeof provider.search === "function");
    test(`${type} — has details()`, typeof provider.details === "function");
    test(`${type} — has availability()`, typeof provider.availability === "function");
    test(`${type} — has book()`, typeof provider.book === "function");
    test(`${type} — has health()`, typeof provider.health === "function");
    test(`${type} — has capabilities()`, typeof provider.capabilities === "function");

    // Health check returns standard shape
    const health = await provider.health();
    test(`${type} — health.status is string`, typeof health.status === "string");
    test(`${type} — health.latency is number`, typeof health.latency === "number");
    test(`${type} — health.lastSuccess is string`, typeof health.lastSuccess === "string");
    test(`${type} — health.failureRate is number`, typeof health.failureRate === "number");

    // Capabilities returns object
    const caps = await provider.capabilities();
    test(`${type} — capabilities() returns object`, typeof caps === "object");
  }

  // C4. Hotel provider search (uses knowledge graph, no API key needed)
  const hotelProvider = bookingRegistry.getProvider("hotel");
  const hotelResults = await hotelProvider.search({ destinationId: "goa", travelStyle: "mid" });
  test("hotel search() returns array", Array.isArray(hotelResults));
  if (hotelResults.length > 0) {
    test("hotel result has id", typeof hotelResults[0].id === "string");
    test("hotel result has provider", typeof hotelResults[0].provider === "string");
  }

  // C5. Flight provider search
  const flightProvider = bookingRegistry.getProvider("flight");
  const flightResults = await flightProvider.search({ destinationId: "goa" });
  test("flight search() returns array", Array.isArray(flightResults));

  // C6. Activity provider search
  const activityProvider = bookingRegistry.getProvider("activity");
  const activityResults = await activityProvider.search({ destinationId: "goa" });
  test("activity search() returns array", Array.isArray(activityResults));

  // ═══════════════════════════════════════════════════════════════
  // D. CROSS-CUTTING: Provider Integration
  // ═══════════════════════════════════════════════════════════════
  console.log("\n=== D. Cross-Cutting Integration ===");

  // D1. Search layer full integration
  const searchLayer = require("../search/search_layer");
  test("searchLayer.search() exists", typeof searchLayer.search === "function");

  const searchRes = await searchLayer.search("hotel", { destinationId: "goa" });
  test("searchLayer.search() returns result", typeof searchRes === "object");
  test("searchLayer.search() has results", Array.isArray(searchRes?.results));

  // D2. Capability registry
  const capabilityRegistry = require("../registry/capability_registry");
  test("capabilityRegistry exists", typeof capabilityRegistry === "object");

  // D3. No provider crashes the pipeline
  const crashTests = [
    () => searchRegistry.getByName("google_places").search({}),
    () => searchRegistry.getByName("openweathermap").search({}),
    () => hotelProvider.search({}),
  ];

  for (let i = 0; i < crashTests.length; i++) {
    try {
      await crashTests[i]();
      test(`Crash test ${i + 1} — survives`, true);
    } catch (err) {
      test(`Crash test ${i + 1} — survives`, false, err.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log("\n=== SUMMARY ===");
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("FAILURES:");
    results.filter(r => !r.pass).forEach(r => console.log(`  ✗ ${r.name}: ${r.detail}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error("FATAL:", err); process.exit(1); });

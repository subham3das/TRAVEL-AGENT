/**
 * Phase 1: Startup Verification
 * Phase 2: API Verification
 * Phase 11: Response Contract Validation
 */

const BASE = "http://localhost:3001";

async function req(method, path, body = null, headers = {}) {
  const opts = { method, headers: { "Content-Type": "application/json", ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const start = Date.now();
  try {
    const r = await fetch(`${BASE}${path}`, opts);
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text, ms: Date.now() - start };
  } catch (err) {
    return { status: 0, error: err.message, ms: Date.now() - start };
  }
}

const results = [];
function test(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
}

async function run() {
  console.log("=== Phase 1: Startup Verification ===");
  
  const health = await req("GET", "/api/system/health");
  test("Backend responds", health.status === 200, `status=${health.status}`);
  test("Health status OK", health.json?.status === "ok" || health.json?.status === "degraded", `status=${health.json?.status}`);
  test("Knowledge Graph healthy", health.json?.services?.knowledgeGraph === "healthy");
  test("Gemini healthy", health.json?.services?.gemini === "healthy");
  
  const status = await req("GET", "/api/system/status");
  test("System status endpoint", status.status === 200);
  
  const metrics = await req("GET", "/api/system/metrics");
  test("Metrics endpoint", metrics.status === 200);
  test("Metrics has uptime", typeof metrics.json?.uptime === "string");
  
  const telemetry = await req("GET", "/api/system/telemetry");
  test("Telemetry endpoint", telemetry.status === 200);

  console.log("\n=== Phase 2: API Verification ===");
  
  // POST /api/chat — valid
  const chat1 = await req("POST", "/api/chat", { message: "Hello!" });
  test("POST /api/chat — greeting", chat1.status === 200);
  test("Response has success field", typeof chat1.json?.success === "boolean");
  test("Response time < 5000ms", chat1.ms < 5000, `${chat1.ms}ms`);
  
  // POST /api/chat — travel
  const chat2 = await req("POST", "/api/chat", { message: "Plan a trip to Goa" });
  test("POST /api/chat — travel", chat2.status === 200);
  test("Travel response has data", !!chat2.json?.data);
  
  // POST /api/chat — missing message
  const chat3 = await req("POST", "/api/chat", {});
  test("POST /api/chat — missing message returns 400", chat3.status === 400);
  
  // POST /api/chat — null body
  const chat4 = await req("POST", "/api/chat", null);
  test("POST /api/chat — null body handled", chat4.status === 400 || chat4.status === 500);
  
  // POST /api/chat — empty string
  const chat5 = await req("POST", "/api/chat", { message: "" });
  test("POST /api/chat — empty string", chat5.status === 400 || chat5.status === 200);
  
  // POST /api/chat — malformed
  const chat6 = await req("POST", "/api/chat", { message: null });
  test("POST /api/chat — null message", chat6.status === 400 || chat6.status === 200);
  
  // POST /api/chat-stream
  const stream = await req("POST", "/api/chat-stream", { message: "Hello" });
  test("POST /api/chat-stream", stream.status === 200);
  
  // POST /api/chat-stream — missing message
  const stream2 = await req("POST", "/api/chat-stream", {});
  test("POST /api/chat-stream — missing message", stream2.status === 200 || stream2.status === 400);
  
  // GET /api/system/health
  test("GET /api/system/health — 200", health.status === 200);
  test("Health has services object", typeof health.json?.services === "object");
  
  // GET /api/system/status
  test("GET /api/system/status — 200", status.status === 200);
  
  // GET /api/system/metrics
  test("GET /api/system/metrics — 200", metrics.status === 200);
  test("Metrics has requests field", typeof metrics.json?.requests === "number");
  
  // GET /api/system/telemetry
  test("GET /api/system/telemetry — 200", telemetry.status === 200);
  
  // POST /api/system/reset-usage (dev only)
  const reset = await req("POST", "/api/system/reset-usage");
  test("POST /api/system/reset-usage — dev mode", reset.status === 200);
  
  // Non-existent endpoint
  const notFound = await req("GET", "/api/nonexistent");
  test("404 for unknown endpoint", notFound.status === 404 || notFound.status === 400);
  
  // Oversized payload
  const bigMsg = "x".repeat(100000);
  const big = await req("POST", "/api/chat", { message: bigMsg });
  test("Oversized payload handled", big.status === 200 || big.status === 400 || big.status === 413);
  
  // Special characters
  const special = await req("POST", "/api/chat", { message: "!@#$%^&*()_+{}|:<>?" });
  test("Special characters", special.status === 200);
  
  // Unicode
  const unicode = await req("POST", "/api/chat", { message: "नमस्ते दिल्ली" });
  test("Unicode input", unicode.status === 200);
  
  // SQL injection
  const sql = await req("POST", "/api/chat", { message: "'; DROP TABLE users; --" });
  test("SQL injection attempt", sql.status === 200);
  
  // XSS
  const xss = await req("POST", "/api/chat", { message: "<script>alert('xss')</script>" });
  test("XSS attempt", xss.status === 200);
  
  console.log("\n=== Phase 11: Response Contract Validation ===");
  
  // Validate contract of chat response
  const contract = await req("POST", "/api/chat", { message: "Hello!" });
  const c = contract.json;
  test("Has 'success' field", typeof c?.success === "boolean");
  test("Has 'data' field", typeof c?.data === "object");
  test("Has 'errors' field", Array.isArray(c?.errors));
  test("Has 'warnings' field", Array.isArray(c?.warnings));
  
  // Health contract
  const hc = health.json;
  test("Health has 'status'", typeof hc?.status === "string");
  test("Health has 'timestamp'", typeof hc?.timestamp === "string");
  test("Health has 'services'", typeof hc?.services === "object");
  
  // Metrics contract
  const mc = metrics.json;
  test("Metrics has 'requests'", typeof mc?.requests === "number");
  test("Metrics has 'uptime'", typeof mc?.uptime === "string");
  test("Metrics has 'provider'", typeof mc?.provider === "string");
  
  // Telemetry contract
  const tc = telemetry.json;
  test("Telemetry has 'dashboard'", typeof tc?.dashboard === "object");
  test("Telemetry has 'circuitBreaker'", typeof tc?.circuitBreaker === "object");
  test("Telemetry has 'cache'", typeof tc?.cache === "object");

  console.log("\n=== SUMMARY ===");
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("FAILURES:");
    results.filter(r => !r.pass).forEach(r => console.log(`  ✗ ${r.name}: ${r.detail}`));
  }
}

run().catch(err => { console.error("FATAL:", err); process.exit(1); });

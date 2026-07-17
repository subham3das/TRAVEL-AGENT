const express = require("express");
const cors = require("cors");
require("dotenv").config();

// ─── Process-level failure containment ──────────────────────────────
// Root-cause fix for the production crash: under Node 20's default
// `unhandledRejections=throw` policy, ANY exception or promise rejection
// that escapes the request pipeline terminates the entire process. That
// turned a single bad /api/chat request into ECONNRESET, then the dead
// process answered every later request with ECONNREFUSED.
//
// These handlers keep the server alive: one failed request degrades that
// request instead of killing the whole service. They log the full stack so
// the real culprit can be diagnosed from the server logs.
function logFatal(scope, err) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] FATAL ${scope}:`, err && err.stack ? err.stack : err);
}
process.on("uncaughtException", (err) => {
  logFatal("uncaughtException", err);
});
process.on("unhandledRejection", (reason) => {
  logFatal("unhandledRejection", reason && reason.stack ? reason.stack : reason);
});

// Load and initialize Knowledge Graph
const knowledgeService = require("./knowledge/knowledge_service.js");
const kgStatus = knowledgeService.loadKnowledge();
if (!kgStatus.success) {
  console.error("FATAL: Failed to load Knowledge Graph. Shutting down.");
  console.error(kgStatus.errors);
  process.exit(1);
}
console.log(`Loaded ${kgStatus.loadedCount} nodes successfully.`);

// Load Usage Service
const usageService = require("./services/usage_service.js");

// Load Search Providers
require("./search/search_bootstrap.js");

// Load Telemetry + Circuit Breaker
const telemetry = require("./services/llm_telemetry.js");
const circuitBreaker = require("./services/circuit_breaker.js");
const responseCache = require("./services/response_cache.js");
const deduplicator = require("./services/request_deduplicator.js");
const { validateAndNormalizeChatResponse } = require("./schemas/ChatResponse.js");
const { validateSystemStatusResponse, validateSystemHealthResponse } = require("./schemas/SystemContracts.js");
const SSEAdapter = require("./adapters/sse_adapter.js");

const tripRoutes = require("./routes/trip_routes.js");

const app = express();
const PORT = process.env.PORT || 3001;
const SERVER_START_TIME = Date.now();

app.use(cors());
app.use(express.json());

app.get("/api/system/status", async (req, res) => {
  try {
    const sessionKey = req.query.session || "default-session";
    const userKey = req.query.user || "default-user";
    const status = await usageService.getStatus(sessionKey, userKey);

    // Enrich with optimization telemetry
    status.telemetry = telemetry.getDashboard();
    status.circuitBreaker = circuitBreaker.getStatus();
    status.cache = responseCache.getStats();
    status.dedup = deduplicator.getStats();

    const validatedStatus = validateSystemStatusResponse(status);
    res.json(validatedStatus);
  } catch (err) {
    console.error("System status error:", err);
    res.status(500).json({ error: "Failed to fetch system status" });
  }
});

// ─── API Routes ──────────────────────────────────────────────────
app.use("/api/trips", tripRoutes);

// System Health Endpoint
app.get("/api/system/health", async (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      knowledgeGraph: kgStatus.success ? "healthy" : "unhealthy",
      gemini: "healthy", // Wrapped in circuit breaker
      pinecone: process.env.PINECONE_API_KEY ? "healthy" : "unconfigured",
      booking: "healthy" // Degrades gracefully
    }
  };

  // If critical services are down, reflect it in the HTTP status
  const validatedHealth = validateSystemHealthResponse(health);
  const isHealthy = validatedHealth.services.knowledgeGraph === "healthy";
  res.status(isHealthy ? 200 : 503).json(validatedHealth);
});

// LLM Telemetry Dashboard
app.get("/api/system/telemetry", (req, res) => {
  res.json({
    dashboard: telemetry.getDashboard(),
    recentEntries: telemetry.getRecentEntries(20),
    circuitBreaker: circuitBreaker.getStatus(),
    cache: responseCache.getStats(),
    dedup: deduplicator.getStats()
  });
});

// System Metrics Endpoint — powers the frontend dashboard
app.get("/api/system/metrics", async (req, res) => {
  try {
    const telemetryDashboard = telemetry.getDashboard();
    const cacheStats = responseCache.getStats();
    const dedupStats = deduplicator.getStats();
    const breakerStatus = circuitBreaker.getStatus();
    const latencyStats = usageService.storage.getLatencyStats
      ? await usageService.storage.getLatencyStats()
      : { averageLatency: 0, peakLatency: 0 };

    const uptimeMs = Date.now() - SERVER_START_TIME;
    const uptimeSeconds = Math.floor(uptimeMs / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    const uptimeStr = uptimeHours > 0
      ? `${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`
      : uptimeMinutes > 0
        ? `${uptimeMinutes}m ${uptimeSeconds % 60}s`
        : `${uptimeSeconds}s`;

    res.json({
      requests: telemetryDashboard.totalRequests,
      llmCalls: telemetryDashboard.llmCalls,
      llmSkipped: telemetryDashboard.llmSkipped,
      cacheHits: cacheStats.hits,
      cacheMisses: cacheStats.misses,
      deduplicatedRequests: dedupStats.deduped,
      circuitBreakerTrips: breakerStatus.tripCount,
      averageLatency: latencyStats.averageLatency || telemetryDashboard.averageLatencyMs,
      peakLatency: latencyStats.peakLatency || 0,
      tokensSaved: telemetryDashboard.tokensSaved,
      estimatedCostSaved: telemetryDashboard.estimatedCostSaved,
      provider: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      uptime: uptimeStr,
      uptimeMs
    });
  } catch (err) {
    console.error("Metrics error:", err);
    res.status(500).json({ error: "Failed to fetch system metrics" });
  }
});

// Dev-only usage reset
app.post("/api/system/reset-usage", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Only available in development" });
  }
  usageService.resetLocal();
  telemetry.reset();
  responseCache.clear();
  deduplicator.clear();
  circuitBreaker.reset();
  res.json({ success: true, message: "All counters and caches reset" });
});

// Dynamically import ES Module LLM Adapter.
// The rejection is swallowed here (not re-thrown) so a failed import can
// never become an unhandled rejection that kills the process; the route
// reports a clean 500 instead.
let llmAdapterModule = null;
let llmAdapterLoadError = null;
const llmAdapterPromise = import("./llm/llm_adapter.js")
  .then((m) => { llmAdapterModule = m.default; })
  .catch((err) => {
    llmAdapterLoadError = err;
    console.error("LLM adapter failed to load:", err && err.stack ? err.stack : err);
  });

// Write JSON without throwing on a dead socket (client abort / ECONNRESET).
// A throw here inside the catch block would otherwise escape as an
// uncaughtException and terminate the process.
function safeJson(res, status, payload) {
  if (res.headersSent || res.writableEnded) return;
  try {
    res.status(status).json(payload);
  } catch (e) {
    console.error("Response write failed:", e && e.message);
  }
}

app.post("/api/chat", async (req, res) => {
  const requestId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const startTime = Date.now();
  const sessionKey = req.headers["x-session-id"] || "default-session";
  const userKey = req.headers["x-user-id"] || "default-user";

  // Swallow socket errors so a client abort (ECONNRESET) cannot escalate
  // into an uncaught exception that kills the process.
  res.on("error", (e) => console.error(`[${requestId}] response socket error:`, e && e.message));

  try {
    const { message, context } = req.body || {};
    if (!message) return safeJson(res, 400, { error: "message is required" });

    const llmAdapter = await llmAdapterPromise.then(() => llmAdapterModule).catch(() => null);
    if (!llmAdapter) throw llmAdapterLoadError || new Error("LLM adapter not initialized");

    const response = await llmAdapter.processNaturalLanguage(message, context);

    const latencyMs = Date.now() - startTime;
    const intentOrTool = response.data?.toolRequested || response.metadata?.activeContext?.state?.intent || "general_chat";

    // Record request dynamically inside usage engine
    await usageService.recordRequest(sessionKey, userKey, intentOrTool, latencyMs);
    
    // Normalize and validate the contract
    const validatedResponse = validateAndNormalizeChatResponse(response);

    console.log(JSON.stringify({
      level: "info",
      timestamp: new Date().toISOString(),
      requestId,
      intentOrTool,
      latencyMs,
      success: validatedResponse.success
    }));
    return safeJson(res, 200, validatedResponse);
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    console.error(JSON.stringify({
      level: "error",
      timestamp: new Date().toISOString(),
      requestId,
      latencyMs,
      error: err && err.message,
      stack: err && err.stack
    }));
    return safeJson(res, 500, {
      error: "Internal server error",
      requestId,
      ...(process.env.NODE_ENV !== "production"
        ? { detail: err && err.message, stack: err && err.stack }
        : {})
    });
  }
});

app.post("/api/chat-stream", async (req, res) => {
  const sessionId = req.headers["x-session-id"] || `session-${Date.now()}`;
  const adapter = new SSEAdapter(req, res, sessionId);

  try {
    const { message, context } = req.body || {};
    if (!message) {
      adapter.sendEvent("error", { error: "message is required" });
      return adapter.close();
    }

    // STATE_TRACE: HTTP entry
    console.log("[STATE_TRACE]", {
      stage: "HTTP_ENTRY",
      request: message,
      conversationType: context?.state?.conversationType,
      clarificationTarget: context?.state?.conversationState?.clarificationTarget,
      currentState: context?.state?.conversationState?.currentState,
      hasContext: !!context,
      sessionId
    });

    // Diagnostic: trace context propagation
    const _diag = {
      hasContext: !!context,
      hasState: !!context?.state,
      hasConvState: !!context?.state?.conversationState,
      convState: context?.state?.conversationState?.currentState || "none",
      clarTarget: context?.state?.conversationState?.clarificationTarget || "none",
    };
    console.log(`[DIAG] message="${message}" context=${JSON.stringify(_diag)}`);

    // Emit REQUEST_STARTED immediately so frontend shows activity
    adapter.sendEvent("progress", { stage: "REQUEST_STARTED", message: "Processing your request..." });

    const llmAdapter = await llmAdapterPromise.then(() => llmAdapterModule).catch(() => null);
    if (!llmAdapter) {
      adapter.sendEvent("error", { error: "LLM adapter not initialized" });
      return adapter.close();
    }

    // Pass sessionId so execution_engine emits EventBus progress events
    // which SSEAdapter forwards in real-time to the client
    const response = await llmAdapter.processNaturalLanguage(message, context, sessionId);
    
    // We send a token event to dump text for now, but EventBus handles progress
    if (response.data && response.data.text) {
      adapter.sendEvent("token", { token: response.data.text });
    }
    
    adapter.sendEvent("result", { response });
    adapter.close();
  } catch (err) {
    adapter.sendEvent("error", { error: err.message });
    adapter.close();
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});


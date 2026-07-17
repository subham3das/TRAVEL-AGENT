/**
 * Travel Intelligence OS - LLM Telemetry Logger.
 *
 * Ring buffer logging every LLM invocation with rich metadata.
 * Tracks skips, cache hits, tokens saved, cost estimates.
 *
 * @module llm_telemetry
 */

// ponytail: in-memory ring buffer, no DB, no file writes
class LLMTelemetry {
  constructor() {
    this.entries = [];
    this.maxEntries = 200;
    this.sessionStats = {
      totalRequests: 0,
      llmCalls: 0,
      llmSkipped: 0,
      cacheHits: 0,
      totalLatencyMs: 0,
      estimatedTokensSaved: 0
    };
  }

  /**
   * Log an LLM-related event.
   */
  log(entry) {
    const record = {
      timestamp: new Date().toISOString(),
      requestId: entry.requestId || `req-${Date.now()}`,
      sessionId: entry.sessionId || "default",
      reason: entry.reason || "unknown",
      caller: entry.caller || "unknown",
      latencyMs: entry.latencyMs || 0,
      llmSkipped: entry.llmSkipped || false,
      skipReason: entry.skipReason || null,
      cacheHit: entry.cacheHit || false,
      cacheType: entry.cacheType || null,
      tool: entry.tool || null,
      tokensSaved: entry.tokensSaved || 0,
      estimatedCostSaved: entry.estimatedCostSaved || 0,
      executionTimeMs: entry.executionTimeMs || 0
    };

    this.entries.push(record);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // Update session stats
    this.sessionStats.totalRequests++;
    if (record.llmSkipped) {
      this.sessionStats.llmSkipped++;
      this.sessionStats.estimatedTokensSaved += record.tokensSaved;
    } else {
      this.sessionStats.llmCalls++;
    }
    if (record.cacheHit) {
      this.sessionStats.cacheHits++;
    }
    this.sessionStats.totalLatencyMs += record.latencyMs;
  }

  /**
   * Get dashboard-ready stats.
   */
  getDashboard() {
    const s = this.sessionStats;
    const total = s.totalRequests || 1;
    const avgLatency = s.totalRequests > 0 ? Math.round(s.totalLatencyMs / s.totalRequests) : 0;
    // ponytail: rough estimate, $0.15 per 1M input tokens for flash
    const costSaved = Math.round((s.estimatedTokensSaved / 1000000) * 0.15 * 100) / 100;

    return {
      totalRequests: s.totalRequests,
      llmCalls: s.llmCalls,
      llmSkipped: s.llmSkipped,
      skipRate: Math.round((s.llmSkipped / total) * 100),
      cacheHits: s.cacheHits,
      cacheHitRate: Math.round((s.cacheHits / total) * 100),
      averageLatencyMs: avgLatency,
      tokensSaved: s.estimatedTokensSaved,
      estimatedCostSaved: `$${costSaved}`
    };
  }

  getRecentEntries(count = 20) {
    return this.entries.slice(-count);
  }

  reset() {
    this.entries = [];
    this.sessionStats = {
      totalRequests: 0,
      llmCalls: 0,
      llmSkipped: 0,
      cacheHits: 0,
      totalLatencyMs: 0,
      estimatedTokensSaved: 0
    };
  }
}

module.exports = new LLMTelemetry();

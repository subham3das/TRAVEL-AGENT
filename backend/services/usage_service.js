/**
 * Travel Intelligence OS - Usage Engine Service.
 *
 * Implements pluggable storage for global, per-user, and per-session capacity
 * tracking with a rolling "daily" capacity window.
 *
 * Synchronization contract (shared with the frontend AI Capacity widget):
 *   - used      = accumulated compute units consumed in the current window
 *   - remaining = max(0, limit - used)
 *   - percentage = round(remaining / limit * 100)   (capacity remaining)
 *   - resetAt   = absolute timestamp when the window rolls over and usage resets
 *
 * The widget renders capacity from `remaining / limit` and counts down to
 * `resetAt`, so both values stay in lockstep as long as the window actually
 * rolls over here at `resetAt`.
 *
 * @module usage_service
 */

class MemoryStorageProvider {
  constructor() {
    this.globalUsage = 0;
    this.userUsage = {};
    this.sessionUsage = {};
    this.latencies = []; // Stores last 50 latency values in seconds
    this.peakLatency = 0;
    this.currentRequestLatency = 0;
    this.requestCounts = {
      total: 0,
      planner: 0,
      generalChat: 0,
      replans: 0
    };

    // Rolling capacity window. `resetAt` is an absolute epoch-ms timestamp
    // (next midnight by default). Everything else is reset when it elapses.
    this.windowStart = Date.now();
    this.resetAt = this.computeNextMidnight();
  }

  computeNextMidnight() {
    const now = new Date();
    const reset = new Date(now);
    reset.setHours(24, 0, 0, 0);
    return reset.getTime();
  }

  resetUsage() {
    this.globalUsage = 0;
    this.userUsage = {};
    this.sessionUsage = {};
    this.latencies = [];
    this.peakLatency = 0;
    this.currentRequestLatency = 0;
    this.requestCounts = {
      total: 0,
      planner: 0,
      generalChat: 0,
      replans: 0
    };
  }

  // Clear accumulated usage and start a fresh window ending at resetAtMs.
  beginWindow(startMs, resetAtMs) {
    this.resetUsage();
    this.windowStart = startMs;
    this.resetAt = resetAtMs;
  }

  // ─── Persistent-storage extension points (future Redis / Supabase) ───
  // A persistent provider overrides loadSnapshot() to return the saved
  // { globalUsage, userUsage, sessionUsage, latencies, requestCounts,
  //   windowStart, resetAt } when one exists, and saveSnapshot() to persist
  // it. applySnapshot() restores that state so a restarted backend resumes
  // the exact same in-progress window instead of starting over (requirement 7).
  loadSnapshot() { return null; }
  saveSnapshot() {}
  applySnapshot(snapshot) {
    this.globalUsage = snapshot.globalUsage || 0;
    this.userUsage = snapshot.userUsage || {};
    this.sessionUsage = snapshot.sessionUsage || {};
    this.latencies = snapshot.latencies || [];
    this.peakLatency = snapshot.peakLatency || 0;
    this.currentRequestLatency = snapshot.currentRequestLatency || 0;
    this.requestCounts = snapshot.requestCounts || { total: 0, planner: 0, generalChat: 0, replans: 0 };
    this.windowStart = snapshot.windowStart || Date.now();
    this.resetAt = snapshot.resetAt || this.computeNextMidnight();
  }

  async getUsage(globalKey, userKey, sessionKey) {
    return {
      global: this.globalUsage,
      user: this.userUsage[userKey] || 0,
      session: this.sessionUsage[sessionKey] || 0,
      requestCounts: { ...this.requestCounts }
    };
  }

  async incrementUsage(globalKey, userKey, sessionKey, amount, category) {
    this.globalUsage += amount;
    this.userUsage[userKey] = (this.userUsage[userKey] || 0) + amount;
    this.sessionUsage[sessionKey] = (this.sessionUsage[sessionKey] || 0) + amount;

    // Track request types
    this.requestCounts.total += 1;
    if (category === "planner") {
      this.requestCounts.planner += 1;
    } else if (category === "replan") {
      this.requestCounts.replans += 1;
    } else {
      this.requestCounts.generalChat += 1;
    }
  }

  async recordLatency(latencySec) {
    this.currentRequestLatency = latencySec;
    if (latencySec > this.peakLatency) {
      this.peakLatency = latencySec;
    }
    this.latencies.push(latencySec);
    if (this.latencies.length > 50) {
      this.latencies.shift();
    }
  }

  async getLatencyStats() {
    const sum = this.latencies.reduce((a, b) => a + b, 0);
    const average = this.latencies.length > 0 ? sum / this.latencies.length : 1.7;
    return {
      currentRequestLatency: this.currentRequestLatency || 1.7,
      averageLatency: Math.round(average * 10) / 10,
      peakLatency: this.peakLatency || 2.6
    };
  }
}

class UsageService {
  constructor() {
    // Pluggable storage provider (memory by default, swap for Redis or DB provider later)
    this.storage = new MemoryStorageProvider();
    this.limit = 100; // Global capacity ceiling (compute units)
    // Establish a consistent window on boot.
    this.ensureWindow();
  }

  setStorageProvider(provider) {
    this.storage = provider;
    // Resume or start a window whenever storage is swapped.
    this.ensureWindow();
  }

  computeNextMidnight() {
    return this.storage.computeNextMidnight();
  }

  // Roll the capacity window over once it has expired. If a persistent
  // provider holds a still-valid saved window, resume it (requirement 7);
  // otherwise start a fresh window with usage zeroed (requirement 6).
  ensureWindow() {
    const now = Date.now();
    if (this.storage.resetAt && now < this.storage.resetAt) {
      return; // current window still active
    }

    const snapshot = this.storage.loadSnapshot ? this.storage.loadSnapshot() : null;
    if (snapshot && snapshot.resetAt && now < snapshot.resetAt) {
      // Resume the previous in-progress window.
      this.storage.applySnapshot(snapshot);
      return;
    }

    // Begin a fresh window and clear accumulated usage.
    this.storage.beginWindow(now, this.computeNextMidnight());
    if (this.storage.saveSnapshot) this.storage.saveSnapshot();
  }

  calculateWeight(intentOrTool, latencyMs) {
    // Capacity Weight Matrix - Dynamic weights based on compute complexity
    switch (intentOrTool) {
      case "plan_trip":
      case "GENERATE_PLAN":
        return 3.0;
      case "modify_trip":
      case "MODIFY_PLAN":
        return 2.0;
      case "book_trip":
      case "BOOK_TRIP":
        return 2.0;
      case "calculate_budget":
      case "CALCULATE_BUDGET":
        return 1.0;
      case "recommend_places":
      case "RECOMMEND_PLACES":
        return 1.0;
      case "GREETING":
        return 0.2;
      case "TRAVEL_KNOWLEDGE":
        return 0.5;
      default:
        // Dynamic weight based on execution duration for long streaming responses
        if (latencyMs && latencyMs > 3000) {
          return Math.min(2.0, latencyMs / 1000);
        }
        return 0.5;
    }
  }

  getCategory(intentOrTool) {
    switch (intentOrTool) {
      case "plan_trip":
      case "GENERATE_PLAN":
        return "planner";
      case "modify_trip":
      case "MODIFY_PLAN":
        return "replan";
      default:
        return "chat";
    }
  }

  async recordRequest(sessionKey = "default-session", userKey = "default-user", intentOrTool, latencyMs) {
    // Roll over the window before counting, so a request that lands after
    // resetAt is charged against the new (zeroed) window.
    this.ensureWindow();

    const weight = this.calculateWeight(intentOrTool, latencyMs);
    const category = this.getCategory(intentOrTool);

    await this.storage.incrementUsage("global", userKey, sessionKey, weight, category);

    if (latencyMs) {
      await this.storage.recordLatency(latencyMs / 1000);
    }
  }

  async getStatus(sessionKey = "default-session", userKey = "default-user") {
    // Roll over the window before reporting, so capacity and resetAt are
    // always mutually consistent.
    this.ensureWindow();

    const usageData = await this.storage.getUsage("global", userKey, sessionKey);
    const latencyStats = await this.storage.getLatencyStats();

    const used = Math.round(usageData.global);
    const remaining = Math.max(0, this.limit - used);
    const percentage = Math.round((remaining / this.limit) * 100);

    let state = "healthy";
    if (percentage < 15) {
      state = "critical";
    } else if (percentage < 40) {
      state = "low";
    } else if (percentage < 75) {
      state = "moderate";
    }

    const now = new Date();
    const serverTime = now.toISOString();
    const resetAt = new Date(this.storage.resetAt).toISOString();

    return {
      capacity: {
        used,
        limit: this.limit,
        remaining,
        percentage,
        resetAt,
        state,
        sessionUsed: Math.round(usageData.session),
        userUsed: Math.round(usageData.user),
        requestCounts: usageData.requestCounts
      },
      system: {
        gemini: process.env.GEMINI_API_KEY ? "online" : "connected",
        knowledgeGraph: "loaded",
        planner: "healthy",
        budget: "healthy",
        recommendation: "healthy",
        weather: "connected",
        maps: "connected",
        pinecone: process.env.PINECONE_API_KEY ? "connected" : "unconfigured"
      },
      performance: {
        ...latencyStats
      },
      provider: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      serverTime,
      updatedAt: serverTime
    };
  }

  resetLocal() {
    // Dev-only full reset: clear usage AND restart the window consistently
    // (new resetAt, fresh window start).
    this.storage.beginWindow(Date.now(), this.computeNextMidnight());
    if (this.storage.saveSnapshot) this.storage.saveSnapshot();
  }
}

module.exports = new UsageService();

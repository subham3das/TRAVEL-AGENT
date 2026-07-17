const crypto = require("crypto");

/**
 * Travel Intelligence OS - Request Deduplicator.
 *
 * Prevents duplicate LLM calls when user sends the same message multiple times.
 * SHA256(query) → pending promise map. Second identical request awaits first.
 *
 * @module request_deduplicator
 */

class RequestDeduplicator {
  constructor() {
    this.pending = new Map();
    this.ttlMs = 30000; // 30 second window
    this.stats = { deduped: 0, total: 0 };
  }

  /**
   * Generate dedup key from message + context hash.
   */
  key(message, context) {
    const contextKey = context?.state?.normalizedEntities?.destination || "";
    const raw = `${(message || "").trim().toLowerCase()}:${contextKey}`;
    return crypto.createHash("sha256").update(raw).digest("hex").substring(0, 16);
  }

  /**
   * Execute with deduplication.
   * If identical request is already in flight, await the same promise.
   *
   * @param {string} message
   * @param {object} context
   * @param {Function} executor - async function to execute if not deduped
   * @returns {Promise<any>}
   */
  async execute(message, context, executor) {
    this.stats.total++;
    const k = this.key(message, context);

    // Check for in-flight duplicate
    const existing = this.pending.get(k);
    if (existing && Date.now() - existing.startedAt < this.ttlMs) {
      this.stats.deduped++;
      return existing.promise;
    }

    // Execute and store promise
    const promise = executor().finally(() => {
      // Clean up after completion
      setTimeout(() => this.pending.delete(k), 1000);
    });

    this.pending.set(k, {
      promise,
      startedAt: Date.now()
    });

    return promise;
  }

  getStats() {
    return {
      ...this.stats,
      dedupRate: this.stats.total > 0 ? Math.round((this.stats.deduped / this.stats.total) * 100) : 0,
      pendingCount: this.pending.size
    };
  }

  clear() {
    this.pending.clear();
    this.stats = { deduped: 0, total: 0 };
  }
}

module.exports = new RequestDeduplicator();

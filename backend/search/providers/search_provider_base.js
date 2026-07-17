/**
 * Travel OS — Search Provider Base
 *
 * Frozen contract for ALL search-layer providers.
 * Every adapter (Google Places, Amadeus, Booking, Maps, Weather, Events)
 * MUST extend this class.
 *
 * Providers return NormalizedResult[] — the Search Layer handles everything else.
 */

"use strict";

class SearchProviderBase {
  constructor(name, options = {}) {
    this.name = name;
    this.priority = options.priority || 50;
    this.supportedTypes = options.supportedTypes || [];
    this.rateLimit = options.rateLimit || { requests: 100, windowMs: 60000 };
    this.timeout = options.timeout || 8000;

    this.successCount = 0;
    this.failureCount = 0;
    this.lastSuccess = null;
    this.lastFailure = null;
    this.totalLatency = 0;
  }

  /**
   * Whether this provider can handle a given search type.
   * @param {string} type - "hotel" | "flight" | "activity" | "restaurant" | "weather" | "events" | "maps"
   * @returns {boolean}
   */
  supports(type) {
    return this.supportedTypes.includes(type);
  }

  /**
   * Search for results matching criteria.
   * MUST return NormalizedResult[].
   *
   * @param {object} criteria
   * @param {string} criteria.destinationId
   * @param {string} criteria.query
   * @param {object} [criteria.filters] - budget, category, dates, etc.
   * @param {AbortSignal} [abortSignal]
   * @returns {Promise<NormalizedResult[]>}
   */
  async search(criteria, abortSignal = null) {
    throw new Error(`search() not implemented for provider: ${this.name}`);
  }

  /**
   * Get provider health status.
   * @returns {Promise<{ status: string, latency: number, lastSuccess: string, failureRate: number }>}
   */
  async health() {
    const total = this.successCount + this.failureCount;
    const failureRate = total > 0 ? this.failureCount / total : 0;
    return {
      status: failureRate > 0.5 ? "unhealthy" : "healthy",
      latency: total > 0 ? Math.round(this.totalLatency / total) : 0,
      lastSuccess: this.lastSuccess,
      failureRate: Number(failureRate.toFixed(3))
    };
  }

  /**
   * Record a successful call (for health tracking).
   */
  recordSuccess(latencyMs) {
    this.successCount++;
    this.lastSuccess = new Date().toISOString();
    this.totalLatency += latencyMs;
  }

  /**
   * Record a failed call (for health tracking).
   */
  recordFailure(error) {
    this.failureCount++;
    this.lastFailure = new Date().toISOString();
  }

  /**
   * Provider-specific configuration or metadata.
   */
  metadata() {
    return {
      name: this.name,
      priority: this.priority,
      supportedTypes: this.supportedTypes,
      rateLimit: this.rateLimit,
      timeout: this.timeout
    };
  }
}

module.exports = SearchProviderBase;

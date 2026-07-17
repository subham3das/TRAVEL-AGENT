/**
 * Travel OS — Provider Orchestrator
 *
 * Coordinates provider execution:
 * - Looks up providers via ProviderRegistry
 * - Monitors provider health (latency, failures)
 * - Implements a Circuit Breaker per provider:
 *   - Auto-opens circuit after 3 consecutive failures (timeouts, errors)
 *   - Bypasses provider when circuit is open, allowing fallback routing
 *   - Gradually resets circuit after a cooldown period (30s)
 */

"use strict";

const providerRegistry = require("./provider_registry");
const eventBus = require("../../events/event_bus");

const CIRCUIT_LIMIT = 3;
const COOLDOWN_MS = 30000; // 30 seconds cooldown

class ProviderOrchestrator {
  constructor() {
    this.states = {}; // per-provider state: { failures: 0, status: "closed"|"open", lastFailureTime: null }
  }

  _getCircuit(providerName) {
    if (!this.states[providerName]) {
      this.states[providerName] = {
        failures: 0,
        status: "closed",
        lastFailureTime: null
      };
    }
    return this.states[providerName];
  }

  /**
   * Execute search on the configured provider with circuit breakers and health monitoring.
   *
   * @param {string} type - "hotel" | "flight" | "weather"
   * @param {object} criteria
   * @param {AbortSignal} [abortSignal]
   * @returns {Promise<object[]>} Array of raw ProviderResult shape
   */
  async search(type, criteria, abortSignal = null) {
    const provider = providerRegistry.getProvider(type);
    if (!provider) {
      throw new Error(`No provider registered for type: ${type}`);
    }

    const providerName = provider.name || provider.constructor.name;
    const circuit = this._getCircuit(providerName);

    // 1. Circuit Breaker Check
    if (circuit.status === "open") {
      const timeSinceFailure = Date.now() - circuit.lastFailureTime;
      if (timeSinceFailure > COOLDOWN_MS) {
        // Cooldown finished: transition to half-open
        console.warn(`[CircuitBreaker] Provider ${providerName} circuit entering half-open state`);
        circuit.status = "half-open";
      } else {
        // Circuit is open, skip provider
        const msg = `Circuit is OPEN for provider: ${providerName}. Skipping.`;
        console.warn(`[CircuitBreaker] ${msg}`);
        eventBus.emitEvent(criteria.sessionId, "SEARCH_FAILED", { provider: providerName, reason: "circuit_open" });
        return [];
      }
    }

    // 2. Health check validation (skip if unhealthy)
    if (typeof provider.health === "function") {
      try {
        const health = await provider.health();
        if (health && health.status === "unhealthy") {
          console.warn(`[ProviderOrchestrator] Skipping unhealthy provider: ${providerName}`);
          return [];
        }
      } catch (err) {
        // health check failed, count as failure
      }
    }

    eventBus.emitEvent(criteria.sessionId, "PROVIDER_SELECTED", { provider: providerName });

    // 3. Execution
    try {
      if (abortSignal && abortSignal.aborted) {
        throw new Error("Query cancelled by user abort");
      }

      const results = await provider.search(criteria, abortSignal);

      // Reset circuit on success
      if (circuit.status !== "closed") {
        console.log(`[CircuitBreaker] Provider ${providerName} circuit reset to CLOSED`);
      }
      circuit.failures = 0;
      circuit.status = "closed";
      circuit.lastFailureTime = null;

      return results || [];

    } catch (err) {
      // Record failure
      circuit.failures++;
      circuit.lastFailureTime = Date.now();

      if (circuit.failures >= CIRCUIT_LIMIT) {
        circuit.status = "open";
        console.error(`[CircuitBreaker] Provider ${providerName} failures: ${circuit.failures}. Circuit is now OPEN.`);
      }

      console.error(`[ProviderOrchestrator] Provider ${providerName} failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Reset circuit breakers manually (for diagnostics/recovery).
   */
  resetAll() {
    this.states = {};
  }
}

module.exports = new ProviderOrchestrator();

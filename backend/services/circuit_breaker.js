/**
 * Travel Intelligence OS - LLM Circuit Breaker.
 *
 * Prevents cascading failures when Gemini returns 429/503/timeout.
 * Falls back to Knowledge Graph + templates during outage.
 * Auto-closes after configurable cooldown.
 *
 * @module circuit_breaker
 */

const STATES = {
  CLOSED: "CLOSED",       // Normal — LLM calls allowed
  OPEN: "OPEN",           // Tripped — LLM calls blocked, using fallbacks
  HALF_OPEN: "HALF_OPEN"  // Testing — allow one probe call
};

class CircuitBreaker {
  constructor(options = {}) {
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.tripCount = 0;
    this.failureThreshold = options.failureThreshold || 3;
    this.cooldownMs = options.cooldownMs || 60000; // 60 seconds
    this.lastFailureTime = 0;
    this.lastError = null;
  }

  /**
   * Check if LLM calls are allowed.
   */
  isAvailable() {
    if (this.state === STATES.CLOSED) return true;

    if (this.state === STATES.OPEN) {
      // Check if cooldown elapsed
      if (Date.now() - this.lastFailureTime >= this.cooldownMs) {
        this.state = STATES.HALF_OPEN;
        return true; // Allow one probe
      }
      return false;
    }

    // HALF_OPEN — allow one call
    return true;
  }

  /**
   * Record a successful LLM call.
   */
  recordSuccess() {
    this.failureCount = 0;
    this.state = STATES.CLOSED;
    this.lastError = null;
  }

  /**
   * Record a failed LLM call. Trip breaker if threshold exceeded.
   */
  recordFailure(error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.lastError = error;

    // Check for trippable errors
    const msg = (error || "").toString().toLowerCase();
    const isTrippable = msg.includes("429") || msg.includes("quota") || msg.includes("rate limit") ||
                        msg.includes("503") || msg.includes("unavailable") ||
                        msg.includes("timeout") || msg.includes("aborted");

    if (isTrippable || this.failureCount >= this.failureThreshold) {
      this.state = STATES.OPEN;
      this.tripCount++;
      console.warn(JSON.stringify({
        level: "WARN",
        timestamp: new Date().toISOString(),
        message: "Circuit breaker opened",
        failureCount: this.failureCount,
        cooldownMs: this.cooldownMs,
        error: (error || "").toString()
      }));
    }
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      tripCount: this.tripCount,
      lastError: this.lastError,
      cooldownRemainingMs: this.state === STATES.OPEN
        ? Math.max(0, this.cooldownMs - (Date.now() - this.lastFailureTime))
        : 0
    };
  }

  reset() {
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.tripCount = 0;
    this.lastFailureTime = 0;
    this.lastError = null;
  }
}

module.exports = new CircuitBreaker();

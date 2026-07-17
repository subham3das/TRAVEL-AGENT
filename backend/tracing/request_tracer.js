/**
 * Travel OS — Request Tracer
 *
 * Structured per-request trace. Every engine stage records its result here.
 * Emitted as metadata in the final response so every failure is identifiable.
 */

class RequestTracer {
  constructor(requestId) {
    this.requestId = requestId;
    this.startTime = Date.now();
    this.stages = [];
    this.errors = [];
  }

  /**
   * Record a stage result.
   * @param {string} name   - Human-readable stage name (e.g. "RECOMMENDATION_ENGINE")
   * @param {string} status - "✓" | "✗" | "⚠ skipped"
   * @param {number} durationMs
   * @param {string[]} [errors]
   */
  record(name, status, durationMs, errors = []) {
    this.stages.push({ name, status, durationMs, errors });
    if (errors.length > 0) {
      this.errors.push(...errors.map(e => `[${name}] ${e}`));
    }
  }

  /**
   * Formatted single-line trace for server logs.
   */
  toLog() {
    const lines = this.stages.map(s =>
      `  ${s.status} ${s.name} (${s.durationMs}ms)${s.errors.length ? ' — ' + s.errors.join(', ') : ''}`
    );
    return [
      `[Trace ${this.requestId}] total=${Date.now() - this.startTime}ms`,
      ...lines
    ].join('\n');
  }

  /**
   * Structured object for response metadata.
   */
  toObject() {
    return {
      requestId: this.requestId,
      totalMs: Date.now() - this.startTime,
      stages: this.stages,
      errors: this.errors
    };
  }
}

module.exports = RequestTracer;

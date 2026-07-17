/**
 * Travel OS SSE Adapter
 *
 * Bridges Express HTTP responses with the internal EventBus.
 * All events are sent as unnamed SSE frames (no "event:" line)
 * so EventSource.onmessage receives every payload.
 */
const eventBus = require("../events/event_bus");

class SSEAdapter {
  constructor(req, res, sessionId) {
    this.req = req;
    this.res = res;
    this.sessionId = sessionId;
    this.closed = false;
    this.unsubscribe = null;

    // Standard SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    });

    // Flush headers immediately
    if (typeof res.flush === "function") res.flush();

    // Clean up when client disconnects or response finishes
    res.on("close", () => this._cleanup());
    res.on("finish", () => this._cleanup());

    // Subscribe to EventBus for this session
    this.unsubscribe = eventBus.subscribeToSession(sessionId, (data) => {
      this.send(data);
    });
  }

  /**
   * Send any object as an unnamed SSE data frame.
   * EventSource.onmessage receives these.
   */
  send(payload) {
    if (this.closed || this.res.writableEnded) return;
    try {
      this.res.write(`data: ${JSON.stringify(payload)}\n\n`);
      if (typeof this.res.flush === "function") this.res.flush();
    } catch (e) {
      console.error("[SSEAdapter] write error:", e.message);
    }
  }

  /**
   * Convenience: send a typed payload.
   * type is embedded in the JSON, not as an SSE "event:" header.
   */
  sendEvent(type, data) {
    this.send({ type, data });
  }

  _cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  close() {
    if (this.closed) return;
    // Send DONE as a normal data frame so onmessage catches it
    this.send({ type: "DONE" });
    this.closed = true;
    this._cleanup();
    if (!this.res.writableEnded) {
      this.res.end();
    }
  }
}

module.exports = SSEAdapter;

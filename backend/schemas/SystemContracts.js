function validateSystemStatusResponse(status) {
  if (!status || typeof status !== "object") {
    throw new Error("Invalid system status payload: not an object");
  }
  if (!status.capacity || typeof status.capacity !== "object") {
    throw new Error("Invalid system status payload: missing capacity object");
  }

  return {
    capacity: {
      used: Number(status.capacity.used),
      limit: Number(status.capacity.limit),
      remaining: Number(status.capacity.remaining),
      percentage: Number(status.capacity.percentage),
      resetAt: String(status.capacity.resetAt),
      state: String(status.capacity.state),
      sessionUsed: Number(status.capacity.sessionUsed),
      userUsed: Number(status.capacity.userUsed),
      requestCounts: {
        total: Number(status.capacity.requestCounts?.total || 0),
        planner: Number(status.capacity.requestCounts?.planner || 0),
        generalChat: Number(status.capacity.requestCounts?.generalChat || 0),
        replans: Number(status.capacity.requestCounts?.replans || 0)
      }
    },
    system: status.system,
    performance: status.performance,
    provider: status.provider,
    serverTime: status.serverTime,
    updatedAt: status.updatedAt,
    telemetry: status.telemetry,
    circuitBreaker: status.circuitBreaker,
    cache: status.cache,
    dedup: status.dedup
  };
}

function validateSystemHealthResponse(health) {
  const validStates = ["healthy", "degraded", "offline", "rate_limited", "unknown"];
  
  const validateState = (state) => validStates.includes(state) ? state : "unknown";

  const services = health.services || {};
  const normalized = {
    status: validateState(health.status) === "healthy" ? "healthy" : "degraded",
    timestamp: health.timestamp || new Date().toISOString(),
    services: {
      knowledgeGraph: validateState(services.knowledgeGraph),
      gemini: validateState(services.gemini),
      pinecone: validateState(services.pinecone),
      booking: validateState(services.booking)
    }
  };
  return normalized;
}

module.exports = {
  validateSystemStatusResponse,
  validateSystemHealthResponse
};

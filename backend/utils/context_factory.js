function createTravelContext(userMessage) {
  return {
    originalQuery: userMessage || "",
    pipeline: "",
    intent: {},
    trip: {},
    budget: {},
    routes: {},
    booking: {},
    memory: {},
    recommendations: {},
    validation: {},
  };
}

module.exports = { createTravelContext };

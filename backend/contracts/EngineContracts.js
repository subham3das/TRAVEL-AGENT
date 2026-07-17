/**
 * Travel OS Engine Contracts
 * 
 * Defines the strict boundaries between architectural layers.
 * No raw JS objects should cross engine boundaries without validation.
 */

function validateIntent(intent) {
  if (!intent || typeof intent !== "object") throw new Error("Invalid Intent");
  return {
    id: intent.id || `intent-${Date.now()}`,
    type: String(intent.type || "PLAN_TRIP"), // PLAN_TRIP, MODIFY_TRIP, GENERAL_QUERY
    destination: intent.destination ? String(intent.destination) : null,
    travelStyle: intent.travelStyle ? String(intent.travelStyle) : "mid",
    travelersType: intent.travelersType ? String(intent.travelersType) : "solo",
    season: intent.season ? String(intent.season) : "unknown",
    transportPreference: intent.transportPreference ? String(intent.transportPreference) : "mixed",
    hotelTier: intent.hotelTier ? String(intent.hotelTier) : "3-star",
    budgetConstraint: intent.budgetConstraint ? Number(intent.budgetConstraint) : null,
    daysConstraint: intent.daysConstraint ? Number(intent.daysConstraint) : null,
    selectedPlaces: Array.isArray(intent.selectedPlaces) ? intent.selectedPlaces : [],
    selectedHotel: intent.selectedHotel || null,
    selectedFlight: intent.selectedFlight || null,
    preferences: intent.preferences || {},
    confidence: Number(intent.confidence || 0),
    timestamp: intent.timestamp || new Date().toISOString()
  };
}

function validateRecommendationResponse(res) {
  if (!res || typeof res !== "object") throw new Error("Invalid RecommendationResponse");
  return {
    candidates: Array.isArray(res.candidates) ? res.candidates.map(c => ({
      id: String(c.id),
      name: String(c.name),
      category: String(c.category || "attraction"),
      image: String(c.image || ""),
      description: String(c.description || ""),
      rating: Number(c.rating || 4.0),
      price: Number(c.price || 0),
      duration: String(c.duration || "2-3 hours"),
      distance: String(c.distance || "Nearby"),
      confidence: Number(c.confidence || 0.9),
      whyRecommended: String(c.whyRecommended || ""),
      source: String(c.source || "knowledge_graph")
    })) : [],
    metadata: res.metadata || {}
  };
}

function validateBudgetEstimate(estimate) {
  if (!estimate || typeof estimate !== "object") throw new Error("Invalid BudgetEstimate");
  return {
    minimumRequired: Number(estimate.minimumRequired || 0),
    comfortable: Number(estimate.comfortable || 0),
    luxury: Number(estimate.luxury || 0),
    minimumDays: Number(estimate.minimumDays || 1),
    breakdown: {
      stays: Number(estimate.breakdown?.stays || 0),
      activities: Number(estimate.breakdown?.activities || 0),
      dining: Number(estimate.breakdown?.dining || 0),
      transit: Number(estimate.breakdown?.transit || 0)
    },
    confidence: Number(estimate.confidence || 0.9),
    generatedAt: estimate.generatedAt || new Date().toISOString()
  };
}

function validatePlannerInput(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid PlannerInput");
  return {
    destination: String(input.destination),
    days: Number(input.days),
    budget: Number(input.budget),
    places: Array.isArray(input.places) ? input.places : [], // Normalized selection objects
    hotel: input.hotel || null, // Normalized hotel object
    flight: input.flight || null, // Normalized flight object
    travelStyle: String(input.travelStyle || "mid"),
    constraints: {
      maxActivitiesPerDay: Number(input.constraints?.maxActivitiesPerDay || 3),
      pace: String(input.constraints?.pace || "medium"),
      startHour: Number(input.constraints?.startHour || 9),
      endHour: Number(input.constraints?.endHour || 20)
    }
  };
}

function validatePlannerOutput(output) {
  if (!output || typeof output !== "object") throw new Error("Invalid PlannerOutput");
  return {
    dailyPlans: Array.isArray(output.dailyPlans) ? output.dailyPlans.map(dp => ({
      day: Number(dp.day),
      date: dp.date ? String(dp.date) : null,
      theme: String(dp.theme || "Exploration"),
      slots: Array.isArray(dp.slots) ? dp.slots : []
    })) : [],
    metrics: {
      totalTravelTime: Number(output.metrics?.totalTravelTime || 0),
      routeEfficiency: Number(output.metrics?.routeEfficiency || 80)
    },
    generatedAt: output.generatedAt || new Date().toISOString()
  };
}

function validateBookingResult(result) {
  if (!result || typeof result !== "object") throw new Error("Invalid BookingResult");
  return {
    id: String(result.id),
    provider: String(result.provider),
    type: String(result.type), // HOTEL, FLIGHT, ACTIVITY
    status: String(result.status), // CONFIRMED, PENDING, FAILED
    price: Number(result.price),
    currency: String(result.currency || "INR"),
    confirmationCode: String(result.confirmationCode || ""),
    details: result.details || {}
  };
}

function validateTrip(trip) {
  if (!trip || typeof trip !== "object") throw new Error("Invalid Trip Aggregate");
  return {
    id: String(trip.id || `trip-${Date.now()}`),
    status: String(trip.status || "DRAFT"), // DRAFT, FINALIZED, BOOKED, COMPLETED
    version: Number(trip.version || 1),
    
    // The aggregate includes everything
    journeyState: trip.journeyState || "START",
    intent: trip.intent ? validateIntent(trip.intent) : null,
    timeline: trip.timeline ? validatePlannerOutput(trip.timeline) : null,
    budgetSummary: trip.budgetSummary ? validateBudgetEstimate(trip.budgetSummary) : null,
    bookings: Array.isArray(trip.bookings) ? trip.bookings.map(validateBookingResult) : [],
    
    // Conversation history context
    conversation: Array.isArray(trip.conversation) ? trip.conversation : [],
    
    metadata: trip.metadata || {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

function validateSearchResult(res) {
  if (!res || typeof res !== "object") throw new Error("Invalid SearchResult");
  return {
    schemaVersion: String(res.schemaVersion || "1.0"),
    requestId:     String(res.requestId || ""),
    generatedAt:   String(res.generatedAt || new Date().toISOString()),
    id:            String(res.id),
    type:          String(res.type), // hotel, flight, activity, restaurant, weather
    source:        String(res.source || "search_layer"),
    title:         String(res.title || res.name || ""),
    subtitle:      String(res.subtitle || ""),
    location:      res.location ? String(res.location) : null,
    coordinates:   res.coordinates ? {
      latitude:  Number(res.coordinates.latitude || res.coordinates.lat || 0),
      longitude: Number(res.coordinates.longitude || res.coordinates.lon || 0)
    } : null,
    images:        Array.isArray(res.images) ? res.images.map(String) : [],
    pricing:       res.pricing ? {
      price:    Number(res.pricing.price || 0),
      currency: String(res.pricing.currency || "INR"),
      label:    String(res.pricing.label || "")
    } : { price: 0, currency: "INR", label: "" },
    availability:  res.availability ? {
      status:   String(res.availability.status || "available"),
      source:   String(res.availability.source || "unknown"),
      metadata: res.availability.metadata || {}
    } : { status: "available", source: "unknown", metadata: {} },
    confidence:    res.confidence ? {
      score:      Number(res.confidence.score || 0.9),
      reason:     String(res.confidence.reason || ""),
      verifiedAt: String(res.confidence.verifiedAt || new Date().toISOString()),
      source:     String(res.confidence.source || "unknown")
    } : null,
    metadata:      res.metadata || {}
  };
}

function validateProviderResult(res) {
  if (!res || typeof res !== "object") throw new Error("Invalid ProviderResult");
  return {
    id:       String(res.id),
    provider: String(res.provider || ""),
    type:     String(res.type || ""),
    price:    Number(res.price || 0),
    currency: String(res.currency || "INR"),
    status:   String(res.status || "available"),
    details:  res.details || {}
  };
}

module.exports = {
  validateIntent,
  validateRecommendationResponse,
  validateBudgetEstimate,
  validatePlannerInput,
  validatePlannerOutput,
  validateBookingResult,
  validateTrip,
  validateSearchResult,
  validateProviderResult
};

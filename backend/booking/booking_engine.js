const providerRegistry = require("./providers/provider_registry");
const knowledgeService = require("../knowledge/knowledge_service");

// Travel Intelligence OS - Booking Intelligence Engine
class BookingEngine {
  recommendBookings(context) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      const optimizedItinerary = context.recommendations?.optimizedItinerary ?? context.optimizedItinerary ?? context.improvedItinerary ?? context.draftItinerary ?? null;
      if (!optimizedItinerary) {
        throw new Error("No itinerary found in TravelContext for booking recommendations");
      }

      const userPrefs = context.user?.preferences || {};
      const normalized = context.state?.normalizedEntities ?? context.normalizedEntities ?? {};
      const budgetLimit = Number(normalized.budget || userPrefs.budget || 10000);
      const travelStyle = normalized.travelStyle || userPrefs.travelStyle || "mid";
      const travelersType = normalized.travelersType || userPrefs.travelersType || "solo";
      const destinationId = normalized.destination || "goa";

      const dailyPlans = optimizedItinerary.dailyPlans || [];

      // 1. Resolve Stays & Activities from itinerary
      const stayNodeIds = new Set();
      const activityNodeIds = new Set();

      for (const day of dailyPlans) {
        for (const slot of day.slots) {
          if (slot.type === "stay" && slot.nodeId) {
            stayNodeIds.add(slot.nodeId);
          } else if (slot.type === "activity" && slot.nodeId) {
            activityNodeIds.add(slot.nodeId);
          }
        }
      }

      // 2. Query Stays / Hotels
      const hotelProvider = providerRegistry.getProvider("hotel");
      const hotelOptions = hotelProvider ? hotelProvider.getOptions({ destinationId }) : [];
      const rankedHotels = this.rankOptions(hotelOptions, "hotel", travelStyle);
      const recommendedHotels = rankedHotels.slice(0, 1); // Best match

      // 3. Query Transit Options (Flights / Trains / Buses)
      const flightProvider = providerRegistry.getProvider("flight");
      const trainProvider = providerRegistry.getProvider("train");
      const busProvider = providerRegistry.getProvider("bus");

      const flights = flightProvider ? flightProvider.getOptions({ destinationId }) : [];
      const trains = trainProvider ? trainProvider.getOptions({ destinationId }) : [];
      const buses = busProvider ? busProvider.getOptions({ destinationId }) : [];

      let transitOptions = [];
      if (travelStyle === "luxury") {
        transitOptions = this.rankOptions(flights, "transit", travelStyle);
      } else if (travelStyle === "budget") {
        transitOptions = this.rankOptions([...trains, ...buses], "transit", travelStyle);
      } else {
        transitOptions = this.rankOptions([...flights, ...trains], "transit", travelStyle);
      }

      const recommendedTransit = transitOptions.slice(0, 1);

      // 4. Query Rentals
      const rentalProvider = providerRegistry.getProvider("rental");
      const rentals = rentalProvider ? rentalProvider.getOptions({ destinationId, travelStyle }) : [];
      const rankedRentals = this.rankOptions(rentals, "rental", travelStyle);
      const recommendedRentals = rankedRentals.slice(0, 1);

      // 5. Query Activity Tickets
      const activityProvider = providerRegistry.getProvider("activity");
      const recommendedActivities = [];

      for (const actId of activityNodeIds) {
        const offers = activityProvider ? activityProvider.getOptions({ activityId: actId }) : [];
        if (offers.length > 0) {
          const rankedOffers = this.rankOptions(offers, "activity", travelStyle);
          recommendedActivities.push(rankedOffers[0]);
        }
      }

      // 6. Calculate Aggregated Metrics
      let totalBookingCost = 0;
      let totalConfidence = 0;
      let optionsCount = 0;

      const increment = (option) => {
        if (option) {
          totalBookingCost += option.price;
          totalConfidence += option.confidence || 0.95;
          optionsCount++;
        }
      };

      recommendedHotels.forEach(increment);
      recommendedTransit.forEach(increment);
      recommendedRentals.forEach(increment);
      recommendedActivities.forEach(increment);

      const avgConfidence = optionsCount > 0 ? Number((totalConfidence / optionsCount).toFixed(2)) : 1.0;
      const budgetImpactPercent = budgetLimit > 0 ? Number(((totalBookingCost / budgetLimit) * 100).toFixed(1)) : 0;
      
      // Savings calculation (e.g. difference to the maximum price option for stay)
      let estimatedSavings = 0;
      if (hotelOptions.length > 1 && recommendedHotels[0]) {
        const maxHotelPrice = Math.max(...hotelOptions.map(h => h.price));
        estimatedSavings += (maxHotelPrice - recommendedHotels[0].price);
      }

      const budgetSummary = {
        totalBookingCost,
        estimatedSavings,
        budgetImpactPercent,
        confidenceScore: avgConfidence
      };

      const data = {
        recommendedPlaces: recommendedHotels, // maps recommended hotel stays
        recommendedTransit,
        recommendedRentals,
        recommendedActivities,
        budgetSummary,
        confidence: avgConfidence
      };

      return {
        success: true,
        data,
        errors,
        warnings,
        confidence: avgConfidence,
        processingTime: Date.now() - startTime,
        metadata: {
          totalRecommendations: optionsCount
        }
      };

    } catch (err) {
      errors.push(err.message);
      return {
        success: false,
        data: null,
        errors,
        warnings,
        confidence: 0.0,
        processingTime: Date.now() - startTime,
        metadata: {}
      };
    }
  }

  // Deterministic Scoring & Ranking Algorithm
  rankOptions(options, type, travelStyle) {
    if (!options || options.length === 0) return [];

    // Base weights
    let w_price = 0.30;
    let w_rating = 0.30;
    let w_distance = 0.20;
    let w_conf = 0.20;

    if (travelStyle === "budget") {
      w_price = 0.60;
      w_rating = 0.15;
      w_distance = 0.15;
      w_conf = 0.10;
    } else if (travelStyle === "luxury") {
      w_price = 0.10;
      w_rating = 0.50;
      w_distance = 0.20;
      w_conf = 0.20;
    }

    const maxPrice = Math.max(...options.map(o => o.price)) || 1;
    const maxDist = Math.max(...options.map(o => o.distance || 0.1)) || 1;

    const scored = options.map(option => {
      // 1. Price Score (inverse relation)
      const S_price = 100 * (1 - option.price / (maxPrice * 1.2)); // buffer so max price doesn't get 0

      // 2. Rating Score (scale 0-5 to 0-100)
      const S_rating = (option.rating || 4.0) * 20;

      // 3. Distance Score (inverse relation)
      const dist = option.distance !== undefined ? option.distance : 0.5;
      const S_distance = 100 * (1 - dist / (maxDist * 1.2));

      // 4. Policy & Confidence
      const S_policy = option.cancellationPolicy === "free" ? 100 : 50;
      const S_conf = (option.confidence || 0.95) * 100;

      const score = Math.round(
        w_price * S_price +
        w_rating * S_rating +
        w_distance * S_distance +
        0.05 * S_policy +
        w_conf * S_conf
      );

      return { ...option, score };
    });

    // Sort descending by score
    return scored.sort((a, b) => b.score - a.score);
  }
}

module.exports = new BookingEngine();

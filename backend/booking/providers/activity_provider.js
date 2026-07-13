// Abstract interface representing an Activity ticket provider (e.g. Viator / GetYourGuide)
class ActivityProvider {
  constructor(name = "Viator") {
    this.name = name;
  }

  getOptions(params) {
    const { activityId } = params;

    // Default mock offers for our sample attractions
    if (activityId === "goa_attraction_baga_beach") {
      return [
        {
          id: "book_act_water_sports_combo",
          name: "Parasailing & Jet Ski Combo at Baga",
          price: 1800,
          rating: 4.6,
          provider: this.name,
          cancellationPolicy: "free",
          confidence: 0.95
        },
        {
          id: "book_act_scuba_trip",
          name: "Grand Island Scuba Dive Package",
          price: 3200,
          rating: 4.4,
          provider: this.name,
          cancellationPolicy: "free",
          confidence: 0.90
        }
      ];
    }

    if (activityId === "goa_attraction_anjuna_beach") {
      return [
        {
          id: "book_act_anjuna_guided",
          name: "Anjuna Heritage walking Tour",
          price: 500,
          rating: 4.7,
          provider: this.name,
          cancellationPolicy: "free",
          confidence: 0.97
        }
      ];
    }

    return [];
  }
}

module.exports = ActivityProvider;

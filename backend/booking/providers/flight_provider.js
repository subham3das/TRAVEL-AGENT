// Abstract interface representing a Flight pricing provider (e.g. Skyscanner / Amadeus)
class FlightProvider {
  constructor(name = "Skyscanner") {
    this.name = name;
  }

  getOptions(params) {
    const { destinationId = "goa" } = params;

    if (destinationId === "goa") {
      return [
        {
          id: "book_flight_indigo_101",
          name: "IndiGo Flight 101",
          price: 4500,
          rating: 4.3,
          durationMinutes: 150,
          cancellationPolicy: "refundable",
          provider: this.name,
          confidence: 0.96
        },
        {
          id: "book_flight_airindia_302",
          name: "Air India Flight 302",
          price: 6200,
          rating: 4.0,
          durationMinutes: 140,
          cancellationPolicy: "free",
          provider: this.name,
          confidence: 0.97
        }
      ];
    }

    return [];
  }
}

module.exports = FlightProvider;

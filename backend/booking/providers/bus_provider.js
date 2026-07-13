// Abstract interface representing a Bus pricing provider (e.g. RedBus)
class BusProvider {
  constructor(name = "RedBus") {
    this.name = name;
  }

  getOptions(params) {
    const { destinationId = "goa" } = params;

    if (destinationId === "goa") {
      return [
        {
          id: "book_bus_volvo_801",
          name: "Paulo Travels Multi-Axle Volvo",
          price: 1200,
          rating: 4.2,
          durationMinutes: 840,
          cancellationPolicy: "refundable",
          provider: this.name,
          confidence: 0.94
        },
        {
          id: "book_bus_sleeper_902",
          name: "Atmaram Travels Sleeper AC",
          price: 950,
          rating: 3.8,
          durationMinutes: 900,
          cancellationPolicy: "refundable",
          provider: this.name,
          confidence: 0.92
        }
      ];
    }

    return [];
  }
}

module.exports = BusProvider;

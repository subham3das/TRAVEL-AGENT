// Abstract interface representing a Train pricing provider (e.g. IRCTC)
class TrainProvider {
  constructor(name = "IRCTC") {
    this.name = name;
  }

  getOptions(params) {
    const { destinationId = "goa" } = params;

    if (destinationId === "goa") {
      return [
        {
          id: "book_train_express_1201",
          name: "Goa Express 1201 (AC 3 Tier)",
          price: 1800,
          rating: 4.1,
          durationMinutes: 720,
          cancellationPolicy: "refundable",
          provider: this.name,
          confidence: 0.99
        },
        {
          id: "book_train_sleeper_3202",
          name: "Konkan Kanya Sleeper",
          price: 650,
          rating: 3.5,
          durationMinutes: 780,
          cancellationPolicy: "refundable",
          provider: this.name,
          confidence: 0.95
        }
      ];
    }

    return [];
  }
}

module.exports = TrainProvider;

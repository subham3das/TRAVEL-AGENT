// Abstract interface representing a Vehicle Rental provider
class RentalProvider {
  constructor(name = "LocalRentals") {
    this.name = name;
  }

  getOptions(params) {
    const { destinationId = "goa", travelStyle = "mid" } = params;

    if (destinationId === "goa") {
      return [
        {
          id: "book_rental_scooter",
          name: "Honda Activa Scooter (Self Drive)",
          price: 400, // per day
          rating: 4.5,
          provider: this.name,
          cancellationPolicy: "free",
          confidence: 0.98
        },
        {
          id: "book_rental_hatchback",
          name: "Maruti Swift Car (Self Drive)",
          price: 1500, // per day
          rating: 4.2,
          provider: this.name,
          cancellationPolicy: "free",
          confidence: 0.95
        },
        {
          id: "book_rental_luxury_suv",
          name: "Toyota Fortuner (Chauffeur)",
          price: 4500, // per day
          rating: 4.8,
          provider: this.name,
          cancellationPolicy: "free",
          confidence: 0.99
        }
      ];
    }

    return [];
  }
}

module.exports = RentalProvider;

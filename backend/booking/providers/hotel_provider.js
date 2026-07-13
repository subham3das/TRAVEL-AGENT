// Abstract interface representing a Hotel pricing provider (e.g. Booking.com / Agoda)
class HotelProvider {
  constructor(name = "Booking.com") {
    this.name = name;
  }

  getOptions(params) {
    const { destinationId = "goa", budget = 5000 } = params;

    // Return deterministic mock options based on destination
    if (destinationId === "goa") {
      return [
        {
          id: "book_hotel_taj_exotica",
          name: "Taj Exotica Resort & Spa",
          price: 18000,
          rating: 4.8,
          distance: 0.1, // km to beach
          cancellationPolicy: "free",
          provider: this.name,
          confidence: 0.98
        },
        {
          id: "book_hotel_goa_beach_inn",
          name: "Goa Beach Inn",
          price: 2500,
          rating: 4.2,
          distance: 0.5,
          cancellationPolicy: "free",
          provider: this.name,
          confidence: 0.95
        },
        {
          id: "book_hotel_backpacker_hostel",
          name: "Goa Backpacker Hostel",
          price: 900,
          rating: 3.9,
          distance: 1.2,
          cancellationPolicy: "non-refundable",
          provider: this.name,
          confidence: 0.90
        }
      ];
    }

    return [];
  }
}

module.exports = HotelProvider;

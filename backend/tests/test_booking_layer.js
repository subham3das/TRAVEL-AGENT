require("../knowledge/knowledge_service.js").loadKnowledge();
const { BookingIntent, HotelRequest, FlightRequest, TaxiRequest, ActivityRequest } = require("../booking/domain/booking_intent");
const bookingLayer = require("../booking/booking_layer");

(async () => {
  const intent = BookingIntent({
    tripId: "trip-test-1",
    userId: "user-test-1",
    destination: "goa",
    startDate: "2026-08-15",
    endDate: "2026-08-19",
    durationDays: 4,
    travelStyle: "mid",
    travelersType: "couple",
    budget: 80000,
    hotel: HotelRequest({
      destinationId: "goa",
      checkIn: "2026-08-15",
      checkOut: "2026-08-19",
      style: "mid",
      adults: 2
    }),
    flight: FlightRequest({
      origin: "DEL",
      destination: "GOI",
      departureDate: "2026-08-15",
      returnDate: "2026-08-19",
      passengers: 2,
      cabinClass: "economy"
    }),
    taxi: TaxiRequest({
      origin: "Goa Airport",
      destination: "Baga Beach Hotel",
      date: "2026-08-15",
      vehicleType: "sedan"
    }),
    activities: [
      ActivityRequest({ name: "Snorkeling at Grand Island", date: "2026-08-16", participants: 2 }),
      ActivityRequest({ name: "Spice Plantation Tour", date: "2026-08-17", participants: 2 })
    ]
  });

  console.log("=== BookingIntent ===");
  console.log("Intent ID:", intent.intentId);
  console.log("Types: hotel, flight, taxi, 2 activities");

  const result = await bookingLayer.process(intent, {
    name: "Test User",
    email: "test@example.com",
    phone: "+91-9876543210"
  });

  console.log("\n=== ReservationSet ===");
  console.log("Overall Status:", result.overallStatus);
  console.log("Total Cost: INR " + result.totalCost.toLocaleString("en-IN"));
  console.log("Reservations:", result.reservations.length);

  for (const r of result.reservations) {
    console.log("  [" + r.type + "] " + r.status + " | " + r.confirmationCode + " | INR " + r.price + " | " + r.provider);
  }
})();

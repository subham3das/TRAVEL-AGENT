/**
 * Travel OS — Flight Booker
 *
 * Independent flight booking adapter.
 * Receives FlightRequest, searches providers, returns Reservation.
 *
 * The Planner never calls this directly.
 * The BookingLayer routes FlightRequests here.
 */

"use strict";

const BaseBooker = require("./base_booker");
const { Reservation } = require("../domain/reservation");
const searchLayer = require("../../search/search_layer");

class FlightBooker extends BaseBooker {
  constructor() {
    super("FlightBooker", "flight");
  }

  async search(request, abortSignal = null) {
    const startTime = Date.now();

    try {
      const results = await searchLayer.search("flight", {
        destinationId: request.destination,
        origin: request.origin,
        startDate: request.departureDate,
        travelers: request.passengers || 1,
        cabinClass: request.cabinClass,
        maxPrice: request.maxPrice,
        flexible: request.flexible
      }, null, abortSignal);

      this.recordSuccess();

      // Normalize to flight options
      return (results.results || []).map(r => ({
        id: r.id,
        provider: r.source || "amadeus",
        airline: r.metadata?.airline || r.title,
        flightNumber: r.metadata?.flightNumber,
        origin: request.origin,
        destination: request.destination,
        departureTime: r.metadata?.departureTime,
        arrivalTime: r.metadata?.arrivalTime,
        duration: r.metadata?.duration,
        stops: r.metadata?.stops,
        price: r.pricing?.price || 0,
        currency: r.pricing?.currency || "INR",
        cabinClass: request.cabinClass,
        image: r.images?.[0],
        rating: r.metadata?.rating,
        confidence: r.confidence?.score || 0.9,
        raw: r
      }));
    } catch (err) {
      this.recordFailure();
      console.error(`[FlightBooker] Search failed: ${err.message}`);
      return [];
    }
  }

  async book(option, userDetails, abortSignal = null) {
    const startTime = Date.now();

    try {
      // In production, this would call the actual Amadeus/airline booking API
      // For now, generate a structured reservation
      const confirmationCode = this._generateConfirmation();

      this.recordSuccess();

      return Reservation({
        intentId: userDetails.intentId || "",
        type: "flight",
        provider: option.provider || "amadeus",
        status: "CONFIRMED",
        confirmationCode,
        reference: option.id,
        price: option.price || 0,
        currency: option.currency || "INR",
        details: {
          airline: option.airline,
          flightNumber: option.flightNumber,
          origin: option.origin,
          destination: option.destination,
          departureTime: option.departureTime,
          arrivalTime: option.arrivalTime,
          duration: option.duration,
          stops: option.stops,
          cabinClass: option.cabinClass,
          passengerName: userDetails.name || "",
          passengerEmail: userDetails.email || ""
        },
        bookedAt: new Date().toISOString()
      });
    } catch (err) {
      this.recordFailure();
      return Reservation({
        intentId: userDetails.intentId || "",
        type: "flight",
        provider: option.provider || "unknown",
        status: "FAILED",
        error: err.message,
        price: 0
      });
    }
  }

  async cancel(reservationId, abortSignal = null) {
    // Production: call airline cancellation API
    return { success: true, refundAmount: 0 };
  }

  async status(reservationId) {
    return { status: "CONFIRMED", details: {} };
  }

  _generateConfirmation() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }
}

module.exports = FlightBooker;

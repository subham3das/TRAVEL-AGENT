/**
 * Travel OS — Taxi Booker
 *
 * Independent taxi/transfer booking adapter.
 * Receives TaxiRequest, searches providers, returns Reservation.
 *
 * The Planner never calls this directly.
 * The BookingLayer routes TaxiRequests here.
 */

"use strict";

const BaseBooker = require("./base_booker");
const { Reservation } = require("../domain/reservation");

class TaxiBooker extends BaseBooker {
  constructor() {
    super("TaxiBooker", "taxi");
  }

  async search(request, abortSignal = null) {
    try {
      // In production: call Ola/Uber/local taxi APIs
      // For now: deterministic options based on vehicle type and distance
      const options = this._generateOptions(request);
      this.recordSuccess();
      return options;
    } catch (err) {
      this.recordFailure();
      console.error(`[TaxiBooker] Search failed: ${err.message}`);
      return [];
    }
  }

  async book(option, userDetails, abortSignal = null) {
    try {
      const confirmationCode = this._generateConfirmation();

      this.recordSuccess();

      return Reservation({
        intentId: userDetails.intentId || "",
        type: "taxi",
        provider: option.provider || "local_taxi",
        status: "CONFIRMED",
        confirmationCode,
        reference: option.id,
        price: option.price || 0,
        currency: option.currency || "INR",
        details: {
          vehicleType: option.vehicleType,
          origin: option.origin,
          destination: option.destination,
          date: option.date,
          time: option.time,
          estimatedDuration: option.duration,
          passengerName: userDetails.name || "",
          passengerPhone: userDetails.phone || "",
          pickupLocation: userDetails.pickupLocation || option.origin
        },
        bookedAt: new Date().toISOString()
      });
    } catch (err) {
      this.recordFailure();
      return Reservation({
        intentId: userDetails.intentId || "",
        type: "taxi",
        provider: option.provider || "unknown",
        status: "FAILED",
        error: err.message,
        price: 0
      });
    }
  }

  async cancel(reservationId, abortSignal = null) {
    return { success: true, refundAmount: 0 };
  }

  async status(reservationId) {
    return { status: "CONFIRMED", details: {} };
  }

  _generateOptions(request) {
    const vehiclePricing = {
      sedan: { base: 800, perKm: 12, name: "Sedan" },
      suv:   { base: 1200, perKm: 18, name: "SUV" },
      auto:  { base: 300, perKm: 7, name: "Auto Rickshaw" },
      tempo: { base: 2000, perKm: 25, name: "Tempo Traveller" }
    };

    const vehicles = Object.entries(vehiclePricing).map(([type, pricing]) => ({
      id: `taxi-${type}-${Date.now()}`,
      provider: "local_taxi",
      vehicleType: type,
      name: pricing.name,
      origin: request.origin,
      destination: request.destination,
      date: request.date,
      time: request.time,
      price: pricing.base,
      currency: "INR",
      capacity: type === "sedan" ? 4 : type === "suv" ? 6 : type === "auto" ? 3 : 12,
      duration: "30-45 min",
      includes: ["AC", "Professional Driver"]
    }));

    return vehicles;
  }

  _generateConfirmation() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "TX-";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }
}

module.exports = TaxiBooker;

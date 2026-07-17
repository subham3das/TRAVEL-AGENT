/**
 * Travel OS — Flight Provider
 *
 * Implements the frozen BaseProvider interface.
 * Returns ProviderResult domain shapes.
 */

"use strict";

const { ProviderResult } = require("../../domain/models");
const capabilityRegistry = require("../../registry/capability_registry");

const BaseProvider = require("./base_provider");

class FlightProvider extends BaseProvider {
  constructor(name = "Skyscanner") {
    super(name);
    capabilityRegistry.register("FlightProvider", { flightSearch: true });
  }

  /**
   * Search flights.
   * Conforms to frozen BaseProvider interface.
   * Returns ProviderResult[]
   */
  async search(params, abortSignal = null) {
    if (abortSignal && abortSignal.aborted) {
      throw new Error("Flight search aborted.");
    }

    const { destinationId = "goa", origin = "DEL", travelStyle = "mid" } = params;
    
    this.successCount++;
    this.lastSuccess = new Date().toISOString();

    const hash = destinationId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const baseDurationHrs = 1 + (hash % 4);
    const baseDurationMins = 15 + (hash % 45);
    const durationStr = `${baseDurationHrs}h ${baseDurationMins}m`;
    
    const basePrice = travelStyle === "luxury" ? 18000 : travelStyle === "budget" ? 3500 : 6500;
    
    const airlines = [
      { code: "6E", name: "IndiGo" },
      { code: "AI", name: "Air India" }
    ];

    return airlines.map((air, idx) => {
      const flightNum = `${air.code}-${100 + (hash % 800) + idx}`;
      const price = Math.round(basePrice * (1 + (idx * 0.15)));
      
      return ProviderResult({
        id:       `${destinationId}-flight-${idx + 1}`,
        provider: this.name,
        type:     "flight",
        price,
        currency: "INR",
        status:   "available",
        details: {
          airline: air.name,
          flightNumber: flightNum,
          origin,
          destination: destinationId.toUpperCase(),
          duration: durationStr,
          stops: idx === 0 ? 0 : 1,
          departureTime: idx === 0 ? "07:15 AM" : "10:30 AM"
        }
      });
    });
  }

  async details(id, abortSignal = null) {
    return { id, provider: this.name, type: "flight", details: { info: "Details placeholder" } };
  }

  async availability(id, abortSignal = null) {
    return { id, status: "available", source: this.name };
  }

  async book(id, user) {
    return {
      id: `book-${Date.now()}`,
      provider: this.name,
      type: "flight",
      status: "CONFIRMED",
      price: 6500,
      currency: "INR",
      confirmationCode: `CONF-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    };
  }

  async health() {
    const total = this.successCount + this.failuresCount;
    const failureRate = total > 0 ? this.failuresCount / total : 0;
    return {
      status: failureRate > 0.5 ? "unhealthy" : "healthy",
      latency: 210, // ms
      lastSuccess: this.lastSuccess,
      failureRate
    };
  }

  async capabilities() {
    return { flightSearch: true };
  }

  // Legacy compat
  getOptions(params) {
    const { destinationId = "goa", travelStyle = "mid" } = params;
    const basePrice = travelStyle === "luxury" ? 15000 : travelStyle === "budget" ? 4200 : 7500;
    return [
      {
        id: `${destinationId}-flight-opt1`,
        name: `IndiGo Flight to ${destinationId}`,
        price: basePrice,
        rating: 4.2,
        durationMinutes: 150,
        cancellationPolicy: "refundable",
        provider: this.name,
        confidence: 0.95
      }
    ];
  }
}

module.exports = FlightProvider;

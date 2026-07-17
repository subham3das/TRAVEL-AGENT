/**
 * Travel OS — Bus Provider
 *
 * Implements the frozen BaseProvider interface.
 * Returns ProviderResult shapes.
 */

"use strict";

const BaseProvider = require("./base_provider");
const { ProviderResult } = require("../../domain/models");

class BusProvider extends BaseProvider {
  constructor(name = "RedBus") {
    super(name);
  }

  /**
   * Search buses for a destination.
   * Conforms to BaseProvider interface.
   */
  async search(params, abortSignal = null) {
    if (abortSignal && abortSignal.aborted) {
      throw new Error("Bus search aborted.");
    }

    const { destinationId = "goa", travelStyle = "mid" } = params;
    const destLabel = destinationId.charAt(0).toUpperCase() + destinationId.slice(1);
    
    this.successCount++;
    this.lastSuccess = new Date().toISOString();

    const basePrice = travelStyle === "luxury" ? 2200 : travelStyle === "budget" ? 600 : 1200;

    return [
      ProviderResult({
        id: `book_bus_${destinationId}_volvo`,
        provider: this.name,
        type: "bus",
        price: basePrice,
        currency: "INR",
        status: "available",
        details: {
          name: `Paulo Travels Volvo AC to ${destLabel}`,
          duration: "8 hours",
          cancellationPolicy: "refundable"
        }
      }),
      ProviderResult({
        id: `book_bus_${destinationId}_sleeper`,
        provider: this.name,
        type: "bus",
        price: Math.round(basePrice * 0.8),
        currency: "INR",
        status: "available",
        details: {
          name: `Atmaram AC Sleeper to ${destLabel}`,
          duration: "9 hours",
          cancellationPolicy: "refundable"
        }
      })
    ];
  }

  async details(id, abortSignal = null) {
    return { id, provider: this.name, type: "bus", details: { info: "Bus details" } };
  }

  async availability(id, abortSignal = null) {
    return { id, status: "available", source: this.name };
  }

  async book(id, user) {
    return {
      id: `book-${Date.now()}`,
      provider: this.name,
      type: "bus",
      status: "CONFIRMED",
      price: 1200,
      currency: "INR",
      confirmationCode: `CONF-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    };
  }

  async capabilities() {
    return { busSearch: true };
  }

  // Legacy compatibility
  getOptions(params) {
    const { destinationId = "goa", travelStyle = "mid" } = params;
    const destLabel = destinationId.charAt(0).toUpperCase() + destinationId.slice(1);
    const basePrice = travelStyle === "luxury" ? 2200 : travelStyle === "budget" ? 600 : 1200;
    return [
      {
        id: `book_bus_${destinationId}_volvo`,
        name: `Paulo Travels Volvo AC to ${destLabel}`,
        price: basePrice,
        rating: 4.2,
        durationMinutes: 480,
        cancellationPolicy: "refundable",
        provider: this.name,
        confidence: 0.94
      }
    ];
  }
}

module.exports = BusProvider;

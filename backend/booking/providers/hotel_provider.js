/**
 * Travel OS — Hotel Provider
 *
 * Implements the frozen BaseProvider interface.
 * Returns ProviderResult domain shapes.
 */

"use strict";

const knowledgeRepository = require("../../repository/knowledge_repository");
const { ProviderResult } = require("../../domain/models");
const capabilityRegistry = require("../../registry/capability_registry");

const BaseProvider = require("./base_provider");

class HotelProvider extends BaseProvider {
  constructor(name = "Booking.com") {
    super(name);
    capabilityRegistry.register("HotelProvider", { hotelSearch: true });
  }

  /**
   * Search hotels for a destination.
   * Conforms to frozen BaseProvider interface.
   * Returns ProviderResult[]
   */
  async search(params, abortSignal = null) {
    if (abortSignal && abortSignal.aborted) {
      throw new Error("Hotel search aborted.");
    }

    const { destinationId = "goa", travelStyle = "mid" } = params;
    
    // Simulate query to static database facts
    const facts = await knowledgeRepository.getHotelFacts(destinationId);
    
    this.successCount++;
    this.lastSuccess = new Date().toISOString();

    const basePrice = travelStyle === "luxury" ? 15000 : travelStyle === "budget" ? 1800 : 4500;

    if (facts && facts.length > 0) {
      return facts.map((f, idx) => ProviderResult({
        id:       f.id,
        provider: this.name,
        type:     "hotel",
        price:    Math.round(basePrice * (1 + (idx * 0.15))),
        currency: "INR",
        status:   "available",
        details: {
          name: f.name,
          stars: f.stars || (travelStyle === "luxury" ? 5 : travelStyle === "budget" ? 2 : 3),
          amenities: f.amenities || [],
          location: f.location,
          description: f.description
        }
      }));
    }

    // Dynamic generation if no KG hotels exist
    const destinationName = destinationId.charAt(0).toUpperCase() + destinationId.slice(1);
    
    return [
      ProviderResult({
        id: `${destinationId}-hotel-opt1`,
        provider: this.name,
        type: "hotel",
        price: basePrice,
        currency: "INR",
        status: "available",
        details: {
          name: travelStyle === "luxury" ? "The Royal Palms Resort" : travelStyle === "budget" ? "Comfort Inn" : "The Olive Suites",
          stars: travelStyle === "luxury" ? 5 : travelStyle === "budget" ? 2 : 3,
          amenities: ["Free WiFi", "Breakfast Included"],
          location: `City Center, ${destinationName}`,
          description: `Comfortable ${travelStyle} lodging.`
        }
      })
    ];
  }

  async details(id, abortSignal = null) {
    return { id, provider: this.name, type: "hotel", details: { info: "Details placeholder" } };
  }

  async availability(id, abortSignal = null) {
    return { id, status: "available", source: this.name };
  }

  async book(id, user) {
    return {
      id: `book-${Date.now()}`,
      provider: this.name,
      type: "hotel",
      status: "CONFIRMED",
      price: 4500,
      currency: "INR",
      confirmationCode: `CONF-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    };
  }

  async health() {
    const total = this.successCount + this.failuresCount;
    const failureRate = total > 0 ? this.failuresCount / total : 0;
    return {
      status: failureRate > 0.5 ? "unhealthy" : "healthy",
      latency: 120, // ms
      lastSuccess: this.lastSuccess,
      failureRate
    };
  }

  async capabilities() {
    return { hotelSearch: true };
  }

  // Legacy compat
  getOptions(params) {
    const { destinationId = "goa", travelStyle = "mid" } = params;
    const basePrice = travelStyle === "luxury" ? 15000 : travelStyle === "budget" ? 1800 : 4500;
    return [
      {
        id: `${destinationId}-hotel-opt1`,
        name: travelStyle === "luxury" ? "The Royal Palms Resort" : travelStyle === "budget" ? "Comfort Inn" : "The Olive Suites",
        price: basePrice,
        rating: travelStyle === "luxury" ? 4.8 : travelStyle === "budget" ? 3.9 : 4.3,
        cancellationPolicy: "free",
        provider: this.name,
        confidence: 0.90
      }
    ];
  }
}

module.exports = HotelProvider;

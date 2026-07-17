/**
 * Travel OS — Train Provider
 *
 * Implements the frozen BaseProvider interface.
 * Returns ProviderResult shapes.
 */

"use strict";

const BaseProvider = require("./base_provider");
const { ProviderResult } = require("../../domain/models");

class TrainProvider extends BaseProvider {
  constructor(name = "IRCTC") {
    super(name);
  }

  /**
   * Search trains.
   * Conforms to BaseProvider interface.
   */
  async search(params, abortSignal = null) {
    if (abortSignal && abortSignal.aborted) {
      throw new Error("Train search aborted.");
    }

    const { destinationId = "goa", travelStyle = "mid" } = params;
    const destLabel = destinationId.charAt(0).toUpperCase() + destinationId.slice(1);
    
    this.successCount++;
    this.lastSuccess = new Date().toISOString();

    const basePrice = travelStyle === "luxury" ? 2800 : travelStyle === "budget" ? 450 : 1200;

    return [
      ProviderResult({
        id: `book_train_${destinationId}_express`,
        provider: this.name,
        type: "train",
        price: basePrice,
        currency: "INR",
        status: "available",
        details: {
          name: `${destLabel} Express (AC 3 Tier)`,
          duration: "10 hours",
          cancellationPolicy: "refundable"
        }
      }),
      ProviderResult({
        id: `book_train_${destinationId}_sleeper`,
        provider: this.name,
        type: "train",
        price: Math.round(basePrice * 0.45),
        currency: "INR",
        status: "available",
        details: {
          name: `Konkan Kanya Sleeper to ${destLabel}`,
          duration: "11 hours",
          cancellationPolicy: "refundable"
        }
      })
    ];
  }

  async details(id, abortSignal = null) {
    return { id, provider: this.name, type: "train", details: { info: "Train details" } };
  }

  async availability(id, abortSignal = null) {
    return { id, status: "available", source: this.name };
  }

  async book(id, user) {
    return {
      id: `book-${Date.now()}`,
      provider: this.name,
      type: "train",
      status: "CONFIRMED",
      price: 1200,
      currency: "INR",
      confirmationCode: `CONF-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    };
  }

  async capabilities() {
    return { trainSearch: true };
  }

  // Legacy compatibility
  getOptions(params) {
    const { destinationId = "goa", travelStyle = "mid" } = params;
    const destLabel = destinationId.charAt(0).toUpperCase() + destinationId.slice(1);
    const basePrice = travelStyle === "luxury" ? 2800 : travelStyle === "budget" ? 450 : 1200;
    return [
      {
        id: `book_train_${destinationId}_express`,
        name: `${destLabel} Express (AC 3 Tier)`,
        price: basePrice,
        rating: 4.1,
        durationMinutes: 600,
        cancellationPolicy: "refundable",
        provider: this.name,
        confidence: 0.99
      }
    ];
  }
}

module.exports = TrainProvider;

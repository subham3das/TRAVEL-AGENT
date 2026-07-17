/**
 * Travel OS — Rental Provider
 *
 * Implements the frozen BaseProvider interface.
 * Returns ProviderResult shapes.
 */

"use strict";

const BaseProvider = require("./base_provider");
const { ProviderResult } = require("../../domain/models");

class RentalProvider extends BaseProvider {
  constructor(name = "LocalRentals") {
    super(name);
  }

  /**
   * Search rentals.
   * Conforms to BaseProvider interface.
   */
  async search(params, abortSignal = null) {
    if (abortSignal && abortSignal.aborted) {
      throw new Error("Rental search aborted.");
    }

    const { destinationId = "goa", travelStyle = "mid" } = params;
    const destLabel = destinationId.charAt(0).toUpperCase() + destinationId.slice(1);
    
    this.successCount++;
    this.lastSuccess = new Date().toISOString();

    const basePrice = travelStyle === "luxury" ? 4500 : travelStyle === "budget" ? 400 : 1500;

    return [
      ProviderResult({
        id: `book_rental_${destinationId}_scooter`,
        provider: this.name,
        type: "rental",
        price: travelStyle === "budget" ? 400 : 600,
        currency: "INR",
        status: "available",
        details: {
          name: `Honda Activa Scooter in ${destLabel} (Self Drive)`,
          cancellationPolicy: "free"
        }
      }),
      ProviderResult({
        id: `book_rental_${destinationId}_car`,
        provider: this.name,
        type: "rental",
        price: basePrice,
        currency: "INR",
        status: "available",
        details: {
          name: `Maruti Swift in ${destLabel} (Self Drive)`,
          cancellationPolicy: "free"
        }
      }),
      ProviderResult({
        id: `book_rental_${destinationId}_luxury`,
        provider: this.name,
        type: "rental",
        price: travelStyle === "luxury" ? 4500 : 6000,
        currency: "INR",
        status: "available",
        details: {
          name: `Toyota Fortuner in ${destLabel} (Chauffeur)`,
          cancellationPolicy: "free"
        }
      })
    ];
  }

  async details(id, abortSignal = null) {
    return { id, provider: this.name, type: "rental", details: { info: "Rental details" } };
  }

  async availability(id, abortSignal = null) {
    return { id, status: "available", source: this.name };
  }

  async book(id, user) {
    return {
      id: `book-${Date.now()}`,
      provider: this.name,
      type: "rental",
      status: "CONFIRMED",
      price: 1500,
      currency: "INR",
      confirmationCode: `CONF-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    };
  }

  async capabilities() {
    return { rentalSearch: true };
  }

  // Legacy compatibility
  getOptions(params) {
    const { destinationId = "goa", travelStyle = "mid" } = params;
    const destLabel = destinationId.charAt(0).toUpperCase() + destinationId.slice(1);
    const basePrice = travelStyle === "luxury" ? 4500 : travelStyle === "budget" ? 400 : 1500;
    return [
      {
        id: `book_rental_${destinationId}_car`,
        name: `Maruti Swift in ${destLabel} (Self Drive)`,
        price: basePrice,
        rating: 4.2,
        provider: this.name,
        cancellationPolicy: "free",
        confidence: 0.95
      }
    ];
  }
}

module.exports = RentalProvider;

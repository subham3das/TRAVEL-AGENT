/**
 * Travel OS — Activity Provider
 *
 * Implements the frozen BaseProvider interface.
 * Returns ProviderResult shapes.
 */

"use strict";

const BaseProvider = require("./base_provider");
const { ProviderResult } = require("../../domain/models");
const knowledgeRepository = require("../../repository/knowledge_repository");

class ActivityProvider extends BaseProvider {
  constructor(name = "Viator") {
    super(name);
  }

  /**
   * Search activities.
   * Conforms to BaseProvider interface.
   */
  async search(params, abortSignal = null) {
    if (abortSignal && abortSignal.aborted) {
      throw new Error("Activity search aborted.");
    }

    const { destinationId = "goa" } = params;

    // Fetch static facts from Knowledge Repository
    const attractions = await knowledgeRepository.getAttractions(destinationId);
    
    this.successCount++;
    this.lastSuccess = new Date().toISOString();

    if (attractions && attractions.length > 0) {
      return attractions.map((a, idx) => {
        const ticketVal = a.priceLabel ? parseInt(String(a.priceLabel).replace(/\D/g, ""), 10) : 500;
        return ProviderResult({
          id:       a.id,
          provider: this.name,
          type:     "activity",
          price:    isNaN(ticketVal) ? 500 : ticketVal,
          currency: "INR",
          status:   "available",
          details: {
            name: a.name,
            duration: a.duration || "2-3 hours",
            category: a.type
          }
        });
      });
    }

    // Default dynamic generated option
    const destLabel = destinationId.charAt(0).toUpperCase() + destinationId.slice(1);
    return [
      ProviderResult({
        id: `${destinationId}-act-opt1`,
        provider: this.name,
        type: "activity",
        price: 800,
        currency: "INR",
        status: "available",
        details: {
          name: `Sightseeing Tour of ${destLabel}`,
          duration: "4 hours",
          category: "sightseeing"
        }
      })
    ];
  }

  async details(id, abortSignal = null) {
    return { id, provider: this.name, type: "activity", details: { info: "Activity details" } };
  }

  async availability(id, abortSignal = null) {
    return { id, status: "available", source: this.name };
  }

  async book(id, user) {
    return {
      id: `book-${Date.now()}`,
      provider: this.name,
      type: "activity",
      status: "CONFIRMED",
      price: 800,
      currency: "INR",
      confirmationCode: `CONF-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    };
  }

  async capabilities() {
    return { activitySearch: true };
  }

  // Legacy compatibility
  getOptions(params) {
    const { destinationId = "goa" } = params;
    return [
      {
        id: `book_activity_${destinationId}_tour`,
        name: `Sightseeing Tour in ${destinationId}`,
        price: 800,
        rating: 4.5,
        provider: this.name,
        confidence: 0.95
      }
    ];
  }
}

module.exports = ActivityProvider;

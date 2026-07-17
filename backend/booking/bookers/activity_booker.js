/**
 * Travel OS — Activity Booker
 *
 * Independent activity/experience booking adapter.
 * Receives ActivityRequest, searches providers, returns Reservation.
 *
 * The Planner never calls this directly.
 * The BookingLayer routes ActivityRequests here.
 */

"use strict";

const BaseBooker = require("./base_booker");
const { Reservation } = require("../domain/reservation");
const searchLayer = require("../../search/search_layer");

class ActivityBooker extends BaseBooker {
  constructor() {
    super("ActivityBooker", "activity");
  }

  async search(request, abortSignal = null) {
    try {
      const results = await searchLayer.search("activity", {
        destinationId: request.activityId,
        query: request.name,
        category: request.category,
        maxPrice: request.maxPrice
      }, null, abortSignal);

      this.recordSuccess();

      return (results.results || []).map(r => ({
        id: r.id,
        provider: r.source || "viator",
        name: r.title,
        location: r.location,
        category: r.metadata?.category || request.category,
        price: r.pricing?.price || 0,
        currency: r.pricing?.currency || "INR",
        rating: r.metadata?.rating || r.rating,
        duration: r.metadata?.duration,
        description: r.metadata?.description,
        images: r.images || [],
        confidence: r.confidence?.score || 0.9,
        raw: r
      }));
    } catch (err) {
      this.recordFailure();
      console.error(`[ActivityBooker] Search failed: ${err.message}`);
      return [];
    }
  }

  async book(option, userDetails, abortSignal = null) {
    try {
      const confirmationCode = this._generateConfirmation();

      this.recordSuccess();

      return Reservation({
        intentId: userDetails.intentId || "",
        type: "activity",
        provider: option.provider || "viator",
        status: "CONFIRMED",
        confirmationCode,
        reference: option.id,
        price: option.price || 0,
        currency: option.currency || "INR",
        details: {
          name: option.name,
          location: option.location,
          category: option.category,
          date: userDetails.activityDate,
          time: userDetails.activityTime,
          participants: userDetails.participants || 1,
          participantName: userDetails.name || "",
          participantEmail: userDetails.email || ""
        },
        bookedAt: new Date().toISOString()
      });
    } catch (err) {
      this.recordFailure();
      return Reservation({
        intentId: userDetails.intentId || "",
        type: "activity",
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

  _generateConfirmation() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "ACT-";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }
}

module.exports = ActivityBooker;

/**
 * Travel OS — Hotel Booker
 *
 * Independent hotel booking adapter.
 * Receives HotelRequest, searches providers, returns Reservation.
 *
 * The Planner never calls this directly.
 * The BookingLayer routes HotelRequests here.
 */

"use strict";

const BaseBooker = require("./base_booker");
const { Reservation } = require("../domain/reservation");
const searchLayer = require("../../search/search_layer");

class HotelBooker extends BaseBooker {
  constructor() {
    super("HotelBooker", "hotel");
  }

  async search(request, abortSignal = null) {
    try {
      const results = await searchLayer.search("hotel", {
        destinationId: request.destinationId,
        checkIn: request.checkIn,
        checkOut: request.checkOut,
        adults: request.adults,
        rooms: request.rooms,
        travelStyle: request.style,
        maxPrice: request.maxPrice,
        amenities: request.amenities
      }, null, abortSignal);

      this.recordSuccess();

      return (results.results || []).map(r => ({
        id: r.id,
        provider: r.source || "booking_com",
        name: r.title,
        location: r.location,
        coordinates: r.coordinates,
        stars: r.metadata?.stars,
        rating: r.rating || r.metadata?.rating,
        reviewCount: r.metadata?.reviewCount,
        price: r.pricing?.price || 0,
        pricePerNight: r.pricing?.price || 0,
        currency: r.pricing?.currency || "INR",
        amenities: r.metadata?.amenities || [],
        images: r.images || [],
        cancellationPolicy: r.availability?.metadata?.cancellationPolicy,
        roomsLeft: r.availability?.metadata?.roomsLeft,
        confidence: r.confidence?.score || 0.9,
        raw: r
      }));
    } catch (err) {
      this.recordFailure();
      console.error(`[HotelBooker] Search failed: ${err.message}`);
      return [];
    }
  }

  async book(option, userDetails, abortSignal = null) {
    try {
      const confirmationCode = this._generateConfirmation();

      this.recordSuccess();

      return Reservation({
        intentId: userDetails.intentId || "",
        type: "hotel",
        provider: option.provider || "booking_com",
        status: "CONFIRMED",
        confirmationCode,
        reference: option.id,
        price: option.price || 0,
        currency: option.currency || "INR",
        details: {
          name: option.name,
          location: option.location,
          stars: option.stars,
          checkIn: userDetails.checkIn,
          checkOut: userDetails.checkOut,
          rooms: userDetails.rooms || 1,
          nights: userDetails.nights || 1,
          guestName: userDetails.name || "",
          guestEmail: userDetails.email || "",
          cancellationPolicy: option.cancellationPolicy
        },
        cancelUrl: option.cancelUrl || null,
        bookedAt: new Date().toISOString()
      });
    } catch (err) {
      this.recordFailure();
      return Reservation({
        intentId: userDetails.intentId || "",
        type: "hotel",
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
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }
}

module.exports = HotelBooker;

/**
 * Travel OS — Booking.com Provider
 *
 * Adapter for Booking.com API.
 * Supports: hotel search.
 * Normalizes Booking.com responses to NormalizedResult.
 */

"use strict";

const https = require("https");
const SearchProviderBase = require("./search_provider_base");

class BookingProvider extends SearchProviderBase {
  constructor() {
    super("booking_com", {
      priority: 88,
      supportedTypes: ["hotel"],
      timeout: 10000
    });
    this.apiKey = process.env.BOOKING_API_KEY || "";
    this.baseUrl = "https://api.booking.com";
  }

  async search(criteria, abortSignal = null) {
    if (!this.apiKey) {
      console.warn("[Booking] No API key configured — returning empty results");
      return [];
    }

    if (abortSignal && abortSignal.aborted) return [];

    const { destinationId, filters = {} } = criteria;

    const params = new URLSearchParams({
      dest_id: destinationId,
      checkin: filters.checkIn || this._defaultCheckIn(),
      checkout: filters.checkOut || this._defaultCheckOut(),
      group_adults: String(filters.adults || 1),
      group_children: String(filters.children || 0),
      no_rooms: String(filters.rooms || 1),
      order: "popularity",
      lang: "en-us",
      results_per_page: String(filters.limit || 10)
    });

    if (filters.minPrice) params.set("min_price", String(filters.minPrice));
    if (filters.maxPrice) params.set("max_price", String(filters.maxPrice));
    if (filters.stars) params.set("nflt", `class=${filters.stars}`);

    const startMs = Date.now();

    try {
      const data = await this._request("GET", `/availability?${params}`, null, abortSignal);
      this.recordSuccess(Date.now() - startMs);

      if (!data.result || !Array.isArray(data.result)) return [];
      return data.result.map(hotel => this._normalize(hotel));
    } catch (err) {
      this.recordFailure(err);
      console.error(`[Booking] Search failed: ${err.message}`);
      return [];
    }
  }

  _normalize(hotel) {
    return {
      id: `booking_${hotel.hotel_id || hotel.id}`,
      provider: this.name,
      type: "hotel",
      title: hotel.hotel_name || hotel.name || "",
      location: hotel.address || "",
      coordinates: hotel.latitude && hotel.longitude
        ? { latitude: Number(hotel.latitude), longitude: Number(hotel.longitude) }
        : null,
      rating: hotel.review_score ? Number((hotel.review_score / 2).toFixed(1)) : null,
      reviewCount: hotel.review_count || 0,
      price: Number(hotel.min_price || 0),
      currency: hotel.currency_code || "INR",
      stars: hotel.class || null,
      amenities: hotel.facilities || [],
      images: (hotel.photos || []).slice(0, 3).map(p => p.url || p),
      description: hotel.description || "",
      openNow: null,
      status: "available",
      raw: hotel
    };
  }

  _defaultCheckIn() {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  }

  _defaultCheckOut() {
    const d = new Date();
    d.setDate(d.getDate() + 9);
    return d.toISOString().split("T")[0];
  }

  _request(method, path, body, abortSignal) {
    return new Promise((resolve, reject) => {
      if (abortSignal && abortSignal.aborted) return reject(new Error("Aborted"));

      const url = new URL(`${this.baseUrl}${path}`);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: this.timeout
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", chunk => { data += chunk; });
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`Invalid JSON from Booking: ${data.slice(0, 200)}`)); }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Booking request timeout")); });
      if (abortSignal) abortSignal.addEventListener("abort", () => req.destroy());
      req.end();
    });
  }
}

module.exports = BookingProvider;

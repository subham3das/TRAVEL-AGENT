/**
 * Travel OS — Amadeus Provider
 *
 * Adapter for Amadeus Self-Service APIs.
 * Supports: flight, hotel, activity search.
 * Uses OAuth2 token flow.
 */

"use strict";

const https = require("https");
const SearchProviderBase = require("./search_provider_base");

class AmadeusProvider extends SearchProviderBase {
  constructor() {
    super("amadeus", {
      priority: 85,
      supportedTypes: ["flight", "hotel", "activity"],
      timeout: 10000
    });
    this.clientId = process.env.AMADEUS_CLIENT_ID || "";
    this.clientSecret = process.env.AMADEUS_CLIENT_SECRET || "";
    this.token = null;
    this.tokenExpiry = 0;
    this.baseUrl = "https://api.amadeus.com/v2";
  }

  _isConfigured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  async _ensureToken() {
    if (this.token && Date.now() < this.tokenExpiry) return this.token;

    const body = `grant_type=client_credentials&client_id=${this.clientId}&client_secret=${this.clientSecret}`;
    const data = await this._rawRequest("POST", "https://api.amadeus/v1/security/oauth2/token", body, {
      "Content-Type": "application/x-www-form-urlencoded"
    });

    this.token = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.token;
  }

  async search(criteria, abortSignal = null) {
    if (!this._isConfigured()) {
      console.warn("[Amadeus] No API credentials configured — returning empty results");
      return [];
    }

    if (abortSignal && abortSignal.aborted) return [];

    const token = await this._ensureToken();

    switch (criteria.type) {
      case "flight":  return this._searchFlights(criteria, token, abortSignal);
      case "hotel":   return this._searchHotels(criteria, token, abortSignal);
      case "activity": return this._searchActivities(criteria, token, abortSignal);
      default: return [];
    }
  }

  async _searchFlights(criteria, token, abortSignal) {
    const { origin = "DEL", destination = "GOI", startDate, travelers = 1 } = criteria;
    const params = new URLSearchParams({
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate: startDate || new Date().toISOString().split("T")[0],
      adults: String(travelers),
      max: String(criteria.limit || 10)
    });

    const startMs = Date.now();
    try {
      const data = await this._apiRequest("GET", `/shopping/flight-offers?${params}`, null, token, abortSignal);
      this.recordSuccess(Date.now() - startMs);

      if (!data.data || !Array.isArray(data.data)) return [];
      return data.data.map(offer => this._normalizeFlight(offer));
    } catch (err) {
      this.recordFailure(err);
      console.error(`[Amadeus] Flight search failed: ${err.message}`);
      return [];
    }
  }

  async _searchHotels(criteria, token, abortSignal) {
    const { cityCode = "GOI", checkIn, checkOut, adults = 1 } = criteria;
    const params = new URLSearchParams({
      cityCode,
      ...(checkIn ? { checkInDate: checkIn } : {}),
      ...(checkOut ? { checkOutDate: checkOut } : {}),
      adults: String(adults),
      roomQuantity: "1",
      max: String(criteria.limit || 10)
    });

    const startMs = Date.now();
    try {
      const data = await this._apiRequest("GET", `/shopping/hotel-offers?${params}`, null, token, abortSignal);
      this.recordSuccess(Date.now() - startMs);

      if (!data.data || !Array.isArray(data.data)) return [];
      return data.data.map(offer => this._normalizeHotel(offer));
    } catch (err) {
      this.recordFailure(err);
      console.error(`[Amadeus] Hotel search failed: ${err.message}`);
      return [];
    }
  }

  async _searchActivities(criteria, token, abortSignal) {
    const { latitude = 15.2993, longitude = 74.124 } = criteria;
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      radius: String(criteria.radiusKm || 20)
    });

    const startMs = Date.now();
    try {
      const data = await this._apiRequest("GET", `/shopping/activities?${params}`, null, token, abortSignal);
      this.recordSuccess(Date.now() - startMs);

      if (!data.data || !Array.isArray(data.data)) return [];
      return data.data.map(act => this._normalizeActivity(act));
    } catch (err) {
      this.recordFailure(err);
      console.error(`[Amadeus] Activity search failed: ${err.message}`);
      return [];
    }
  }

  _normalizeFlight(offer) {
    const itinerary = offer.itineraries?.[0] || {};
    const segment = itinerary.segments?.[0] || {};
    const price = offer.price || {};

    return {
      id: `amadeus_flight_${offer.id}`,
      provider: this.name,
      type: "flight",
      title: `${segment.carrierCode || ""} ${segment.number || ""}`,
      airline: segment.carrierCode || "",
      flightNumber: `${segment.carrierCode}${segment.number}`,
      origin: segment.departure?.iataCode || "",
      destination: segment.arrival?.iataCode || "",
      departureTime: segment.departure?.at || "",
      arrivalTime: segment.arrival?.at || "",
      duration: itinerary.duration || "",
      stops: (itinerary.segments?.length || 1) - 1,
      price: Number(price.total || 0),
      currency: price.currency || "INR",
      class: offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin || "ECONOMY",
      status: "available",
      raw: offer
    };
  }

  _normalizeHotel(offer) {
    const hotel = offer.hotel || {};
    const offerPrice = offer.offers?.[0] || {};

    return {
      id: `amadeus_hotel_${hotel.hotelId || offer.id}`,
      provider: this.name,
      type: "hotel",
      title: hotel.name || "",
      location: hotel.address?.lines?.join(", ") || "",
      coordinates: hotel.geoCode
        ? { latitude: hotel.geoCode.latitude, longitude: hotel.geoCode.longitude }
        : null,
      rating: hotel.rating || null,
      price: Number(offerPrice.price?.total || 0),
      currency: offerPrice.price?.currency || "INR",
      amenities: hotel.amenities || [],
      images: (hotel.media?.images || []).slice(0, 3).map(img => img.uri),
      status: "available",
      raw: offer
    };
  }

  _normalizeActivity(act) {
    return {
      id: `amadeus_activity_${act.id}`,
      provider: this.name,
      type: "activity",
      title: act.name || "",
      location: act.address?.line1 || "",
      coordinates: act.geoCode
        ? { latitude: act.geoCode.latitude, longitude: act.geoCode.longitude }
        : null,
      rating: act.rating || null,
      reviewCount: act.reviews?.length || 0,
      price: Number(act.price?.amount || 0),
      currency: act.price?.currencyCode || "INR",
      description: act.shortDescription || "",
      images: [act.pictures?.[0]].filter(Boolean),
      status: "available",
      raw: act
    };
  }

  async _apiRequest(method, path, body, token, abortSignal) {
    const url = new URL(`https://api.amadeus.com${path}`);
    const postData = body ? JSON.stringify(body) : null;

    const headers = {
      Authorization: `Bearer ${token}`,
      ...(postData ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) } : {})
    };

    return this._rawRequest(method, url.href, postData, headers, abortSignal);
  }

  _rawRequest(method, href, body, headers = {}, abortSignal = null) {
    return new Promise((resolve, reject) => {
      if (abortSignal && abortSignal.aborted) return reject(new Error("Aborted"));

      const url = new URL(href);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers,
        timeout: this.timeout
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", chunk => { data += chunk; });
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`Invalid JSON from Amadeus: ${data.slice(0, 200)}`)); }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Amadeus request timeout")); });

      if (abortSignal) abortSignal.addEventListener("abort", () => req.destroy());
      if (body) req.write(body);
      req.end();
    });
  }
}

module.exports = AmadeusProvider;

/**
 * Travel OS — Google Places Provider
 *
 * Adapter for Google Places API (New).
 * Supports: activity, restaurant, hotel search.
 * Uses textSearch / findPlaceFromText endpoints.
 */

"use strict";

const https = require("https");
const SearchProviderBase = require("./search_provider_base");

class GooglePlacesProvider extends SearchProviderBase {
  constructor() {
    super("google_places", {
      priority: 90,
      supportedTypes: ["activity", "restaurant", "hotel"],
      timeout: 8000
    });
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || "";
    this.baseUrl = "https://places.googleapis.com/v1";
  }

  async search(criteria, abortSignal = null) {
    if (!this.apiKey) {
      console.warn("[GooglePlaces] No API key configured — returning empty results");
      return [];
    }

    if (abortSignal && abortSignal.aborted) return [];

    const { destinationId, query, filters = {} } = criteria;
    const searchQuery = query || destinationId;

    // Map our types to Google Places types
    const typeMap = {
      activity: "tourist_attraction",
      restaurant: "restaurant",
      hotel: "lodging"
    };
    const googleType = typeMap[criteria.type] || "tourist_attraction";

    const requestBody = {
      textQuery: searchQuery,
      languageCode: "en",
      maxResultCount: filters.limit || 10
    };

    if (googleType) {
      requestBody.includedType = googleType;
    }

    if (filters.location) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: filters.location.latitude,
            longitude: filters.location.longitude
          },
          radius: filters.radiusKm ? filters.radiusKm * 1000 : 10000
        }
      };
    }

    const startMs = Date.now();

    try {
      const data = await this._request("POST", "/places:searchText", requestBody, abortSignal);
      this.recordSuccess(Date.now() - startMs);

      if (!data.places || !Array.isArray(data.places)) return [];

      return data.places.map(place => this._normalize(place, criteria.type));
    } catch (err) {
      this.recordFailure(err);
      console.error(`[GooglePlaces] Search failed: ${err.message}`);
      return [];
    }
  }

  _normalize(place, type) {
    const location = place.location || {};
    const address = place.formattedAddress || "";

    return {
      id: `gplaces_${place.id || place.displayName?.text || "unknown"}`,
      provider: this.name,
      type,
      title: place.displayName?.text || "",
      location: address,
      coordinates: location.latitude && location.longitude
        ? { latitude: location.latitude, longitude: location.longitude }
        : null,
      rating: place.rating || null,
      reviewCount: place.userRatingCount || 0,
      images: (place.photos || []).slice(0, 3).map(p =>
        `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=800&key=${this.apiKey}`
      ),
      description: place.types?.join(", ") || "",
      openNow: place.currentOpeningHours?.openNow ?? null,
      priceLevel: place.priceLevel || null,
      raw: place
    };
  }

  _request(method, path, body, abortSignal) {
    return new Promise((resolve, reject) => {
      if (abortSignal && abortSignal.aborted) {
        return reject(new Error("Aborted"));
      }

      const url = new URL(`${this.baseUrl}${path}?key=${this.apiKey}`);
      const postData = body ? JSON.stringify(body) : null;

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(postData ? { "Content-Length": Buffer.byteLength(postData) } : {})
        },
        timeout: this.timeout
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", chunk => { data += chunk; });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Invalid JSON from Google Places: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Google Places request timeout")); });

      if (abortSignal) {
        abortSignal.addEventListener("abort", () => req.destroy());
      }

      if (postData) req.write(postData);
      req.end();
    });
  }
}

module.exports = GooglePlacesProvider;

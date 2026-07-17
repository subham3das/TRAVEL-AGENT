/**
 * Travel OS — Google Maps Provider
 *
 * Adapter for Google Maps APIs (Distance Matrix, Geocoding, Directions).
 * Supports: maps (travel time, distance, geocoding, routing).
 */

"use strict";

const https = require("https");
const SearchProviderBase = require("./search_provider_base");

class GoogleMapsProvider extends SearchProviderBase {
  constructor() {
    super("google_maps", {
      priority: 90,
      supportedTypes: ["maps"],
      timeout: 6000
    });
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || "";
    this.baseUrl = "https://maps.googleapis.com/maps/api";
  }

  async search(criteria, abortSignal = null) {
    if (!this.apiKey) {
      console.warn("[GoogleMaps] No API key configured — returning empty results");
      return [];
    }

    if (abortSignal && abortSignal.aborted) return [];

    const { origin, destination, mode = "driving" } = criteria;

    try {
      const [distance, geocode] = await Promise.all([
        origin && destination
          ? this._distanceMatrix(origin, destination, mode, abortSignal)
          : Promise.resolve(null),
        criteria.query
          ? this._geocode(criteria.query, abortSignal)
          : Promise.resolve(null)
      ]);

      const results = [];

      if (distance) {
        results.push({
          id: `gmaps_distance_${Date.now()}`,
          provider: this.name,
          type: "maps",
          title: `Travel: ${origin} → ${destination}`,
          category: "distance",
          origin,
          destination,
          distance: distance.distance,
          duration: distance.duration,
          distanceValue: distance.distanceValue,
          durationValue: distance.durationValue,
          mode,
          status: "available"
        });
      }

      if (geocode) {
        results.push({
          id: `gmaps_geocode_${Date.now()}`,
          provider: this.name,
          type: "maps",
          title: geocode.formattedAddress || criteria.query,
          category: "geocode",
          location: geocode.formattedAddress,
          coordinates: { latitude: geocode.latitude, longitude: geocode.longitude },
          placeId: geocode.placeId,
          status: "available"
        });
      }

      return results;
    } catch (err) {
      console.error(`[GoogleMaps] Search failed: ${err.message}`);
      return [];
    }
  }

  async _distanceMatrix(origin, destination, mode, abortSignal) {
    const params = new URLSearchParams({
      origins: origin,
      destinations: destination,
      mode,
      key: this.apiKey,
      units: "metric"
    });

    const data = await this._request("GET", `/distancematrix/json?${params}`, abortSignal);

    if (data.status !== "OK" || !data.rows?.[0]?.elements?.[0]) return null;

    const element = data.rows[0].elements[0];
    if (element.status !== "OK") return null;

    return {
      distance: element.distance.text,
      duration: element.duration.text,
      distanceValue: element.distance.value,
      durationValue: element.duration.value
    };
  }

  async _geocode(query, abortSignal) {
    const params = new URLSearchParams({
      address: query,
      key: this.apiKey
    });

    const data = await this._request("GET", `/geocode/json?${params}`, abortSignal);

    if (data.status !== "OK" || !data.results?.[0]) return null;

    const result = data.results[0];
    return {
      formattedAddress: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      placeId: result.place_id
    };
  }

  _request(method, path, abortSignal) {
    return new Promise((resolve, reject) => {
      if (abortSignal && abortSignal.aborted) return reject(new Error("Aborted"));

      const url = new URL(`${this.baseUrl}${path}`);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        timeout: this.timeout
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", chunk => { data += chunk; });
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`Invalid JSON from Google Maps: ${data.slice(0, 200)}`)); }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Google Maps request timeout")); });
      if (abortSignal) abortSignal.addEventListener("abort", () => req.destroy());
      req.end();
    });
  }
}

module.exports = GoogleMapsProvider;

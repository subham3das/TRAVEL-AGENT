/**
 * Travel OS — Events Provider
 *
 * Adapter for Eventbrite / Ticketmaster APIs.
 * Supports: events search (local events, concerts, festivals).
 */

"use strict";

const https = require("https");
const SearchProviderBase = require("./search_provider_base");

class EventsProvider extends SearchProviderBase {
  constructor() {
    super("events", {
      priority: 70,
      supportedTypes: ["events"],
      timeout: 6000
    });
    this.apiKey = process.env.EVENTBRITE_API_KEY || process.env.TICKETMASTER_API_KEY || "";
    this.provider = process.env.EVENTS_PROVIDER || "eventbrite";
    this.baseUrl = this.provider === "ticketmaster"
      ? "https://app.ticketmaster.com/discovery/v2"
      : "https://www.eventbriteapi.com/v3";
  }

  async search(criteria, abortSignal = null) {
    if (!this.apiKey) {
      console.warn("[Events] No API key configured — returning empty results");
      return [];
    }

    if (abortSignal && abortSignal.aborted) return [];

    const { destinationId, coordinates, filters = {} } = criteria;

    try {
      if (this.provider === "ticketmaster") {
        return this._searchTicketmaster(destinationId, coordinates, filters, abortSignal);
      }
      return this._searchEventbrite(destinationId, coordinates, filters, abortSignal);
    } catch (err) {
      console.error(`[Events] Search failed: ${err.message}`);
      return [];
    }
  }

  async _searchEventbrite(destinationId, coordinates, filters, abortSignal) {
    const params = new URLSearchParams({
      q: destinationId || "events",
      expand: "venue",
      sort_by: "date",
      "page.size": String(filters.limit || 10)
    });

    if (coordinates) {
      params.set("location.latitude", String(coordinates.latitude));
      params.set("location.longitude", String(coordinates.longitude));
      params.set("location.within", filters.radiusKm ? `${filters.radiusKm}km` : "20km");
    }

    const data = await this._request("GET", `/events/search/?${params}`, abortSignal);
    const events = data.events || [];

    return events.map(event => this._normalizeEventbrite(event));
  }

  async _searchTicketmaster(destinationId, coordinates, filters, abortSignal) {
    const params = new URLSearchParams({
      apikey: this.apiKey,
      keyword: destinationId || "events",
      size: String(filters.limit || 10),
      sort: "date,asc"
    });

    if (coordinates) {
      params.set("latlong", `${coordinates.latitude},${coordinates.longitude}`);
      params.set("radius", String(filters.radiusKm || 20));
      params.set("unit", "km");
    }

    const data = await this._request("GET", `/events.json?${params}`, abortSignal);
    const events = data._embedded?.events || [];

    return events.map(event => this._normalizeTicketmaster(event));
  }

  _normalizeEventbrite(event) {
    const venue = event.venue || {};
    return {
      id: `eventbrite_${event.id}`,
      provider: "eventbrite",
      type: "events",
      title: event.name?.text || event.name || "",
      category: event.category?.name || "Event",
      location: venue.address?.localized_address_display || "",
      coordinates: venue.latitude && venue.longitude
        ? { latitude: Number(venue.latitude), longitude: Number(venue.longitude) }
        : null,
      startDate: event.start?.local || event.start?.utc || null,
      endDate: event.end?.local || event.end?.utc || null,
      url: event.url || null,
      image: event.logo?.url || event.image || null,
      description: (event.description?.text || "").slice(0, 300),
      price: event.is_free ? 0 : null,
      status: "available"
    };
  }

  _normalizeTicketmaster(event) {
    const venue = event._embedded?.venues?.[0] || {};
    return {
      id: `ticketmaster_${event.id}`,
      provider: "ticketmaster",
      type: "events",
      title: event.name || "",
      category: event.classifications?.[0]?.segment?.name || "Event",
      location: venue.city?.name ? `${venue.city.name}, ${venue.country?.countryCode || ""}` : "",
      coordinates: venue.location
        ? { latitude: Number(venue.location.latitude), longitude: Number(venue.location.longitude) }
        : null,
      startDate: event.dates?.start?.localDate || null,
      endDate: null,
      url: event.url || null,
      image: event.images?.[0]?.url || null,
      description: event.info || "",
      price: event.priceRanges?.[0]?.min || null,
      status: "available"
    };
  }

  _request(method, path, abortSignal) {
    return new Promise((resolve, reject) => {
      if (abortSignal && abortSignal.aborted) return reject(new Error("Aborted"));

      const url = new URL(path.startsWith("http") ? path : `${this.baseUrl}${path}`);
      const headers = {};
      if (this.provider === "eventbrite") {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }

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
          catch (e) { reject(new Error(`Invalid JSON from Events: ${data.slice(0, 200)}`)); }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Events request timeout")); });
      if (abortSignal) abortSignal.addEventListener("abort", () => req.destroy());
      req.end();
    });
  }
}

module.exports = EventsProvider;

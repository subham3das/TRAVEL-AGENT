/**
 * Travel OS — Search Provider Bootstrap
 *
 * Registers all search-layer providers with the SearchProviderRegistry.
 * Import this file once at application startup.
 */

"use strict";

const registry = require("./providers/search_provider_registry");
const GooglePlaces = require("./providers/google_places_provider");
const Amadeus = require("./providers/amadeus_provider");
const Booking = require("./providers/booking_provider");
const GoogleMaps = require("./providers/google_maps_provider");
const Weather = require("./providers/weather_provider");
const Events = require("./providers/events_provider");

// Register all providers
const providers = [
  new GooglePlaces(),
  new Amadeus(),
  new Booking(),
  new GoogleMaps(),
  new Weather(),
  new Events()
];

for (const provider of providers) {
  registry.register(provider);
}

console.log(`[SearchBootstrap] ${providers.length} search providers registered: ${providers.map(p => p.name).join(", ")}`);

module.exports = registry;

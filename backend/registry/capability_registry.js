/**
 * Travel OS — Capability Registry
 *
 * Single source of truth for what the system can currently do.
 * The AI checks this before promising features to the user.
 * Providers update their own capability flags on startup.
 */

const capabilities = {
  hotelSearch: false,      // set true when HotelProvider.search() is available
  flightSearch: false,     // set true when FlightProvider.search() is available
  activitySearch: true,    // always: knowledge graph has attractions
  weatherSearch: false,    // set true when WeatherProvider available
  booking: false,          // set true when booking endpoints exist
  visa: false,
  forex: false,
  packing: true,           // always: deterministic from destination + season
  events: false,
  restaurants: true        // always: knowledge graph has restaurants
};

/**
 * Register a provider's capabilities.
 * Called by each provider on initialization.
 */
function register(providerName, caps = {}) {
  Object.assign(capabilities, caps);
  console.log(`[CapabilityRegistry] ${providerName} registered:`, caps);
}

/**
 * Check if a specific capability is available.
 */
function can(capability) {
  return capabilities[capability] === true;
}

/**
 * Get full capability map (for health endpoint + AI context).
 */
function getAll() {
  return { ...capabilities };
}

/**
 * Get list of available capability names.
 */
function available() {
  return Object.entries(capabilities)
    .filter(([, v]) => v)
    .map(([k]) => k);
}

module.exports = { register, can, getAll, available, capabilities };

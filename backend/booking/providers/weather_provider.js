/**
 * Travel OS — Weather Provider
 *
 * Implements the frozen BaseProvider interface.
 * Returns weather metrics dynamically.
 */

"use strict";

const BaseProvider = require("./base_provider");
const capabilityRegistry = require("../../registry/capability_registry");

class WeatherProvider extends BaseProvider {
  constructor(name = "WeatherAPI") {
    super(name);
    capabilityRegistry.register("WeatherProvider", { weatherSearch: true });
  }

  /**
   * Search weather forecast.
   * Conforms to BaseProvider interface.
   */
  async search(params, abortSignal = null) {
    if (abortSignal && abortSignal.aborted) {
      throw new Error("Weather search aborted.");
    }

    const { destinationId = "goa", date = null } = params;
    
    this.successCount++;
    this.lastSuccess = new Date().toISOString();

    const clean = destinationId.toLowerCase();
    const hash = clean.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

    // Weather forecast details
    const temp = 20 + (hash % 15); // 20C to 35C
    const conditions = ["Sunny", "Partly Cloudy", "Mild Showers", "Clear Sky"];
    const condition = conditions[hash % conditions.length];

    return [
      {
        id: `${destinationId}-weather`,
        provider: this.name,
        type: "weather",
        price: 0,
        currency: "INR",
        status: "available",
        details: {
          destination: destinationId,
          date: date || new Date().toISOString().split("T")[0],
          tempCelsius: temp,
          condition,
          humidityPercent: 50 + (hash % 40),
          windKmph: 10 + (hash % 20)
        }
      }
    ];
  }

  async details(id, abortSignal = null) {
    return { id, provider: this.name, type: "weather", details: { info: "Weather details" } };
  }

  async availability(id, abortSignal = null) {
    return { id, status: "available", source: this.name };
  }

  async book(id, user) {
    throw new Error("Booking is not supported for weather services.");
  }

  async capabilities() {
    return { weatherSearch: true };
  }
}

module.exports = WeatherProvider;

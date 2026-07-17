/**
 * Travel OS — Weather Provider
 *
 * Adapter for OpenWeatherMap API.
 * Supports: weather search (current + forecast).
 */

"use strict";

const https = require("https");
const SearchProviderBase = require("./search_provider_base");

class WeatherProvider extends SearchProviderBase {
  constructor() {
    super("openweathermap", {
      priority: 80,
      supportedTypes: ["weather"],
      timeout: 5000
    });
    this.apiKey = process.env.WEATHER_API_KEY || "";
    this.baseUrl = "https://api.openweathermap.org/data/2.5";
  }

  async search(criteria, abortSignal = null) {
    if (!this.apiKey) {
      console.warn("[Weather] No API key configured — returning empty results");
      return [];
    }

    if (abortSignal && abortSignal.aborted) return [];

    const { destinationId, coordinates, forecastDays = 5 } = criteria;

    try {
      let lat, lon;

      if (coordinates) {
        lat = coordinates.latitude;
        lon = coordinates.longitude;
      } else if (destinationId) {
        const geo = await this._geocode(destinationId, abortSignal);
        if (!geo) return [];
        lat = geo.lat;
        lon = geo.lon;
      } else {
        return [];
      }

      const [current, forecast] = await Promise.all([
        this._currentWeather(lat, lon, abortSignal),
        this._forecast(lat, lon, abortSignal)
      ]);

      const results = [];

      if (current) {
        results.push({
          id: `weather_current_${destinationId || "unknown"}`,
          provider: this.name,
          type: "weather",
          title: `Weather: ${current.cityName}`,
          category: "current",
          destination: destinationId,
          temperature: current.temp,
          feelsLike: current.feelsLike,
          humidity: current.humidity,
          description: current.description,
          icon: current.icon,
          windSpeed: current.windSpeed,
          visibility: current.visibility,
          status: "available"
        });
      }

      if (forecast && forecast.length > 0) {
        results.push({
          id: `weather_forecast_${destinationId || "unknown"}`,
          provider: this.name,
          type: "weather",
          title: `Forecast: ${destinationId}`,
          category: "forecast",
          destination: destinationId,
          daily: forecast.slice(0, forecastDays),
          status: "available"
        });
      }

      return results;
    } catch (err) {
      console.error(`[Weather] Search failed: ${err.message}`);
      return [];
    }
  }

  async _currentWeather(lat, lon, abortSignal) {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      appid: this.apiKey,
      units: "metric"
    });

    const data = await this._request("GET", `/weather?${params}`, abortSignal);

    if (data.cod !== 200) return null;

    return {
      cityName: data.name,
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      description: data.weather?.[0]?.description || "",
      icon: data.weather?.[0]?.icon || "",
      windSpeed: data.wind?.speed || 0,
      visibility: data.visibility || 0
    };
  }

  async _forecast(lat, lon, abortSignal) {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      appid: this.apiKey,
      units: "metric",
      cnt: "40" // 5 days × 8 (3-hour intervals)
    });

    const data = await this._request("GET", `/forecast?${params}`, abortSignal);

    if (data.cod !== "200" && data.cod !== 200) return [];

    // Group by day
    const byDay = {};
    for (const entry of data.list || []) {
      const date = entry.dt_txt.split(" ")[0];
      if (!byDay[date]) byDay[date] = [];
      byDay[date].push(entry);
    }

    return Object.entries(byDay).slice(0, 5).map(([date, entries]) => {
      const temps = entries.map(e => e.main.temp);
      const weather = entries[Math.floor(entries.length / 2)]?.weather?.[0] || {};

      return {
        date,
        tempMin: Math.round(Math.min(...temps)),
        tempMax: Math.round(Math.max(...temps)),
        description: weather.description || "",
        icon: weather.icon || "",
        humidity: Math.round(entries.reduce((s, e) => s + e.main.humidity, 0) / entries.length)
      };
    });
  }

  async _geocode(query, abortSignal) {
    const params = new URLSearchParams({
      q: query,
      limit: "1",
      appid: this.apiKey
    });

    const data = await this._request("GET", `https://api.openweathermap.org/geo/1.0/direct?${params}`, abortSignal);

    if (!data || data.length === 0) return null;
    return { lat: data[0].lat, lon: data[0].lon };
  }

  _request(method, fullUrl, abortSignal) {
    return new Promise((resolve, reject) => {
      if (abortSignal && abortSignal.aborted) return reject(new Error("Aborted"));

      const url = new URL(fullUrl);
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
          catch (e) { reject(new Error(`Invalid JSON from Weather: ${data.slice(0, 200)}`)); }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Weather request timeout")); });
      if (abortSignal) abortSignal.addEventListener("abort", () => req.destroy());
      req.end();
    });
  }
}

module.exports = WeatherProvider;

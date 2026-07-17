/**
 * Travel OS — Trip Memory
 *
 * Stores memories from specific past trips.
 * File-based storage: backend/data/memory/trips/{userId}.json
 *
 * Each trip is a structured record:
 * {
 *   tripId: string,
 *   destination: string,
 *   startDate: string,
 *   endDate: string,
 *   durationDays: number,
 *   companions: string[],
 *   hotel: { name: string, location: string, rating: number },
 *   highlights: string[],
 *   dislikes: string[],
 *   memories: string[],
 *   spend: number,
 *   transport: { mode: string, details: string },
 *   tags: string[],
 *   mood: string,
 *   wouldReturn: boolean,
 *   notes: string
 * }
 */

"use strict";

const fs = require("fs");
const path = require("path");

const TRIPS_DIR = path.resolve(__dirname, "..", "data", "memory", "trips");

class TripMemory {
  constructor() {
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(TRIPS_DIR)) {
      fs.mkdirSync(TRIPS_DIR, { recursive: true });
    }
  }

  _path(userId) {
    const safe = String(userId || "anonymous").replace(/[^a-zA-Z0-9_-]/g, "");
    return path.join(TRIPS_DIR, `${safe}.json`);
  }

  /**
   * Load all trip memories for a user.
   */
  load(userId) {
    const filePath = this._path(userId);

    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
      } catch (err) {
        console.error(`[TripMemory] Failed to load ${userId}: ${err.message}`);
      }
    }

    return { userId, trips: [], version: 0 };
  }

  /**
   * Save all trip memories.
   */
  save(data) {
    if (!data || !data.userId) return false;

    try {
      this._ensureDir();
      data.updatedAt = new Date().toISOString();
      data.version = (data.version || 0) + 1;
      fs.writeFileSync(this._path(data.userId), JSON.stringify(data, null, 2), "utf-8");
      return true;
    } catch (err) {
      console.error(`[TripMemory] Failed to save ${data.userId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Add a new trip memory.
   */
  addTrip(userId, trip) {
    const data = this.load(userId);

    const record = {
      tripId: trip.tripId || `trip-${Date.now()}`,
      destination: trip.destination || "",
      startDate: trip.startDate || null,
      endDate: trip.endDate || null,
      durationDays: trip.durationDays || 0,
      companions: trip.companions || [],
      hotel: trip.hotel || null,
      highlights: trip.highlights || [],
      dislikes: trip.dislikes || [],
      memories: trip.memories || [],
      spend: trip.spend || 0,
      transport: trip.transport || null,
      tags: trip.tags || [],
      mood: trip.mood || "neutral",
      wouldReturn: trip.wouldReturn ?? true,
      notes: trip.notes || "",
      createdAt: new Date().toISOString()
    };

    data.trips.push(record);
    this.save(data);
    return record;
  }

  /**
   * Update a specific trip by tripId.
   */
  updateTrip(userId, tripId, updates) {
    const data = this.load(userId);
    const idx = data.trips.findIndex(t => t.tripId === tripId);
    if (idx === -1) return false;

    Object.assign(data.trips[idx], updates);
    this.save(data);
    return data.trips[idx];
  }

  /**
   * Get trips for a specific destination.
   */
  getByDestination(userId, destination) {
    const data = this.load(userId);
    const dest = String(destination).toLowerCase();
    return data.trips.filter(t => String(t.destination).toLowerCase() === dest);
  }

  /**
   * Get the most recent trip.
   */
  getLastTrip(userId) {
    const data = this.load(userId);
    if (data.trips.length === 0) return null;
    return data.trips[data.trips.length - 1];
  }

  /**
   * Get trips with a specific tag.
   */
  getByTag(userId, tag) {
    const data = this.load(userId);
    const t = String(tag).toLowerCase();
    return data.trips.filter(trip => trip.tags.some(tt => String(tt).toLowerCase() === t));
  }

  /**
   * Get all unique destinations visited.
   */
  getDestinations(userId) {
    const data = this.load(userId);
    return [...new Set(data.trips.map(t => t.destination))];
  }

  /**
   * Summarize past trips for context injection.
   */
  summarize(userId) {
    const data = this.load(userId);
    if (data.trips.length === 0) return null;

    const lastTrip = data.trips[data.trips.length - 1];
    const allDestinations = this.getDestinations(userId);

    return {
      totalTrips: data.trips.length,
      destinations: allDestinations,
      lastTrip: lastTrip ? {
        destination: lastTrip.destination,
        duration: lastTrip.durationDays,
        highlights: lastTrip.highlights,
        dislikes: lastTrip.dislikes,
        mood: lastTrip.mood,
        wouldReturn: lastTrip.wouldReturn
      } : null
    };
  }

  /**
   * Delete all trip memories (GDPR).
   */
  forgetAll(userId) {
    const filePath = this._path(userId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}

module.exports = new TripMemory();

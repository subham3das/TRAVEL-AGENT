/**
 * Travel OS — Permanent Memory
 *
 * Stores user preferences that persist FOREVER.
 * File-based storage: backend/data/memory/permanent/{userId}.json
 *
 * Never expires. Never deleted. Only overwritten by user explicit changes.
 *
 * Schema:
 * {
 *   userId: string,
 *   preferences: {
 *     budget: { min: number, max: number, avg: number, currency: string },
 *     airline: string[],
 *     food: { vegetarian: boolean, vegan: boolean, halal: boolean, cuisine: string[], restrictions: string[] },
 *     hotelStyle: "budget" | "mid" | "luxury",
 *     travelPace: "slow" | "moderate" | "fast",
 *     preferredSeat: "window" | "aisle" | "middle",
 *     visaStatus: { indian: boolean, schengen: boolean, uk: boolean, us: boolean, ... },
 *     language: string[],
 *     accommodation: { chain: string[], type: string[], amenities: string[] },
 *     transport: { mode: string[], carRental: boolean },
 *     interests: string[],
 *     accessibility: { wheelchair: boolean, ... }
 *   },
 *   learnings: {
 *     rankingWeights: { [key]: number },
 *     acceptedPlaces: string[],
 *     rejectedPlaces: string[],
 *     acceptedAirlines: string[],
 *     rejectedAirlines: string[],
 *     acceptedChains: string[],
 *     rejectedChains: string[]
 *   },
 *   createdAt: string,
 *   updatedAt: string,
 *   version: number
 * }
 */

"use strict";

const fs = require("fs");
const path = require("path");

const MEMORY_DIR = path.resolve(__dirname, "..", "data", "memory", "permanent");

class PermanentMemory {
  constructor() {
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
  }

  _path(userId) {
    const safe = String(userId || "anonymous").replace(/[^a-zA-Z0-9_-]/g, "");
    return path.join(MEMORY_DIR, `${safe}.json`);
  }

  /**
   * Load permanent memory for a user. Returns empty structure if none exists.
   */
  load(userId) {
    const filePath = this._path(userId);

    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
      } catch (err) {
        console.error(`[PermanentMemory] Failed to load ${userId}: ${err.message}`);
      }
    }

    return this._defaults(userId);
  }

  /**
   * Save permanent memory for a user.
   */
  save(memory) {
    if (!memory || !memory.userId) return false;

    try {
      this._ensureDir();
      memory.updatedAt = new Date().toISOString();
      memory.version = (memory.version || 0) + 1;
      fs.writeFileSync(this._path(memory.userId), JSON.stringify(memory, null, 2), "utf-8");
      return true;
    } catch (err) {
      console.error(`[PermanentMemory] Failed to save ${memory.userId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Update specific preference fields. Merges with existing.
   */
  updatePreference(userId, key, value) {
    const memory = this.load(userId);
    memory.preferences[key] = value;
    return this.save(memory);
  }

  /**
   * Update learnings (ranking weights, accepted/rejected lists).
   */
  updateLearnings(userId, learnings) {
    const memory = this.load(userId);
    Object.assign(memory.learnings, learnings);
    return this.save(memory);
  }

  /**
   * Add a ranking weight delta with normalization.
   * Weights are capped at [-100, +100] to prevent unbounded growth.
   * Old weights decay by 5% on each write to prefer recent signals.
   */
  adjustWeight(userId, key, delta) {
    const memory = this.load(userId);
    const current = memory.learnings.rankingWeights[key] || 0;

    // Decay existing weights by 5% to prefer recent signals
    const decayed = Math.round(current * 0.95);

    // Apply delta and clamp to [-100, +100]
    const clamped = Math.max(-100, Math.min(100, decayed + delta));
    memory.learnings.rankingWeights[key] = clamped;

    return this.save(memory);
  }

  /**
   * Track accepted item.
   */
  accept(userId, type, value) {
    const memory = this.load(userId);
    const listKey = `accepted${type.charAt(0).toUpperCase() + type.slice(1)}`;
    if (!memory.learnings[listKey]) memory.learnings[listKey] = [];
    if (!memory.learnings[listKey].includes(value)) {
      memory.learnings[listKey].push(value);
    }
    return this.save(memory);
  }

  /**
   * Track rejected item.
   */
  reject(userId, type, value) {
    const memory = this.load(userId);
    const listKey = `rejected${type.charAt(0).toUpperCase() + type.slice(1)}`;
    if (!memory.learnings[listKey]) memory.learnings[listKey] = [];
    if (!memory.learnings[listKey].includes(value)) {
      memory.learnings[listKey].push(value);
    }
    return this.save(memory);
  }

  /**
   * Delete all permanent memory for a user (GDPR).
   */
  forgetAll(userId) {
    const filePath = this._path(userId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  _defaults(userId) {
    return {
      userId,
      preferences: {
        budget: { min: 0, max: 0, avg: 0, currency: "INR" },
        airline: [],
        food: { vegetarian: false, vegan: false, halal: false, cuisine: [], restrictions: [] },
        hotelStyle: "mid",
        travelPace: "moderate",
        preferredSeat: "window",
        visaStatus: { indian: true },
        language: ["en"],
        accommodation: { chain: [], type: [], amenities: [] },
        transport: { mode: [], carRental: false },
        interests: [],
        accessibility: {}
      },
      learnings: {
        rankingWeights: {},
        acceptedPlaces: [],
        rejectedPlaces: [],
        acceptedAirlines: [],
        rejectedAirlines: [],
        acceptedChains: [],
        rejectedChains: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 0
    };
  }
}

module.exports = new PermanentMemory();

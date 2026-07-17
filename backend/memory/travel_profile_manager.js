/**
 * Travel OS — Travel Profile Manager (Memory Persistence)
 *
 * Handles persistent loading and saving of TravelProfile domain objects.
 * Persists profiles to local files: backend/data/profiles/{userId}.json.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { TravelProfile } = require("../domain/models");
const eventBus = require("../events/event_bus");

const PROFILES_DIR = path.resolve(__dirname, "..", "data", "profiles");

class TravelProfileManager {
  constructor() {
    this._ensureDirectoryExists();
  }

  _ensureDirectoryExists() {
    if (!fs.existsSync(PROFILES_DIR)) {
      fs.mkdirSync(PROFILES_DIR, { recursive: true });
    }
  }

  _getProfilePath(userId) {
    const safeUserId = String(userId || "anonymous").replace(/[^a-zA-Z0-9_-]/g, "");
    return path.join(PROFILES_DIR, `${safeUserId}.json`);
  }

  /**
   * Load TravelProfile from disk.
   * Falls back to default if file not found.
   *
   * @param {string} userId
   * @returns {TravelProfile}
   */
  load(userId) {
    const filePath = this._getProfilePath(userId);
    
    if (fs.existsSync(filePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        return TravelProfile(raw);
      } catch (err) {
        console.error(`[TravelProfileManager] Failed to read profile for ${userId}: ${err.message}`);
      }
    }

    // Default Profile if not found
    return TravelProfile({
      userId,
      travelStyle: "mid",
      budgetBehaviour: { average: 25000, max: 50000, min: 10000 },
      preferredAirlines: ["IndiGo", "Air India"],
      preferredHotelChains: ["Taj", "Marriott"],
      favouriteDestinations: ["goa"],
      foodPreferences: { vegetarian: false, cuisine: ["Indian", "Continental"] },
      accessibility: { wheelchair: false },
      travelCompanions: [],
      pastTrips: [],
      rejectedHotels: [],
      rejectedPlaces: [],
      acceptedPlaces: [],
      rankingWeights: {}
    });
  }

  /**
   * Save TravelProfile to disk.
   *
   * @param {TravelProfile} profile
   * @returns {boolean} success
   */
  save(profile) {
    if (!profile || !profile.userId) return false;

    const filePath = this._getProfilePath(profile.userId);
    try {
      this._ensureDirectoryExists();
      fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), "utf-8");
      return true;
    } catch (err) {
      console.error(`[TravelProfileManager] Failed to save profile for ${profile.userId}: ${err.message}`);
      return false;
    }
  }
}

module.exports = new TravelProfileManager();

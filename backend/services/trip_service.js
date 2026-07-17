const fs = require("fs");
const path = require("path");
const { validateTrip } = require("../contracts/EngineContracts");

class TripService {
  constructor() {
    this.dataFile = path.join(__dirname, "../data/trips.json");
    this.trips = new Map();
    this.ensureDataDirectory();
    this.loadTrips();
  }

  ensureDataDirectory() {
    const dir = path.dirname(this.dataFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  loadTrips() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, "utf8");
        const parsed = JSON.parse(data);
        parsed.forEach(trip => {
          this.trips.set(trip.id, trip);
        });
      }
    } catch (err) {
      console.error("Failed to load trips.json", err);
    }
  }

  saveTrips() {
    try {
      const data = Array.from(this.trips.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to save trips.json", err);
    }
  }

  getAllTrips() {
    return Array.from(this.trips.values()).sort((a, b) => 
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  }

  getTrip(id) {
    return this.trips.get(id);
  }

  saveTrip(payload) {
    const trip = validateTrip(payload);
    
    // Version bumping
    const existing = this.trips.get(trip.id);
    if (existing) {
      trip.version = existing.version + 1;
      trip.createdAt = existing.createdAt; // Preserve creation time
    }

    this.trips.set(trip.id, trip);
    this.saveTrips();
    return trip;
  }

  deleteTrip(id) {
    const success = this.trips.delete(id);
    if (success) {
      this.saveTrips();
    }
    return success;
  }
}

module.exports = new TripService();

const express = require("express");
const tripService = require("../services/trip_service");

const router = express.Router();

// Get all trips
router.get("/", (req, res) => {
  try {
    const trips = tripService.getAllTrips();
    res.json({ success: true, data: trips });
  } catch (err) {
    console.error("Failed to get trips:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single trip
router.get("/:id", (req, res) => {
  try {
    const trip = tripService.getTrip(req.params.id);
    if (!trip) {
      return res.status(404).json({ success: false, error: "Trip not found" });
    }
    res.json({ success: true, data: trip });
  } catch (err) {
    console.error("Failed to get trip:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create or update a trip
router.post("/", (req, res) => {
  try {
    const trip = tripService.saveTrip(req.body);
    res.json({ success: true, data: trip });
  } catch (err) {
    console.error("Failed to save trip:", err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Delete a trip
router.delete("/:id", (req, res) => {
  try {
    const success = tripService.deleteTrip(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: "Trip not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete trip:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

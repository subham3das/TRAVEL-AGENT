const crypto = require("crypto");

/**
 * Validates and normalizes the central Trip object.
 */
function validateTrip(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid trip payload");
  }

  const now = new Date().toISOString();

  return {
    id: data.id || `trip_${crypto.randomBytes(8).toString("hex")}`,
    destination: data.destination || "Unknown Destination",
    conversation: Array.isArray(data.conversation) ? data.conversation : [],
    selections: {
      hotels: Array.isArray(data.selections?.hotels) ? data.selections.hotels : [],
      flights: Array.isArray(data.selections?.flights) ? data.selections.flights : [],
      activities: Array.isArray(data.selections?.activities) ? data.selections.activities : []
    },
    budget: typeof data.budget === "number" ? data.budget : 0,
    timeline: Array.isArray(data.timeline) ? data.timeline : [],
    status: ["draft", "finalized", "booked", "archived"].includes(data.status) ? data.status : "draft",
    version: typeof data.version === "number" ? data.version : 1,
    createdAt: data.createdAt || now,
    updatedAt: now
  };
}

module.exports = { validateTrip };

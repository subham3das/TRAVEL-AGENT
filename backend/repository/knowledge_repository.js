/**
 * Travel OS — Knowledge Repository (Static Facts)
 *
 * Serves ONLY static, verified travel knowledge:
 *   destinations, attractions, geography, food, culture, monuments,
 *   transport modes, seasons, tips, rules
 *
 * What is NOT here:
 *   hotels (moved to Search Repository — dynamic pricing/availability)
 *   flights (always dynamic — Search Repository only)
 *   bus/train schedules (dynamic — Search Repository)
 *   weather forecasts (dynamic — Search Repository)
 *
 * NOTE: Hotel FACTS (stars, amenities, location, images) may still exist
 * as KG nodes if the data is static. But pricing/availability never comes
 * from here — that comes from SearchRepository via providers.
 *
 * Engines that use this: RecommendationEngine, BudgetEngine, Planner
 * Engines that do NOT use this directly: BookingOrchestrator, FlightProvider
 */

"use strict";

const knowledgeService = require("../knowledge/knowledge_service");
const { Destination, Activity, Hotel } = require("../domain/models");

// Static types that belong in the Knowledge Repository
const STATIC_TYPES = new Set([
  "destination",
  "attraction",
  "restaurant",
  "transport",
  "region",
  "monument",
  "beach",
  "park",
  "temple",
  "museum",
  "market",
  "rule",
  "tip",
  "cuisine",
  "hotel"    // static facts only — no pricing
]);

class KnowledgeRepository {
  /**
   * Get a destination by id, returns Destination domain object.
   */
  getDestination(id) {
    if (!id) return null;
    const node = knowledgeService.getNode(id);
    if (!node) return null;
    return Destination({
      id:          node.id,
      name:        node.name,
      country:     node.country     || "India",
      region:      node.region      || null,
      coordinates: node.coordinates || null,
      seasons:     node.seasons     || node.bestMonths || [],
      timezone:    node.timezone    || "Asia/Kolkata",
      description: node.description || node.shortDescription || "",
      images:      node.images      || (node.image ? [node.image] : [])
    });
  }

  /**
   * Get all static nodes for a destination.
   * Excludes dynamic types (flights, schedules).
   */
  async getStaticNodes(destinationId) {
    if (!destinationId) return [];
    const result = knowledgeService.query({ destinationId });
    if (!result?.success) return [];
    return (result.data || []).filter(n => STATIC_TYPES.has(n.type));
  }

  /**
   * Get attractions (non-accommodation) for a destination.
   * Returns Activity domain objects.
   */
  async getAttractions(destinationId, travelStyle = "mid") {
    const nodes = await this.getStaticNodes(destinationId);
    const attractionTypes = new Set(["attraction", "beach", "monument", "temple", "museum", "park", "market"]);
    return nodes
      .filter(n => attractionTypes.has(n.type))
      .map(n => Activity({
        id:           n.id,
        name:         n.name,
        type:         n.type || "attraction",
        location:     n.location || destinationId,
        duration:     n.recommendedDuration,
        priceLabel:   n.ticketPrice || null,
        openingHours: n.openingHours || null,
        rating:       n.rating,
        description:  n.shortDescription || n.description || "",
        images:       n.images || (n.image ? [n.image] : []),
        source:       "knowledge_graph",
        confidence:   (n.priorityScore || 50) / 100
      }));
  }

  /**
   * Get restaurants for a destination.
   * Returns Activity domain objects with type="restaurant".
   */
  async getRestaurants(destinationId) {
    const nodes = await this.getStaticNodes(destinationId);
    return nodes
      .filter(n => n.type === "restaurant")
      .map(n => Activity({
        id:          n.id,
        name:        n.name,
        type:        "restaurant",
        location:    n.location || destinationId,
        description: n.description || `${n.cuisine?.join("/") || "Local"} cuisine.`,
        rating:      n.rating,
        images:      n.images || (n.image ? [n.image] : []),
        source:      "knowledge_graph",
        confidence:  (n.rating || 4) / 5
      }));
  }

  /**
   * Get hotel FACTS (static: name, stars, amenities, images).
   * NO pricing. NO availability. Those come from SearchRepository.
   * Returns Hotel domain objects.
   */
  async getHotelFacts(destinationId) {
    const nodes = await this.getStaticNodes(destinationId);
    return nodes
      .filter(n => n.type === "hotel")
      .map(n => Hotel({
        id:             n.id,
        name:           n.name,
        location:       n.location || destinationId,
        stars:          n.stars    || null,
        amenities:      n.amenities || [],
        images:         n.images   || (n.image ? [n.image] : []),
        description:    n.shortDescription || n.description || "",
        familyFriendly: n.familyFriendly   || false,
        pool:           n.pool              || false,
        wifi:           n.wifi              !== false,
        beachDistance:  n.beachDistance     || null,
        source:         "knowledge_graph",
        confidence:     0.9   // facts are high-confidence
      }));
  }

  /**
   * Raw node by ID.
   */
  getNode(id) {
    return knowledgeService.getNode(id);
  }

  /**
   * Raw query — use sparingly, prefer typed getters above.
   */
  query(criteria) {
    return knowledgeService.query(criteria);
  }
}

module.exports = new KnowledgeRepository();

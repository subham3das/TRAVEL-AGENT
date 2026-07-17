/**
 * Travel OS — Merge Engine
 *
 * Combines datasets from different sources (Knowledge Graph, Internet Search,
 * Providers, Memory) and produces a unified SearchResult shape.
 *
 * Implements strict Source Priority Rules:
 *   Provider > Internet Search > Knowledge Graph > Memory
 *
 * Sells raw merged result and the MergeDiagnostics mapping.
 */

"use strict";

const { SearchResult } = require("../domain/models");

class MergeEngine {
  /**
   * Merge multi-source payloads into unified SearchResult domain objects.
   *
   * @param {object} params
   * @param {object} [params.kgNode]        - static Knowledge Graph node
   * @param {object} [params.internetData]  - crawled/web search data
   * @param {object} [params.providerData]  - live ProviderResult pricing/avail
   * @param {object} [params.profile]       - TravelProfile user info
   * @param {string} [requestId]
   * @returns {{ result: object, diagnostics: object }}
   */
  merge(params, requestId = "") {
    const { kgNode, internetData, providerData, profile } = params;

    const id = providerData?.id || kgNode?.id || internetData?.id || `search-${Date.now()}`;
    const type = providerData?.type || kgNode?.type || internetData?.type || "unknown";

    const sources = {};
    const metadata = {};

    // 1. Title/Name: KG wins
    let title = "";
    if (kgNode?.name) {
      title = kgNode.name;
      sources.title = "knowledge_graph";
    } else if (internetData?.title || internetData?.name) {
      title = internetData.title || internetData.name;
      sources.title = "internet_search";
    } else if (providerData?.details?.name) {
      title = providerData.details.name;
      sources.title = "provider";
    } else {
      title = "Unknown Option";
      sources.title = "fallback";
    }

    // 2. Subtitle: descriptive label
    let subtitle = "";
    if (type === "hotel") {
      const stars = kgNode?.stars || providerData?.details?.stars;
      subtitle = stars ? `${stars}★ Hotel` : "Accommodation";
    } else if (type === "flight") {
      subtitle = providerData?.details?.flightNumber || "Flight";
    }

    // 3. Location / Address
    let location = null;
    if (kgNode?.location?.address || kgNode?.location) {
      location = kgNode.location.address || (typeof kgNode.location === "string" ? kgNode.location : null);
      sources.location = "knowledge_graph";
    } else if (internetData?.location) {
      location = internetData.location;
      sources.location = "internet_search";
    } else if (providerData?.details?.location) {
      location = providerData.details.location;
      sources.location = "provider";
    }

    // 4. Coordinates: KG always wins
    let coordinates = null;
    if (kgNode?.location?.latitude && kgNode?.location?.longitude) {
      coordinates = { latitude: kgNode.location.latitude, longitude: kgNode.location.longitude };
      sources.coordinates = "knowledge_graph";
    } else if (internetData?.coordinates) {
      coordinates = internetData.coordinates;
      sources.coordinates = "internet_search";
    }

    // 5. Description: KG wins, Internet enriches
    let description = "";
    if (kgNode?.description || kgNode?.shortDescription) {
      description = kgNode.description || kgNode.shortDescription;
      sources.description = "knowledge_graph";
    } else if (internetData?.description) {
      description = internetData.description;
      sources.description = "internet_search";
    } else if (providerData?.details?.description) {
      description = providerData.details.description;
      sources.description = "provider";
    }

    if (internetData?.snippets && Array.isArray(internetData.snippets)) {
      description += "\n\nHighlights: " + internetData.snippets.join(" · ");
      sources.description = "knowledge_graph + internet_search";
    }

    // 6. Amenities: KG wins, Provider/Internet appends
    const amenitiesSet = new Set(kgNode?.amenities || []);
    sources.amenities = "knowledge_graph";

    const additionalAmenities = providerData?.details?.amenities || internetData?.amenities || [];
    if (additionalAmenities.length > 0) {
      additionalAmenities.forEach(a => amenitiesSet.add(a));
      sources.amenities = "knowledge_graph + provider_appended";
    }
    const amenities = Array.isArray(kgNode?.amenities) ? Array.from(amenitiesSet) : additionalAmenities;

    // 7. Images: KG wins, Internet/Provider fills missing
    let images = [];
    if (kgNode?.images && kgNode.images.length > 0) {
      images = kgNode.images;
      sources.images = "knowledge_graph";
    } else if (kgNode?.image) {
      images = [kgNode.image];
      sources.images = "knowledge_graph";
    } else if (internetData?.images && internetData.images.length > 0) {
      images = internetData.images;
      sources.images = "internet_search";
    } else if (providerData?.details?.images && providerData.details.images.length > 0) {
      images = providerData.details.images;
      sources.images = "provider";
    }

    // 8. Rating: Internet wins over KG
    let rating = null;
    if (internetData?.rating) {
      rating = Number(internetData.rating);
      sources.rating = "internet_search";
    } else if (kgNode?.rating) {
      rating = Number(kgNode.rating);
      sources.rating = "knowledge_graph";
    }

    // 9. Pricing: Provider wins
    let pricing = { price: 0, currency: "INR", label: "Check pricing" };
    if (providerData?.price !== undefined) {
      pricing = {
        price: Number(providerData.price),
        currency: String(providerData.currency || "INR"),
        label: `₹${Number(providerData.price).toLocaleString("en-IN")}`
      };
      sources.pricing = "provider";
    } else if (kgNode?.averageCost || kgNode?.price) {
      const cost = kgNode.averageCost || kgNode.price;
      pricing = {
        price: Number(cost),
        currency: "INR",
        label: `₹${Number(cost).toLocaleString("en-IN")}`
      };
      sources.pricing = "knowledge_graph";
    }

    // 10. Availability: Provider wins
    let availability = { status: "available", source: providerData?.provider || "unknown", metadata: {} };
    if (providerData?.status) {
      availability = {
        status: String(providerData.status),
        source: String(providerData.provider || "provider"),
        metadata: {
          cancellationPolicy: providerData.details?.cancellationPolicy || null,
          roomsLeft: providerData.details?.roomsLeft || null,
          seatsLeft: providerData.details?.seatsLeft || null
        }
      };
      sources.availability = "provider";
    }

    // Diagnostics Mapping
    const diagnostics = {
      hotel: id,
      sources
    };

    const result = SearchResult({
      requestId,
      generatedAt: new Date().toISOString(),
      id,
      type,
      source: providerData ? "search_layer" : "knowledge_graph",
      title,
      subtitle,
      location,
      coordinates,
      images,
      pricing,
      availability,
      metadata: Object.assign(metadata, {
        amenities,
        rating,
        originalProvider: providerData?.provider || null
      })
    });

    return {
      result,
      diagnostics
    };
  }
}

module.exports = new MergeEngine();

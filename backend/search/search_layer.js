/**
 * Travel OS — Search Layer v2 (Multi-Provider)
 *
 * Master orchestrator for all travel inventory searches.
 *
 * Architecture:
 *   Search Layer
 *     ├── KG Static Lookup (knowledge_repository)
 *     ├── Provider Fanout (SearchProviderRegistry → all matching providers)
 *     │   ├── Google Places
 *     │   ├── Amadeus
 *     │   ├── Booking.com
 *     │   ├── Google Maps
 *     │   ├── Weather (OpenWeatherMap)
 *     │   └── Events (Eventbrite/Ticketmaster)
 *     ├── Deduplication (cross-provider)
 *     ├── Merge (KG + providers → SearchResult)
 *     ├── Confidence Scoring (source diversity)
 *     ├── Cache (Stale-While-Revalidate)
 *     └── Request Deduplication
 *
 * Everything above the Search Layer is provider-agnostic.
 */

"use strict";

const searchRepository = require("../repository/search_repository");
const knowledgeRepository = require("../repository/knowledge_repository");
const searchProviderRegistry = require("./providers/search_provider_registry");
const mergeEngine = require("./merge_engine");
const rankingEngine = require("./ranking_engine");
const confidenceEngine = require("../confidence/confidence_engine");
const { validateSearchResult } = require("../contracts/EngineContracts");
const eventBus = require("../events/event_bus");

const SCHEMA_VERSION = "2.0";
const PROVIDER_VERSION = "2.0";

const TTL_CONFIG = {
  hotel:      { soft: 10 * 60 * 1000, hard: 30 * 60 * 1000 },
  flight:     { soft:  5 * 60 * 1000, hard: 15 * 60 * 1000 },
  weather:    { soft: 15 * 60 * 1000, hard: 45 * 60 * 1000 },
  activity:   { soft: 30 * 60 * 1000, hard: 60 * 60 * 1000 },
  restaurant: { soft: 30 * 60 * 1000, hard: 60 * 60 * 1000 },
  events:     { soft: 30 * 60 * 1000, hard: 60 * 60 * 1000 },
  maps:       { soft: 10 * 60 * 1000, hard: 30 * 60 * 1000 }
};

class SearchLayer {
  constructor() {
    this.pendingRequests = new Map();
  }

  /**
   * Main Search Endpoint.
   *
   * @param {string} type - "hotel" | "flight" | "activity" | "restaurant" | "weather" | "events" | "maps"
   * @param {object} criteria
   * @param {object} [context] - TravelProfile context
   * @param {AbortSignal} [abortSignal]
   * @returns {Promise<object>} { status, results, metrics }
   */
  async search(type, criteria, context = null, abortSignal = null) {
    const startTime = Date.now();
    const requestId = criteria.requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sessionId = criteria.sessionId || "default-session";

    const destination = (criteria.destinationId || criteria.destination || "goa").toLowerCase();
    const dates = criteria.dates?.startDate || criteria.startDate || "any";
    const travellers = criteria.travelersType || criteria.travellers || "solo";
    const budget = criteria.budget || "any";

    // 1. Cache Key
    const key = `${destination}_${dates}_${travellers}_${budget}_${type}_v${SCHEMA_VERSION}_p${PROVIDER_VERSION}`;

    // 2. Cache Lookup (Stale-While-Revalidate)
    const cached = searchRepository.get(key);
    if (cached) {
      eventBus.emitEvent(sessionId, "CACHE_HIT", { type, key });
      if (cached.stale) {
        eventBus.emitEvent(sessionId, "CACHE_STALE", { type, key });
        this._fetchAndCache(type, criteria, context, key, requestId, sessionId, abortSignal).catch(err => {
          console.error(`[SearchLayer] Background refresh failed for ${key}:`, err.message);
        });
      }
      return {
        status: cached.stale ? "stale" : "complete",
        results: cached.data,
        metrics: { duration: Date.now() - startTime, cache: cached.stale ? "stale" : "hit", resultCount: cached.data.length, requestId }
      };
    }

    // 3. Request Deduplication
    if (this.pendingRequests.has(key)) {
      const results = await this.pendingRequests.get(key);
      return {
        status: "complete",
        results,
        metrics: { duration: Date.now() - startTime, cache: "deduplicated", resultCount: results.length, requestId }
      };
    }

    // 4. Execute
    const fetchPromise = this._fetchAndCache(type, criteria, context, key, requestId, sessionId, abortSignal);
    this.pendingRequests.set(key, fetchPromise);

    try {
      const results = await fetchPromise;
      return {
        status: "complete",
        results,
        metrics: { duration: Date.now() - startTime, cache: "miss", resultCount: results.length, requestId }
      };
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  /**
   * Core fetch → normalize → merge → confidence → cache pipeline.
   */
  async _fetchAndCache(type, criteria, context, key, requestId, sessionId, abortSignal) {
    const destinationId = criteria.destinationId || criteria.destination || "goa";
    eventBus.emitEvent(sessionId, "SEARCH_STARTED", { type, destinationId, providers: this._getProviderNames(type) });

    // ── 1. KG Static Lookup ──────────────────────────────────────────
    const kgNodes = await this._fetchKG(type, destinationId);

    // ── 2. Fan out to ALL providers for this type ─────────────────────
    const providerResults = await this._fetchProviders(type, criteria, sessionId, abortSignal);

    // ── 3. Deduplicate across providers ───────────────────────────────
    const deduplicated = this._deduplicate(providerResults);

    // ── 4. Merge KG + provider results ───────────────────────────────
    eventBus.emitEvent(sessionId, "MERGE_STARTED", { type });
    const mergedList = this._mergeResults(type, kgNodes, deduplicated, requestId);
    eventBus.emitEvent(sessionId, "MERGE_FINISHED", { type, count: mergedList.length });

    // ── 5. Rank ──────────────────────────────────────────────────────
    const ranked = rankingEngine.rank(mergedList.map(m => m.result), context);

    // ── 6. Confidence enrichment + contract validation ───────────────
    const finalized = [];
    for (let i = 0; i < ranked.length; i++) {
      const resultObj = ranked[i];
      const diag = mergedList[i]?.diagnostics;
      const enriched = confidenceEngine.enrich(resultObj, diag);
      eventBus.emitEvent(sessionId, "CONFIDENCE_READY", { id: enriched.id, score: enriched.confidence?.score });
      const validated = validateSearchResult(enriched);
      finalized.push(validated);
    }

    // ── 7. Cache ─────────────────────────────────────────────────────
    const ttl = TTL_CONFIG[type] || { soft: 10 * 60 * 1000, hard: 30 * 60 * 1000 };
    searchRepository.set(key, finalized, ttl.soft, ttl.hard);

    eventBus.emitEvent(sessionId, "SEARCH_FINISHED", { type, count: finalized.length });
    return finalized;
  }

  // ── KG Fetch ─────────────────────────────────────────────────────────

  async _fetchKG(type, destinationId) {
    try {
      if (type === "hotel") return await knowledgeRepository.getHotelFacts(destinationId);
      if (type === "restaurant") return await knowledgeRepository.getRestaurants(destinationId);
      return await knowledgeRepository.getAttractions(destinationId);
    } catch {
      return [];
    }
  }

  // ── Provider Fanout ──────────────────────────────────────────────────

  _getProviderNames(type) {
    return searchProviderRegistry.getProviders(type).map(p => p.name);
  }

  async _fetchProviders(type, criteria, sessionId, abortSignal) {
    const providers = searchProviderRegistry.getProviders(type);

    if (providers.length === 0) {
      eventBus.emitEvent(sessionId, "NO_PROVIDERS", { type });
      return [];
    }

    eventBus.emitEvent(sessionId, "PROVIDERS_FANOUT", {
      type,
      providers: providers.map(p => p.name)
    });

    // Query all providers in parallel with individual timeouts
    const tasks = providers.map(provider => this._queryProvider(provider, type, criteria, sessionId, abortSignal));
    const results = await Promise.allSettled(tasks);

    const collected = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const providerName = providers[i].name;

      if (result.status === "fulfilled" && Array.isArray(result.value)) {
        collected.push(...result.value);
        eventBus.emitEvent(sessionId, "PROVIDER_OK", { provider: providerName, count: result.value.length });
      } else {
        const reason = result.status === "rejected" ? result.reason?.message : "unknown";
        eventBus.emitEvent(sessionId, "PROVIDER_FAIL", { provider: providerName, reason });
      }
    }

    return collected;
  }

  async _queryProvider(provider, type, criteria, sessionId, abortSignal) {
    const searchCriteria = { ...criteria, type };
    const timeout = provider.timeout || 8000;

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${provider.name} timeout after ${timeout}ms`)), timeout);
    });

    try {
      const result = await Promise.race([
        provider.search(searchCriteria, abortSignal),
        timeoutPromise
      ]);
      return Array.isArray(result) ? result : [];
    } catch (err) {
      console.warn(`[SearchLayer] Provider ${provider.name} failed: ${err.message}`);
      return [];
    }
  }

  // ── Deduplication ────────────────────────────────────────────────────

  _deduplicate(results) {
    const seen = new Map(); // normalizedName → best result

    for (const r of results) {
      const normName = this._normalizeName(r.title || r.name || "");
      const normLoc = this._normalizeName(r.location || "");

      // Generate a fuzzy key from name + location
      const key = `${normName}__${normLoc.slice(0, 20)}`;

      if (!seen.has(key)) {
        seen.set(key, r);
      } else {
        // Keep the one with more data (rating, price, images)
        const existing = seen.get(key);
        const existingScore = (existing.rating ? 1 : 0) + (existing.price ? 1 : 0) + (existing.images?.length || 0);
        const newScore = (r.rating ? 1 : 0) + (r.price ? 1 : 0) + (r.images?.length || 0);
        if (newScore > existingScore) {
          seen.set(key, r);
        }
      }
    }

    return Array.from(seen.values());
  }

  _normalizeName(str) {
    return str.toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ── Merge ────────────────────────────────────────────────────────────

  _mergeResults(type, kgNodes, providerResults, requestId) {
    const mergedList = [];

    if (providerResults.length > 0) {
      for (const prov of providerResults) {
        const matchingKg = kgNodes.find(n =>
          n.id === prov.id ||
          this._normalizeName(n.name || "") === this._normalizeName(prov.title || prov.details?.name || "")
        );

        const merged = mergeEngine.merge({
          kgNode: matchingKg,
          internetData: null,
          providerData: this._toProviderResult(prov),
          profile: null
        }, requestId);

        mergedList.push(merged);
      }
    } else {
      // Fallback to KG-only
      for (const kg of kgNodes) {
        const merged = mergeEngine.merge({
          kgNode: kg,
          internetData: null,
          providerData: null,
          profile: null
        }, requestId);
        mergedList.push(merged);
      }
    }

    return mergedList;
  }

  _toProviderResult(normalized) {
    return {
      id: normalized.id || "",
      provider: normalized.provider || "unknown",
      type: normalized.type || "",
      price: normalized.price || 0,
      currency: normalized.currency || "INR",
      status: normalized.status || "available",
      details: {
        name: normalized.title || "",
        location: normalized.location || null,
        coordinates: normalized.coordinates || null,
        rating: normalized.rating || null,
        images: normalized.images || [],
        amenities: normalized.amenities || [],
        description: normalized.description || "",
        stars: normalized.stars || null
      }
    };
  }

  // ── Public: List available providers for a type ──────────────────────

  getProviders(type) {
    return searchProviderRegistry.getProviders(type).map(p => p.metadata());
  }

  /**
   * Health check all registered providers.
   */
  async healthCheck() {
    return searchProviderRegistry.healthCheck();
  }
}

module.exports = new SearchLayer();

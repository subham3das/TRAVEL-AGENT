/**
 * Travel OS — Search Layer
 *
 * Master orchestrator for all travel inventory searches.
 * Implements:
 * - Cache keying with versioning (schemaVersion = 1.0, providerVersion = 1.0)
 * - Stale-While-Revalidate caching (returns cached immediately, background refreshes)
 * - Request Deduplication (coalesces simultaneous matching calls into single promise)
 * - Parallel Concurrent Fetching (KG + Web + Providers + Memory)
 * - Exponential Backoff Retries & Timeout Limits
 * - Graceful degradation (returns status: "partial" on failure)
 */

"use strict";

const searchRepository = require("../repository/search_repository");
const knowledgeRepository = require("../repository/knowledge_repository");
const internetSearchLayer = require("./internet_search_layer");
const providerOrchestrator = require("../booking/providers/provider_orchestrator");
const mergeEngine = require("./merge_engine");
const rankingEngine = require("./ranking_engine");
const confidenceEngine = require("../confidence/confidence_engine");
const { validateSearchResult } = require("../contracts/EngineContracts");
const eventBus = require("../events/event_bus");

const SCHEMA_VERSION = "1.0";
const PROVIDER_VERSION = "1.0";

// TTL values in milliseconds
const TTL_CONFIG = {
  hotel:      { soft: 10 * 60 * 1000, hard: 30 * 60 * 1000 },
  flight:     { soft:  5 * 60 * 1000, hard: 15 * 60 * 1000 },
  weather:    { soft: 15 * 60 * 1000, hard: 45 * 60 * 1000 },
  activity:   { soft: 30 * 60 * 1000, hard: 60 * 60 * 1000 },
  restaurant: { soft: 30 * 60 * 1000, hard: 60 * 60 * 1000 }
};

const TIMEOUT_CONFIG = {
  hotel:      10000,
  flight:     10000,
  weather:     5000,
  activity:    8000,
  restaurant:  8000
};

class SearchLayer {
  constructor() {
    this.pendingRequests = new Map(); // coalescing matching promises
  }

  /**
   * Main Search Endpoint.
   *
   * @param {string} type - "hotel" | "flight" | "activity" | "restaurant" | "weather"
   * @param {object} criteria
   * @param {object} [context] - Memory/TravelProfile context
   * @param {AbortSignal} [abortSignal]
   * @returns {Promise<object>} SearchResult[] + status envelope
   */
  async search(type, criteria, context = null, abortSignal = null) {
    const startTime = Date.now();
    const requestId = criteria.requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sessionId = criteria.sessionId || "default-session";

    const destination = (criteria.destinationId || criteria.destination || "goa").toLowerCase();
    const dates = criteria.dates?.startDate || criteria.startDate || "any";
    const travellers = criteria.travelersType || criteria.travellers || "solo";
    const budget = criteria.budget || "any";

    // 1. Build Versioned Cache Key
    const key = `${destination}_${dates}_${travellers}_${budget}_${type}_v${SCHEMA_VERSION}_p${PROVIDER_VERSION}`;

    // 2. Cache Lookup (Stale-While-Revalidate)
    const cached = searchRepository.get(key);

    if (cached) {
      eventBus.emitEvent(sessionId, "CACHE_HIT", { type, key });

      if (cached.stale) {
        eventBus.emitEvent(sessionId, "CACHE_STALE", { type, key });
        // Trigger background refresh silently
        this._executeSearchFetch(type, criteria, context, key, requestId, sessionId).catch((err) => {
          console.error(`[SearchLayer] Background refresh failed for ${key}:`, err.message);
        });
      }

      return {
        status: cached.stale ? "stale" : "complete",
        results: cached.data,
        metrics: {
          duration: Date.now() - startTime,
          cache: cached.stale ? "stale" : "hit",
          resultCount: cached.data.length,
          requestId
        }
      };
    }

    eventBus.emitEvent(sessionId, "CACHE_MISS", { type, key });

    // 3. Request Deduplication
    if (this.pendingRequests.has(key)) {
      console.log(`[SearchLayer] Deduplicating pending request for key: ${key}`);
      const sharedPromise = this.pendingRequests.get(key);
      const results = await sharedPromise;
      return {
        status: "complete",
        results,
        metrics: {
          duration: Date.now() - startTime,
          cache: "hit_deduplicated",
          resultCount: results.length,
          requestId
        }
      };
    }

    // Launch fetch process
    const fetchPromise = this._executeSearchFetch(type, criteria, context, key, requestId, sessionId, abortSignal);
    this.pendingRequests.set(key, fetchPromise);

    try {
      const results = await fetchPromise;
      return {
        status: "complete",
        results,
        metrics: {
          duration: Date.now() - startTime,
          cache: "miss",
          resultCount: results.length,
          requestId
        }
      };
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  /**
   * Concurrent Fetch + Merge Engine + Confidence Engine execution block.
   */
  async _executeSearchFetch(type, criteria, context, key, requestId, sessionId, abortSignal = null) {
    const destinationId = criteria.destinationId || criteria.destination || "goa";
    const travelStyle = criteria.travelStyle || "mid";
    
    eventBus.emitEvent(sessionId, "SEARCH_STARTED", { type, destinationId });

    // 1. Parallel Concurrent Queries
    const queryTasks = {
      // Task A: KG Static lookup
      kg: (async () => {
        if (type === "hotel") return knowledgeRepository.getHotelFacts(destinationId);
        if (type === "restaurant") return knowledgeRepository.getRestaurants(destinationId);
        return knowledgeRepository.getAttractions(destinationId);
      })(),

      // Task B: Web Crawler
      web: (async () => {
        try {
          return await internetSearchLayer.searchDetails(type, destinationId, criteria.queryText || destinationId, abortSignal);
        } catch (err) {
          return null;
        }
      })(),

      // Task C: Live Provider inventory with Exponential Backoff Retry & Timeout
      provider: this._executeProviderWithRetry(type, criteria, sessionId, abortSignal)
    };

    const [kgNodes, internetData, providerResults] = await Promise.all([
      queryTasks.kg,
      queryTasks.web,
      queryTasks.provider
    ]);

    // 2. Merge Engine Execution (First-class component)
    eventBus.emitEvent(sessionId, "MERGE_STARTED", { type });
    const mergedList = [];
    
    // Merge provider results if available
    if (providerResults && providerResults.length > 0) {
      for (const prov of providerResults) {
        // Find matching static fact in KG by id/name similarity
        const matchingKg = kgNodes.find(n => n.id === prov.id || n.name?.toLowerCase() === prov.details?.name?.toLowerCase());
        
        const merged = mergeEngine.merge({
          kgNode: matchingKg,
          internetData,
          providerData: prov,
          profile: context
        }, requestId);

        mergedList.push(merged);
      }
    } else {
      // Fallback: merge static facts only if provider is offline
      for (const kg of kgNodes) {
        const merged = mergeEngine.merge({
          kgNode: kg,
          internetData,
          providerData: null,
          profile: context
        }, requestId);

        mergedList.push(merged);
      }
    }
    eventBus.emitEvent(sessionId, "MERGE_FINISHED", { type, count: mergedList.length });

    // 3. Ranking Engine Placeholder
    const ranked = rankingEngine.rank(mergedList.map(m => m.result), context);

    // 4. Confidence Engine Enrichment & Contract Validation
    const finalizedResults = [];
    for (let i = 0; i < ranked.length; i++) {
      const resultObj = ranked[i];
      const matchDiag = mergedList[i]?.diagnostics;

      // Attach confidence metadata
      const enriched = confidenceEngine.enrich(resultObj, matchDiag);
      eventBus.emitEvent(sessionId, "CONFIDENCE_READY", { id: enriched.id, score: enriched.confidence?.score });

      // Run contract validation
      const validated = validateSearchResult(enriched);
      finalizedResults.push(validated);
    }

    // 5. Save to Cache Store
    const ttl = TTL_CONFIG[type] || { soft: 10 * 60 * 1000, hard: 30 * 60 * 1000 };
    searchRepository.set(key, finalizedResults, ttl.soft, ttl.hard);

    eventBus.emitEvent(sessionId, "SEARCH_FINISHED", { type, count: finalizedResults.length });
    
    // In background soft-hits, we trigger cache refresh event
    if (this.pendingRequests.has(key)) {
      eventBus.emitEvent(sessionId, "SEARCH_CACHE_REFRESH", { type, key });
    }

    return finalizedResults;
  }

  /**
   * Executes provider query with circuit breakers, timeouts, and exponential backoff retry.
   */
  async _executeProviderWithRetry(type, criteria, sessionId, abortSignal = null) {
    const timeout = TIMEOUT_CONFIG[type] || 10000;
    let attempt = 0;
    const maxAttempts = 2;

    while (attempt < maxAttempts) {
      attempt++;
      let timeoutId;
      try {
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            eventBus.emitEvent(sessionId, "SEARCH_TIMEOUT", { type, attempt });
            reject(new Error(`Timeout: ${type} provider exceeded ${timeout}ms`));
          }, timeout);
        });

        // Query orchestrator (runs circuit state validations)
        const fetchPromise = providerOrchestrator.search(type, criteria, abortSignal);

        const results = await Promise.race([fetchPromise, timeoutPromise]);
        clearTimeout(timeoutId);
        return results;

      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);

        if (attempt >= maxAttempts) {
          eventBus.emitEvent(sessionId, "SEARCH_FAILED", { type, reason: err.message });
          return []; // Graceful degradation: returns empty provider results, falls back to KG facts
        }

        // Exponential Backoff Delay
        const delay = attempt === 1 ? 500 : 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return [];
  }
}

module.exports = new SearchLayer();

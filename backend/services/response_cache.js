const crypto = require("crypto");

/**
 * Travel Intelligence OS - Response Cache.
 *
 * Intent-based cache with planner state hashing.
 * Normalizes questions to intent keys, not raw text.
 * TTL-based expiry, no external dependencies.
 *
 * @module response_cache
 */

// ponytail: Map + timestamps, no LRU library
class ResponseCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 200;

    // Configurable TTLs in milliseconds
    this.ttls = {
      knowledge: 60 * 60 * 1000,        // 1 hour
      summary: 30 * 60 * 1000,           // 30 minutes
      tips: 2 * 60 * 60 * 1000,          // 2 hours
      weather: 15 * 60 * 1000,           // 15 minutes
      embedding: 24 * 60 * 60 * 1000     // 24 hours
    };

    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Generate planner state hash key.
   * Uses destination+days+budget+party+month+style, not object hash.
   */
  plannerKey(context) {
    const n = context?.state?.normalizedEntities || context?.normalizedEntities || {};
    const parts = [
      n.destination || "unknown",
      n.durationDays || 0,
      n.budget || 0,
      n.travelersType || "solo",
      n.travelStyle || "mid"
    ];
    // Add month if travel dates exist
    if (n.travelDates?.startDate) {
      const d = new Date(n.travelDates.startDate);
      if (!isNaN(d.getTime())) parts.push(d.getMonth());
    }
    return `summary:${parts.join(":")}`;
  }

  /**
   * Generate intent-based knowledge key.
   * Normalizes "What is Goa famous for?" and "Tell me about Goa" to same key.
   */
  knowledgeKey(destination, topic = "overview") {
    return `destination:${(destination || "").toLowerCase()}:${(topic || "overview").toLowerCase()}`;
  }

  /**
   * Detect knowledge topic from message.
   */
  detectTopic(message) {
    const clean = (message || "").toLowerCase();
    if (/\b(food|eat|cuisine|restaurant|dish)\b/.test(clean)) return "food";
    if (/\b(weather|climate|rain|temperature|season)\b/.test(clean)) return "weather";
    if (/\b(night|nightlife|club|bar|party)\b/.test(clean)) return "nightlife";
    if (/\b(beach|coast|shore|sea)\b/.test(clean)) return "beaches";
    if (/\b(temple|church|mosque|heritage|historical|monument|culture)\b/.test(clean)) return "culture";
    if (/\b(adventure|trek|hike|sport|dive|surf)\b/.test(clean)) return "adventure";
    if (/\b(shop|market|buy|souvenir)\b/.test(clean)) return "shopping";
    if (/\b(hotel|stay|resort|hostel|accommodation)\b/.test(clean)) return "accommodation";
    if (/\b(transport|bus|train|flight|cab|taxi|auto)\b/.test(clean)) return "transport";
    if (/\b(budget|cost|cheap|expensive|price)\b/.test(clean)) return "budget";
    if (/\b(safe|safety|danger|crime|scam)\b/.test(clean)) return "safety";
    if (/\b(tip|advice|suggest|recommend)\b/.test(clean)) return "tips";
    return "overview";
  }

  /**
   * Weather cache key.
   */
  weatherKey(destination, date) {
    return `weather:${(destination || "").toLowerCase()}:${date || "today"}`;
  }

  /**
   * Embedding cache key.
   */
  embeddingKey(text) {
    const hash = crypto.createHash("sha256").update(text).digest("hex").substring(0, 16);
    return `embedding:${hash}`;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    this.stats.hits++;
    return entry.value;
  }

  set(key, value, type = "knowledge") {
    const ttl = this.ttls[type] || this.ttls.knowledge;
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    this.cache.set(key, {
      value,
      type,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl
    });
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? Math.round((this.stats.hits / total) * 100) : 0,
      size: this.cache.size
    };
  }

  clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }
}

module.exports = new ResponseCache();

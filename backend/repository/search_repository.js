/**
 * Travel OS — Search Repository (Cache Storage Only)
 *
 * Exposes strictly cache operations:
 *   get(key), set(key, data, softTtl, hardTtl), invalidate(destinationId), clear(), cleanup().
 * Absolutely no normalization, validation, or confidence calculations.
 *
 * Cache key format:
 *   {destination}_{dates}_{travellers}_{budget}_{type}_{schemaVersion}_{providerVersion}
 */

"use strict";

class SearchRepository {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Fetch from cache.
   * @param {string} key
   * @returns {{ data: any, stale: boolean } | null}
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();

    // 1. If past hard TTL, entry is completely dead
    if (now > entry.hardExpiresAt) {
      this.cache.delete(key);
      return null;
    }

    // 2. If past soft TTL, entry is stale but returnable
    const stale = now > entry.softExpiresAt;

    return {
      data: entry.data,
      stale
    };
  }

  /**
   * Save to cache with separate Soft and Hard TTL.
   * @param {string} key
   * @param {any} data
   * @param {number} softTtlMs
   * @param {number} hardTtlMs
   */
  set(key, data, softTtlMs, hardTtlMs) {
    const now = Date.now();
    this.cache.set(key, {
      data,
      softExpiresAt: now + softTtlMs,
      hardExpiresAt: now + hardTtlMs
    });
  }

  /**
   * Invalidate all keys matching a destination ID.
   * @param {string} destinationId
   */
  invalidate(destinationId) {
    const cleanId = destinationId.toLowerCase();
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${cleanId}_`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache store.
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Evict all expired hard entries to free memory.
   */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.hardExpiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Diagnostic statistics.
   */
  stats() {
    return {
      size: this.cache.size
    };
  }
}

module.exports = new SearchRepository();

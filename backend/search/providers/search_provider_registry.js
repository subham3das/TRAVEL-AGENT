/**
 * Travel OS — Search Provider Registry
 *
 * Registry for all search-layer providers. Providers self-register by type.
 * The Search Layer queries this registry to find all providers for a given type,
 * then fans out queries in parallel.
 */

"use strict";

class SearchProviderRegistry {
  constructor() {
    /** @type {Map<string, import('./search_provider_base')[]>} */
    this.providers = new Map();
    /** @type {Map<string, import('./search_provider_base')>} */
    this.allProviders = new Map();
  }

  /**
   * Register a provider for one or more search types.
   * @param {import('./search_provider_base')} provider
   * @param {string[]} [types] - override provider.supportedTypes
   */
  register(provider, types = null) {
    const targetTypes = types || provider.supportedTypes;
    if (!Array.isArray(targetTypes) || targetTypes.length === 0) {
      console.warn(`[SearchRegistry] Provider ${provider.name} has no supported types — skipping`);
      return;
    }

    this.allProviders.set(provider.name, provider);

    for (const type of targetTypes) {
      if (!this.providers.has(type)) {
        this.providers.set(type, []);
      }
      const list = this.providers.get(type);
      // Avoid duplicates
      if (!list.find(p => p.name === provider.name)) {
        list.push(provider);
      }
    }

    console.log(`[SearchRegistry] Registered ${provider.name} for: ${targetTypes.join(", ")}`);
  }

  /**
   * Get all providers that support a given search type, sorted by priority.
   * @param {string} type
   * @returns {import('./search_provider_base')[]}
   */
  getProviders(type) {
    const list = this.providers.get(type) || [];
    return list.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get a single provider by name.
   * @param {string} name
   * @returns {import('./search_provider_base') | null}
   */
  getByName(name) {
    return this.allProviders.get(name) || null;
  }

  /**
   * List all registered provider names.
   * @returns {string[]}
   */
  listAll() {
    return Array.from(this.allProviders.keys());
  }

  /**
   * Check if any provider supports a given type.
   * @param {string} type
   * @returns {boolean}
   */
  hasProvider(type) {
    return this.providers.has(type) && this.providers.get(type).length > 0;
  }

  /**
   * Health check all providers.
   * @returns {Promise<object>}
   */
  async healthCheck() {
    const results = {};
    for (const [name, provider] of this.allProviders) {
      results[name] = await provider.health();
    }
    return results;
  }
}

module.exports = new SearchProviderRegistry();

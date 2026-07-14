import GeminiProvider from "./providers/gemini_provider.js";
import OpenAIProvider from "./providers/openai_provider.js";
import ClaudeProvider from "./providers/claude_provider.js";
import LocalProvider from "./providers/local_provider.js";

/**
 * Travel Intelligence OS - LLM Provider Registry.
 *
 * Exposes dynamic provider retrieval keys without hardcoded switch routing.
 * Conforms to provider_registry.js requirements.
 *
 * @module provider_registry
 */

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    // Default initializations
    this.register("gemini", new GeminiProvider());
    this.register("openai", new OpenAIProvider());
    this.register("claude", new ClaudeProvider());
    this.register("local", new LocalProvider());
  }

  register(name, providerInstance) {
    if (!name || typeof name !== "string") throw new Error("Invalid provider registration name");
    this.providers.set(name.toLowerCase(), providerInstance);
  }

  get(name) {
    const clean = (name || "").toLowerCase();
    const provider = this.providers.get(clean);
    if (!provider) {
      throw new Error(`Unregistered LLM provider: '${name}'`);
    }
    return provider;
  }
}

export default new ProviderRegistry();

import BaseLLMProvider from "./base_provider.js";

/**
 * Travel Intelligence OS - Local Llama Provider stub.
 *
 * Implements BaseLLMProvider contract.
 *
 * @module local_provider
 */

class LocalProvider extends BaseLLMProvider {
  async initialize() {
    return true;
  }

  async generate(prompt, config = {}) {
    throw new Error("Local Llama provider is not configured. Falling back to circuit breaker.");
  }

  async stream(prompt, config = {}, callback) {
    callback({ text: "Local stream", done: true });
  }

  async toolCall(prompt, tools = []) {
    return { success: false, error: "Not implemented stub" };
  }

  validateResponse(response, schema = {}) {
    return true;
  }

  async healthCheck() {
    return true;
  }
}

export default LocalProvider;

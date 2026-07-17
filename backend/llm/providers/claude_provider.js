import BaseLLMProvider from "./base_provider.js";

/**
 * Travel Intelligence OS - Claude Anthropic Provider stub.
 *
 * Implements BaseLLMProvider contract.
 *
 * @module claude_provider
 */

class ClaudeProvider extends BaseLLMProvider {
  async initialize() {
    return true;
  }

  async generate(prompt, config = {}) {
    throw new Error("Claude provider is not configured. Falling back to circuit breaker.");
  }

  async stream(prompt, config = {}, callback) {
    callback({ text: "Claude stream", done: true });
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

export default ClaudeProvider;

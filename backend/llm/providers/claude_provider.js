const BaseLLMProvider = require("./base_provider");

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
    return {
      success: true,
      text: "Claude mock response",
      raw: { model: "claude-3-5-sonnet" }
    };
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

module.exports = ClaudeProvider;

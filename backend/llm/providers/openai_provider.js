import BaseLLMProvider from "./base_provider.js";

/**
 * Travel Intelligence OS - OpenAI GPT Provider stub.
 *
 * Implements BaseLLMProvider contract.
 *
 * @module openai_provider
 */

class OpenAIProvider extends BaseLLMProvider {
  async initialize() {
    return true;
  }

  async generate(prompt, config = {}) {
    return {
      success: true,
      text: "OpenAI mock response",
      raw: { model: "gpt-4o" }
    };
  }

  async stream(prompt, config = {}, callback) {
    callback({ text: "OpenAI stream", done: true });
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

export default OpenAIProvider;

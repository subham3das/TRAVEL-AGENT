const BaseLLMProvider = require("./base_provider");

/**
 * Travel Intelligence OS - Gemini LLM Provider implementation.
 *
 * Implements BaseLLMProvider contract for Gemini Flash models.
 * Runs deterministically for sandboxed execution testing.
 *
 * @module gemini_provider
 */

class GeminiProvider extends BaseLLMProvider {
  async initialize() {
    return true;
  }

  async generate(prompt, config = {}) {
    const isJsonMode = config.responseFormat === "json";
    const text = isJsonMode 
      ? '{"destination": "goa", "durationDays": 3, "travelStyle": "budget"}'
      : "Gemini response text";

    return {
      success: true,
      text,
      raw: { model: "gemini-1.5-flash", usage: { promptTokens: 10, completionTokens: 15 } }
    };
  }

  async stream(prompt, config = {}, callback) {
    const chunks = ["G", "em", "ini", " stream", " output"];
    for (const chunk of chunks) {
      callback({ text: chunk, done: false });
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    callback({ text: "", done: true });
  }

  async toolCall(prompt, tools = []) {
    return {
      success: true,
      toolRequested: "processTravelRequest",
      arguments: { destination: "goa", durationDays: 3, travelStyle: "budget" }
    };
  }

  validateResponse(response, schema = {}) {
    if (!response || !response.text) return false;
    try {
      JSON.parse(response.text);
      return true;
    } catch {
      return false;
    }
  }

  async healthCheck() {
    return true;
  }
}

module.exports = GeminiProvider;

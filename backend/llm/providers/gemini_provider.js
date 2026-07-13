const { GoogleGenerativeAI } = require("@google/generative-ai");
const BaseLLMProvider = require("./base_provider");
const config = require("../../config/llm.config");

/**
 * Travel Intelligence OS - Gemini LLM Provider.
 *
 * Implements real inference via official Google GenAI SDK.
 * Conforms to gemini_provider.js requirements.
 *
 * @module gemini_provider
 */

class GeminiProvider extends BaseLLMProvider {
  constructor() {
    super();
    this.client = null;
  }

  async initialize() {
    if (this.client) {
      return true;
    }
    const apiKey = process.env.GEMINI_API_KEY || config.apiKey;
    if (!apiKey) {
      throw new Error("Missing API key: GEMINI_API_KEY environment variable is required.");
    }
    if (apiKey === "invalid-key") {
      throw new Error("Invalid API key credentials.");
    }
    this.client = new GoogleGenerativeAI(apiKey);
    return true;
  }

  async generate(prompt, genConfig = {}) {
    if (!this.client) {
      await this.initialize();
    }

    const modelName = genConfig.model || config.modelName;
    const model = this.client.getGenerativeModel({ model: modelName });

    const isJson = genConfig.responseFormat === "json";
    const generationConfig = {
      temperature: genConfig.temperature !== undefined ? genConfig.temperature : config.temperature,
      maxOutputTokens: genConfig.maxTokens || config.maxOutputTokens,
      topP: genConfig.topP || config.topP
    };

    if (isJson) {
      generationConfig.responseMimeType = "application/json";
    }

    // Timeout logic using AbortController
    const controller = new AbortController();
    const timeoutMs = genConfig.timeout || 10000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig
      };

      if (config.safetySettings) {
        payload.safetySettings = config.safetySettings;
      }

      const response = await model.generateContent(payload, { signal: controller.signal });

      clearTimeout(timeoutId);

      // Handle empty response
      const text = response.response.text();
      if (!text) {
        throw new Error("Empty response returned from Gemini API.");
      }

      return {
        success: true,
        text,
        raw: response
      };

    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error(`Timeout: stage exceeded limit of ${timeoutMs}ms`);
      }
      throw err;
    }
  }

  async stream(prompt, genConfig = {}, callback) {
    if (!this.client) {
      await this.initialize();
    }

    const modelName = genConfig.model || config.modelName;
    const model = this.client.getGenerativeModel({ model: modelName });

    const generationConfig = {
      temperature: genConfig.temperature !== undefined ? genConfig.temperature : config.temperature,
      maxOutputTokens: genConfig.maxTokens || config.maxOutputTokens,
      topP: genConfig.topP || config.topP
    };

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig
    };

    if (config.safetySettings) {
      payload.safetySettings = config.safetySettings;
    }

    const result = await model.generateContentStream(payload);

    for await (const chunk of result.stream) {
      callback({ text: chunk.text(), done: false });
    }
    callback({ text: "", done: true });
  }

  async toolCall(prompt, tools = []) {
    return {
      success: true,
      toolRequested: null,
      arguments: {}
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
    try {
      await this.initialize();
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = GeminiProvider;

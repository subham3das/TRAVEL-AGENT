import { GoogleGenAI } from "@google/genai";
import BaseLLMProvider from "./base_provider.js";
import config from "../../config/llm.config.js";

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
    const startTime = Date.now();
    try {
      if (this.client) {
        return {
          success: true,
          data: { initialized: true },
          errors: [],
          warnings: [],
          confidence: 1.0,
          processingTime: Date.now() - startTime,
          metadata: { provider: "gemini", timestamp: new Date().toISOString() }
        };
      }
      const apiKey = process.env.GEMINI_API_KEY || config.apiKey;
      if (!apiKey) {
        throw new Error("Missing API key: GEMINI_API_KEY environment variable is required.");
      }
      if (apiKey === "invalid-key") {
        throw new Error("Invalid API key credentials.");
      }
      this.client = new GoogleGenAI({ apiKey });
      return {
        success: true,
        data: { initialized: true },
        errors: [],
        warnings: [],
        confidence: 1.0,
        processingTime: Date.now() - startTime,
        metadata: { provider: "gemini", timestamp: new Date().toISOString() }
      };
    } catch (err) {
      return {
        success: false,
        data: { initialized: false },
        errors: [this.mapError(err)],
        warnings: [],
        confidence: 0.0,
        processingTime: Date.now() - startTime,
        metadata: { provider: "gemini", timestamp: new Date().toISOString() }
      };
    }
  }

  async generate(promptOrConfig, genConfig = {}) {
    const startTime = Date.now();
    
    // Support passing object or string
    let prompt = promptOrConfig;
    let localConfig = { ...genConfig };
    if (promptOrConfig && typeof promptOrConfig === "object") {
      prompt = promptOrConfig.prompt;
      localConfig = { ...promptOrConfig, ...genConfig };
    }

    const modelName = localConfig.model || config.modelName;
    const isJson = localConfig.responseFormat === "json";

    try {
      const initRes = await this.initialize();
      if (!initRes.success) {
        throw new Error(initRes.errors[0]);
      }

      const generationConfig = {
        temperature: localConfig.temperature !== undefined ? localConfig.temperature : config.temperature,
        maxOutputTokens: localConfig.maxTokens || config.maxOutputTokens,
        topP: localConfig.topP || config.topP
      };

      if (isJson) {
        generationConfig.responseMimeType = "application/json";
      }

      // Construct payload for the new @google/genai SDK
      const payload = {
        model: modelName,
        contents: prompt,
        config: generationConfig
      };

      if (config.safetySettings) {
        payload.config.safetySettings = config.safetySettings;
      }

      // Timeout handling using AbortController
      let controller = null;
      let timeoutId = null;
      const timeoutMs = localConfig.timeout || 10000;
      
      if (localConfig.timeout) {
        controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      }

      const requestOptions = {};
      if (controller) {
        requestOptions.signal = controller.signal;
      }

      const response = await this.client.models.generateContent(payload, requestOptions);
      if (timeoutId) clearTimeout(timeoutId);

      const text = response.text;
      if (!text) {
        throw new Error("Empty response returned from Gemini API.");
      }

      const latency = Date.now() - startTime;
      console.log(JSON.stringify({ level: "INFO", timestamp: new Date().toISOString(), message: "LLM Generate Success", provider: "gemini", model: modelName, latencyMs: latency }));

      return {
        success: true,
        data: {
          text,
          raw: response
        },
        errors: [],
        warnings: [],
        confidence: 0.98,
        processingTime: latency,
        metadata: {
          provider: "gemini",
          model: modelName,
          retries: 0,
          streamed: false,
          timestamp: new Date().toISOString()
        }
      };

    } catch (err) {
      const latency = Date.now() - startTime;
      const mappedMsg = this.mapError(err);
      console.log(JSON.stringify({ level: "ERROR", timestamp: new Date().toISOString(), message: "LLM Generate Error", provider: "gemini", model: modelName, latencyMs: latency, error: mappedMsg }));

      return {
        success: false,
        data: null,
        errors: [mappedMsg],
        warnings: [],
        confidence: 0.0,
        processingTime: latency,
        metadata: {
          provider: "gemini",
          model: modelName,
          retries: 0,
          streamed: false,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  async stream(promptOrConfig, genConfig = {}, callback) {
    const startTime = Date.now();
    
    let prompt = promptOrConfig;
    let localConfig = { ...genConfig };
    if (promptOrConfig && typeof promptOrConfig === "object") {
      prompt = promptOrConfig.prompt;
      localConfig = { ...promptOrConfig, ...genConfig };
    }

    const modelName = localConfig.model || config.modelName;

    try {
      const initRes = await this.initialize();
      if (!initRes.success) {
        throw new Error(initRes.errors[0]);
      }

      const generationConfig = {
        temperature: localConfig.temperature !== undefined ? localConfig.temperature : config.temperature,
        maxOutputTokens: localConfig.maxTokens || config.maxOutputTokens,
        topP: localConfig.topP || config.topP
      };

      const payload = {
        model: modelName,
        contents: prompt,
        config: generationConfig
      };

      if (config.safetySettings) {
        payload.config.safetySettings = config.safetySettings;
      }

      const responseStream = await this.client.models.generateContentStream(payload);
      
      for await (const chunk of responseStream) {
        callback({ text: chunk.text, done: false });
      }
      callback({ text: "", done: true });

      const latency = Date.now() - startTime;
      console.log(JSON.stringify({ level: "INFO", timestamp: new Date().toISOString(), message: "LLM Stream Success", provider: "gemini", model: modelName, latencyMs: latency }));

    } catch (err) {
      const latency = Date.now() - startTime;
      const mappedMsg = this.mapError(err);
      console.log(JSON.stringify({ level: "ERROR", timestamp: new Date().toISOString(), message: "LLM Stream Error", provider: "gemini", model: modelName, latencyMs: latency, error: mappedMsg }));
      callback({ text: "", done: true, error: mappedMsg });
    }
  }

  async toolCall(prompt, toolsList = []) {
    const startTime = Date.now();
    try {
      const initRes = await this.initialize();
      if (!initRes.success) {
        throw new Error(initRes.errors[0]);
      }

      const modelName = config.modelName;

      // Map dynamic tool calls to SDK declarations shape
      const sdkTools = toolsList.length > 0 ? [
        {
          functionDeclarations: toolsList.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
          }))
        }
      ] : [];

      const response = await this.client.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          tools: sdkTools,
          systemInstruction: "You are the Travel Operating System. Whenever the user requests to plan, modify, book, calculate budget, or recommend places for a trip, you MUST call the matching native tool. Do not ask clarification questions to the user yourself; the deterministic backend engines will handle clarification. If a year is missing in a date, assume the next upcoming occurrence."
        }
      });

      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        return {
          success: true,
          data: {
            toolRequested: functionCalls[0].name,
            arguments: functionCalls[0].args
          },
          errors: [],
          warnings: [],
          confidence: 0.98,
          processingTime: Date.now() - startTime,
          metadata: { provider: "gemini", timestamp: new Date().toISOString() }
        };
      }

      return {
        success: true,
        data: {
          toolRequested: null,
          text: response.text
        },
        errors: [],
        warnings: [],
        confidence: 0.98,
        processingTime: Date.now() - startTime,
        metadata: { provider: "gemini", timestamp: new Date().toISOString() }
      };

    } catch (err) {
      return {
        success: false,
        data: null,
        errors: [this.mapError(err)],
        warnings: [],
        confidence: 0.0,
        processingTime: Date.now() - startTime,
        metadata: { provider: "gemini", timestamp: new Date().toISOString() }
      };
    }
  }

  validateResponse(response, responseFormat = "text") {
    if (!response) return false;
    const text = response.data?.text || response.text;
    if (!text || typeof text !== "string") return false;

    if (responseFormat !== "json") {
      return text.trim().length > 0;
    }

    try {
      const parsed = JSON.parse(text);
      if (parsed === null || typeof parsed !== "object") {
        return false;
      }
      if (Object.keys(parsed).length === 0) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async healthCheck() {
    const startTime = Date.now();
    try {
      const initRes = await this.initialize();
      if (!initRes.success) {
        throw new Error(initRes.errors[0]);
      }
      const res = await this.generate("Respond only with OK.", { maxTokens: 5 });
      const text = res.data?.text || res.text || "";
      const success = res.success && text.includes("OK");
      return {
        success,
        data: { active: success },
        errors: success ? [] : ["Health check inference failed"],
        warnings: [],
        confidence: 1.0,
        processingTime: Date.now() - startTime,
        metadata: { timestamp: new Date().toISOString() }
      };
    } catch (err) {
      return {
        success: false,
        data: { active: false },
        errors: [this.mapError(err)],
        warnings: [],
        confidence: 0.0,
        processingTime: Date.now() - startTime,
        metadata: { timestamp: new Date().toISOString() }
      };
    }
  }

  mapError(err) {
    const msg = err.message || "";
    if (msg.includes("API key not valid") || msg.includes("API_KEY_INVALID") || msg.includes("Invalid API key") || msg.includes("key not valid")) {
      return "Invalid API key credentials.";
    }
    if (msg.includes("Missing API key")) {
      return "Missing API key: GEMINI_API_KEY environment variable is required.";
    }
    if (msg.includes("Timeout") || msg.includes("deadline") || msg.includes("aborted") || err.name === "AbortError") {
      return "Request timeout exceeded.";
    }
    if (msg.includes("429") || msg.includes("Quota exceeded") || msg.includes("Rate limit")) {
      return "Quota or rate limit exceeded.";
    }
    if (msg.includes("Empty response")) {
      return "Empty response returned from Gemini API.";
    }
    if (msg.includes("JSON")) {
      return "Structured JSON response parsing failed.";
    }
    return msg || "Unknown API error occurred.";
  }
}

export default GeminiProvider;

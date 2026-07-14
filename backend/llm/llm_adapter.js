import providerRegistry from "./provider_registry.js";

/**
 * Travel Intelligence OS - LLM Adapter.
 *
 * Core coordinator linking configuration options to target provider classes.
 * Conforms to llm_adapter_spec.md and implements retries and Response Contracts.
 *
 * @module llm_adapter
 */

class LLMAdapter {
  constructor() {
    this.defaultProvider = "gemini";
  }

  // 1. Generate text or JSON responses (Includes retry strategy on json checks)
  async generate(promptOrConfig, config = {}, providerName = this.defaultProvider) {
    const startTime = Date.now();
    const errors = [];

    // Support passing object or string
    let prompt = promptOrConfig;
    let localConfig = { ...config };
    if (promptOrConfig && typeof promptOrConfig === "object") {
      prompt = promptOrConfig.prompt;
      localConfig = { ...promptOrConfig, ...config };
    }

    const provider = providerRegistry.get(providerName);
    const modelName = localConfig.model || "default";

    try {
      const initRes = await provider.initialize();
      if (!initRes.success) {
        throw new Error(initRes.errors[0] || `Failed to initialize provider: '${providerName}'`);
      }

      let response = null;
      let retries = 0;
      const maxRetries = localConfig.responseFormat === "json" ? 3 : 1;

      while (retries < maxRetries) {
        response = await provider.generate(prompt, localConfig);
        
        if (response && response.success) {
          const isValid = provider.validateResponse(response, localConfig.responseFormat);
          if (isValid) {
            break;
          } else {
            retries++;
            if (retries >= maxRetries) {
              throw new Error("Structured JSON response parsing failed after 3 attempts.");
            }
          }
        } else {
          // If JSON mode was requested, we only retry if generation succeeded but validation failed
          throw new Error(response?.errors?.[0] || `Generation failed on provider: '${providerName}'`);
        }
      }

      return {
        success: true,
        data: {
          text: response.data.text,
          raw: response.data.raw
        },
        errors: [],
        warnings: [],
        confidence: 0.98,
        processingTime: Date.now() - startTime,
        metadata: {
          provider: providerName,
          model: modelName,
          retries,
          streamed: false,
          timestamp: new Date().toISOString()
        }
      };

    } catch (err) {
      errors.push(err.message);
      return {
        success: false,
        data: null,
        errors,
        warnings: [],
        confidence: 0.0,
        processingTime: Date.now() - startTime,
        metadata: {
          provider: providerName,
          model: modelName,
          retries: 0,
          streamed: false,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // 2. Stream completions
  async stream(promptOrConfig, config = {}, callback, providerName = this.defaultProvider) {
    try {
      const provider = providerRegistry.get(providerName);
      await provider.stream(promptOrConfig, config, callback);
    } catch (err) {
      callback({ text: "", done: true, error: err.message });
    }
  }

  // 3. Tool call resolution
  async toolCall(prompt, tools = [], providerName = this.defaultProvider) {
    const startTime = Date.now();
    try {
      const provider = providerRegistry.get(providerName);
      return await provider.toolCall(prompt, tools);
    } catch (err) {
      return {
        success: false,
        data: null,
        errors: [err.message],
        warnings: [],
        confidence: 0.0,
        processingTime: Date.now() - startTime,
        metadata: { provider: providerName, timestamp: new Date().toISOString() }
      };
    }
  }

  // 4. Health Check
  async healthCheck(providerName = this.defaultProvider) {
    try {
      const provider = providerRegistry.get(providerName);
      return await provider.healthCheck();
    } catch (err) {
      return {
        success: false,
        data: { active: false },
        errors: [err.message],
        warnings: [],
        confidence: 0.0,
        processingTime: 0,
        metadata: { timestamp: new Date().toISOString() }
      };
    }
  }
}

export default new LLMAdapter();

const providerRegistry = require("./provider_registry");

/**
 * Travel Intelligence OS - LLM Adapter.
 *
 * Core coordinator linking configuration options to target provider classes.
 * Conforms to llm_adapter_spec.md.
 *
 * @module llm_adapter
 */

class LLMAdapter {
  constructor() {
    this.defaultProvider = "gemini";
  }

  // 1. Generate text or JSON responses (Includes retry strategy on json checks)
  async generate(prompt, config = {}, providerName = this.defaultProvider) {
    const startTime = Date.now();
    const errors = [];

    try {
      const provider = providerRegistry.get(providerName);
      const initSuccess = await provider.initialize();
      if (!initSuccess) {
        throw new Error(`Failed to initialize provider: '${providerName}'`);
      }

      let response = null;
      let retries = 0;
      const maxRetries = config.responseFormat === "json" ? 3 : 1;

      while (retries < maxRetries) {
        response = await provider.generate(prompt, config);
        
        if (response && response.success) {
          if (config.responseFormat === "json") {
            const isValid = provider.validateResponse(response);
            if (isValid) {
              break;
            } else {
              retries++;
              if (retries >= maxRetries) {
                throw new Error("Structured JSON response parsing failed after 3 attempts.");
              }
            }
          } else {
            break;
          }
        } else {
          retries++;
          if (retries >= maxRetries) {
            throw new Error(response?.error || `Generation failed on provider: '${providerName}'`);
          }
        }
      }

      return {
        success: true,
        data: {
          text: response.text,
          raw: response.raw
        },
        errors,
        warnings: [],
        confidence: 0.98,
        processingTime: Date.now() - startTime,
        metadata: {
          provider: providerName,
          retries
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
          provider: providerName
        }
      };
    }
  }

  // 2. Stream completions
  async stream(prompt, config = {}, callback, providerName = this.defaultProvider) {
    try {
      const provider = providerRegistry.get(providerName);
      await provider.stream(prompt, config, callback);
    } catch (err) {
      callback({ text: "", done: true, error: err.message });
    }
  }

  // 3. Tool call resolution
  async toolCall(prompt, tools = [], providerName = this.defaultProvider) {
    const startTime = Date.now();
    const errors = [];

    try {
      const provider = providerRegistry.get(providerName);
      const res = await provider.toolCall(prompt, tools);
      
      return {
        success: res.success,
        data: res,
        errors,
        warnings: [],
        confidence: 0.98,
        processingTime: Date.now() - startTime,
        metadata: {
          provider: providerName
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
          provider: providerName
        }
      };
    }
  }

  // 4. Health Check
  async healthCheck(providerName = this.defaultProvider) {
    try {
      const provider = providerRegistry.get(providerName);
      return await provider.healthCheck();
    } catch {
      return false;
    }
  }
}

module.exports = new LLMAdapter();

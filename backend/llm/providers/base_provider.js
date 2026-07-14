/**
 * Travel Intelligence OS - Base LLM Provider.
 *
 * Abstract provider interface.
 * Conforms to llm_adapter_spec.md.
 *
 * @module base_provider
 */

class BaseLLMProvider {
  async initialize() {
    throw new Error("initialize() not implemented");
  }

  async generate(prompt, config = {}) {
    throw new Error("generate() not implemented");
  }

  async stream(prompt, config = {}, callback) {
    throw new Error("stream() not implemented");
  }

  async toolCall(prompt, tools = []) {
    throw new Error("toolCall() not implemented");
  }

  validateResponse(response, schema = {}) {
    throw new Error("validateResponse() not implemented");
  }

  async healthCheck() {
    throw new Error("healthCheck() not implemented");
  }
}

export default BaseLLMProvider;

import dotenv from "dotenv";
dotenv.config();

/**
 * Travel Intelligence OS - LLM Configuration.
 *
 * Conforms to llm.config.js requirements.
 *
 * @module llm_config
 */

export default {
  apiKey: process.env.GEMINI_API_KEY || null,
  modelName: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  temperature: 0.2,
  maxOutputTokens: 8192,
  topP: 0.95,
  safetySettings: [
    {
      category: "HARM_CATEGORY_HARASSMENT",
      threshold: "BLOCK_ONLY_HIGH"
    },
    {
      category: "HARM_CATEGORY_HATE_SPEECH",
      threshold: "BLOCK_ONLY_HIGH"
    },
    {
      category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      threshold: "BLOCK_ONLY_HIGH"
    },
    {
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      threshold: "BLOCK_ONLY_HIGH"
    }
  ]
};

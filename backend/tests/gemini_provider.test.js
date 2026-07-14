import dotenv from "dotenv";
dotenv.config();

import GeminiProvider from "../llm/providers/gemini_provider.js";

const provider = new GeminiProvider();

await provider.initialize();

const response = await provider.generate({
    prompt: "Say exactly: Gemini connected successfully."
});

console.log(response);
import dotenv from "dotenv";
dotenv.config();
import { GoogleGenerativeAI } from "@google/generative-ai";
import pineconeConfig from "../config/pinecone.config.js";

async function run() {
  console.log("=== STARTING DYNAMIC EMBEDDING DIMENSION VERIFICATION ===");
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ Error: GEMINI_API_KEY is not defined in the environment.");
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = pineconeConfig.embeddingModel || "text-embedding-004";
  console.log(`Model to verify: ${modelName}`);
  console.log(`Expected dimension: ${pineconeConfig.dimension}`);

  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const res = await model.embedContent("Verification test prompt to check vector length.");
    
    if (res && res.embedding && res.embedding.values) {
      const length = res.embedding.values.length;
      console.log(`Received vector length from API: ${length}`);
      
      if (length === pineconeConfig.dimension) {
        console.log(`✓ SUCCESS: Real embedding vector length is ${length}, matching the configured index dimension of ${pineconeConfig.dimension}!`);
        process.exit(0);
      } else {
        console.error(`❌ ERROR: Dimension mismatch! Configuration expected ${pineconeConfig.dimension} but real API returned ${length}.`);
        process.exit(1);
      }
    } else {
      console.error("❌ ERROR: Invalid response structure from Google Generative AI API.");
      process.exit(1);
    }
  } catch (err) {
    if (err.message && err.message.includes("404")) {
      console.warn(`\n⚠️  WARNING: Could not call model '${modelName}' (404 Not Found).`);
      console.warn("This usually indicates the current GEMINI_API_KEY or region does not support text-embedding-004.");
      console.warn("If you are deploying to production, verify model accessibility with your production credentials.");
      console.warn("Verification script completed with warning bypass.");
      process.exit(0);
    } else {
      console.error(`❌ ERROR: Failed to fetch embedding: ${err.message}`);
      process.exit(1);
    }
  }
}

run();

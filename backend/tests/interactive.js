import readline from "readline";
import dotenv from "dotenv";
import { createRequire } from "module";

dotenv.config();

const require = createRequire(import.meta.url);
const knowledgeService = require("../knowledge/knowledge_service.js");

// Initialize Knowledge Graph
knowledgeService.loadKnowledge();

const { default: adapter } = await import("../llm/llm_adapter.js");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("=========================================");
console.log("Travel Intelligence OS - Interactive CLI");
console.log("Type your travel request (e.g., 'Plan a 3-day budget trip to Goa')");
console.log("Type 'exit' or 'quit' to close.");
console.log("=========================================\n");

let activeContext = null;

function promptUser() {
  rl.question("You: ", async (query) => {
    const clean = query.trim();
    if (clean.toLowerCase() === "exit" || clean.toLowerCase() === "quit") {
      rl.close();
      return;
    }

    if (!clean) {
      promptUser();
      return;
    }

    console.log("\n[Processing request...]");
    try {
      const res = await adapter.processNaturalLanguage(clean, activeContext);
      
      if (res.success && res.metadata && res.metadata.activeContext) {
        activeContext = res.metadata.activeContext;
      }

      console.log("\n--- LLM Orchestrator Response ---");
      console.log(res.data?.text || "No summary response.");
      
      console.log("\n--- Tool Mapped ---");
      console.log(`Tool: ${res.data?.toolRequested || "None (General Chat)"}`);
      if (res.data?.toolArguments) {
        console.log(`Arguments: ${JSON.stringify(res.data.toolArguments)}`);
      }

      console.log("\n--- Response Contract Status ---");
      console.log(`Success: ${res.success}`);
      console.log(`Confidence: ${res.confidence}`);
      console.log(`Processing Time: ${res.processingTime}ms`);
      
      if (res.errors && res.errors.length > 0) {
        console.log(`Errors: ${res.errors.join(", ")}`);
      }
      console.log("---------------------------------\n");

    } catch (err) {
      console.error("\n[Error occurred]:", err.message);
    }
    
    promptUser();
  });
}

promptUser();

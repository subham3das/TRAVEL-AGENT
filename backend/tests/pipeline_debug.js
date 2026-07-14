import dotenv from "dotenv";
import { createRequire } from "module";

dotenv.config();

const require = createRequire(import.meta.url);
const knowledgeService = require("../knowledge/knowledge_service.js");

// Initialize Knowledge Graph
knowledgeService.loadKnowledge();

const { default: adapter } = await import("../llm/llm_adapter.js");
const { default: registry } = await import("../llm/provider_registry.js");

const geminiProvider = registry.get("gemini");

// If GEMINI_API_KEY is not defined, inject a mock client so the debug pass runs successfully without key
if (!process.env.GEMINI_API_KEY) {
  console.log("\n[Notice] GEMINI_API_KEY not found. Operating in Mock Mode for verification.");
  
  const mockModel = {
    async generateContent(req) {
      // 1. Tool Call request
      if (req.config?.tools) {
        if (req.contents.includes("starting 20 August")) {
          return {
            functionCalls: [
              {
                name: "plan_trip",
                args: { 
                  destination: "goa", 
                  durationDays: 5, 
                  startDate: "2026-08-20",
                  travelersType: "couple",
                  budget: 40000 
                }
              }
            ]
          };
        } else {
          return {
            functionCalls: [
              {
                name: "plan_trip",
                args: { 
                  destination: "goa", 
                  durationDays: 5 
                }
              }
            ]
          };
        }
      }

      // 2. Normal text generation (Summary)
      return {
        text: "Mocked final trip explanation for Scenario B."
      };
    }
  };

  geminiProvider.client = {
    models: mockModel
  };
} else {
  console.log("\n[Notice] Operating in Live Mode using real Gemini API key.");
}

async function runScenarioA() {
  console.log("\n=========================================");
  console.log("SCENARIO A: 'Plan me a 5 day Goa trip.'");
  console.log("=========================================");
  
  const res = await adapter.processNaturalLanguage("Plan me a 5 day Goa trip.");
  
  console.log("Scenario A Result:");
  console.log(res.data?.text);
}

async function runScenarioB() {
  console.log("\n=========================================");
  console.log("SCENARIO B: 'Plan me a 5 day Goa trip starting 20 August for 2 adults Budget ₹40,000'");
  console.log("=========================================");
  
  const res = await adapter.processNaturalLanguage("Plan me a 5 day Goa trip starting 20 August for 2 adults Budget ₹40,000");
  
  console.log("Scenario B Result:");
  console.log(res.data?.text || "No text returned.");
  if (res.data?.backendOutput) {
    console.log("Backend Status:", res.data.backendOutput.executionStatus);
  }
}

async function run() {
  await runScenarioA();
  await runScenarioB();
}

run().catch(console.error);

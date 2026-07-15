const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Load and initialize Knowledge Graph
const knowledgeService = require("./knowledge/knowledge_service.js");
knowledgeService.loadKnowledge();

// Load Usage Service
const usageService = require("./services/usage_service.js");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/system/status", async (req, res) => {
  try {
    const sessionKey = req.query.session || "default-session";
    const userKey = req.query.user || "default-user";
    const status = await usageService.getStatus(sessionKey, userKey);
    res.json(status);
  } catch (err) {
    console.error("System status error:", err);
    res.status(500).json({ error: "Failed to fetch system status" });
  }
});

// Dynamically import ES Module LLM Adapter
const llmAdapterPromise = import("./llm/llm_adapter.js").then((m) => m.default);

app.post("/api/chat", async (req, res) => {
  const startTime = Date.now();
  const sessionKey = req.headers["x-session-id"] || "default-session";
  const userKey = req.headers["x-user-id"] || "default-user";

  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });

    const llmAdapter = await llmAdapterPromise;
    const response = await llmAdapter.processNaturalLanguage(message, context);
    
    const latencyMs = Date.now() - startTime;
    const intentOrTool = response.data?.toolRequested || response.metadata?.activeContext?.state?.intent || "general_chat";

    // Record request dynamically inside usage engine
    await usageService.recordRequest(sessionKey, userKey, intentOrTool, latencyMs);

    res.json(response);
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Load and initialize Knowledge Graph
const knowledgeService = require("./knowledge/knowledge_service.js");
knowledgeService.loadKnowledge();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Dynamically import ES Module LLM Adapter
const llmAdapterPromise = import("./llm/llm_adapter.js").then((m) => m.default);

app.post("/api/chat", async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });

    const llmAdapter = await llmAdapterPromise;
    const response = await llmAdapter.processNaturalLanguage(message, context);
    res.json(response);
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

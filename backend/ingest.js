require("dotenv").config();

const { Pinecone } = require("@pinecone-database/pinecone");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index(process.env.PINECONE_INDEX || "travel-facts");

async function generateEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

async function ingest() {
  const filePath = path.join(__dirname, "travel_data.json");

  if (!fs.existsSync(filePath)) {
    console.error("travel_data.json not found in backend/");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  if (!Array.isArray(data) || data.length === 0) {
    console.error("travel_data.json must contain a non-empty array");
    process.exit(1);
  }

  console.log(`Loaded ${data.length} travel facts. Starting ingestion...\n`);

  const batchSize = 10;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);

    const vectors = await Promise.all(
      batch.map(async (item, idx) => {
        const text = typeof item === "string" ? item : item.text;
        const id = `fact-${i + idx}`;
        console.log(`  Embedding [${i + idx + 1}/${data.length}]`);
        const values = await generateEmbedding(text);
        return { id, values, metadata: { text } };
      })
    );

    await index.upsert(vectors);
    console.log(`  Upserted ${i + 1}-${Math.min(i + batchSize, data.length)} of ${data.length}\n`);
  }

  console.log("Ingestion complete.");
}

ingest().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});

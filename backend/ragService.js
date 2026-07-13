const { Pinecone } = require("@pinecone-database/pinecone");
const { GoogleGenerativeAI } = require("@google/generative-ai");

function getGenAI() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

function getPinecone() {
  return new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
}

async function generateEmbedding(text) {
  const model = getGenAI().getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

async function queryPinecone(userMessage) {
  const index = getPinecone().index(process.env.PINECONE_INDEX);
  const vector = await generateEmbedding(userMessage);

  const queryResponse = await index.query({
    vector,
    topK: 5,
    includeMetadata: true,
  });

  return queryResponse.matches.map((m) => m.metadata?.text || "").filter(Boolean);
}

async function generateResponse(userMessage, facts) {
  const factsBlock = facts.length
    ? "Relevant travel facts:\n" + facts.map((f) => `- ${f}`).join("\n")
    : "No specific travel facts found.";

  const prompt = `You are a helpful travel assistant. Answer the user's travel question using only the provided travel facts. If the facts don't contain enough information, say so politely.

${factsBlock}

User question: ${userMessage}`;

  const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function handleChat(userMessage) {
  const facts = await queryPinecone(userMessage);
  return generateResponse(userMessage, facts);
}

module.exports = { handleChat };

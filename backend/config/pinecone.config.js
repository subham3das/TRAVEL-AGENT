const path = require("path");
const fs = require("fs");

// Centralized configuration loader for Pinecone.
// Ensures dotenv is initialized exactly once and loads standard environment keys.

if (!process.env.PINECONE_API_KEY) {
  // Discover correct .env path dynamically relative to this config file
  const envPath = path.resolve(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
  } else {
    require("dotenv").config();
  }
}

const apiKey = process.env.PINECONE_API_KEY;
const indexName = process.env.PINECONE_INDEX;

module.exports = {
  apiKey: apiKey || null,
  indexName: indexName || null
};

import assert from "assert";
import { Pinecone } from "@pinecone-database/pinecone";
import pineconeConfig from "../config/pinecone.config.js";

async function run() {
  console.log("=== STARTING PINECONE INTEGRATION VALIDATION ===");

  // 1. Environment & Config
  assert.ok(pineconeConfig, "Centralized configuration loader must be loaded.");
  assert.ok(pineconeConfig.apiKey, "Pinecone API Key (PINECONE_API_KEY) must be detected.");
  assert.ok(pineconeConfig.indexName, "Pinecone Index Name (PINECONE_INDEX) must be detected.");
  console.log("Environment ✓");

  // 2. Pinecone client initialization
  let pc;
  try {
    pc = new Pinecone({
      apiKey: pineconeConfig.apiKey
    });
    assert.ok(pc, "Pinecone client instance must be successfully constructed.");
  } catch (err) {
    throw new Error(`Failed to initialize Pinecone client: ${err.message}`);
  }

  // 3. Connection verification
  let indexes;
  try {
    indexes = await pc.listIndexes();
    assert.ok(indexes, "listIndexes() must return a valid response.");
    console.log("Connection ✓");
  } catch (err) {
    throw new Error(`Failed to connect to Pinecone: ${err.message}`);
  }

  // 4. Configured index exists
  const targetIndex = pineconeConfig.indexName;
  const indexList = Array.isArray(indexes.indexes) ? indexes.indexes : indexes;
  const exists = indexList.some(idx => idx.name === targetIndex);

  if (!exists) {
    throw new Error(`Index not found. Run backend/scripts/setup_pinecone.js`);
  }
  console.log("Index ✓");

  // 5. Index READY and Dimension compatibility verification
  try {
    const indexDesc = await pc.describeIndex(targetIndex);
    assert.ok(indexDesc, "describeIndex() must return description metadata.");
    
    if (!indexDesc.status.ready) {
      throw new Error(`Index '${targetIndex}' is not ready for operations.`);
    }
    console.log("Ready ✓");

    if (indexDesc.dimension !== pineconeConfig.dimension) {
      throw new Error(`Dimension mismatch! Intended embedding model '${pineconeConfig.embeddingModel}' outputs ${pineconeConfig.dimension} dimensions, but configured Pinecone index '${targetIndex}' has ${indexDesc.dimension} dimensions.`);
    }
    console.log("Dimension ✓");
  } catch (err) {
    throw new Error(`Operational validation failed: ${err.message}`);
  }

  console.log("\n=== PINECONE INTEGRATION VALIDATION PASSED ===");
}

run().catch(err => {
  console.error("\n❌ PINECONE VALIDATION FAILED:");
  console.error(err.message || err);
  process.exit(1);
});
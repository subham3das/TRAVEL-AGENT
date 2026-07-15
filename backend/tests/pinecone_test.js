import assert from "assert";
import { Pinecone } from "@pinecone-database/pinecone";
import pineconeConfig from "../config/pinecone.config.js";

async function run() {
  console.log("=== STARTING PINECONE INTEGRATION VALIDATION ===");

  // 1. Verify environment loaded & API key detected
  console.log("Step 1: Verifying environment configuration...");
  assert.ok(pineconeConfig, "Centralized configuration loader must be loaded.");
  assert.ok(pineconeConfig.apiKey, "Pinecone API Key (PINECONE_API_KEY) must be detected in configuration.");
  assert.ok(pineconeConfig.indexName, "Pinecone Index Name (PINECONE_INDEX) must be detected in configuration.");
  console.log("  => Configuration loaded successfully.");
  console.log(`     API Key: Detected (${pineconeConfig.apiKey.substring(0, 10)}...)`);
  console.log(`     Index: ${pineconeConfig.indexName}`);

  // 2. Verify Pinecone client initialized
  console.log("Step 2: Initializing Pinecone client...");
  let pc;
  try {
    pc = new Pinecone({
      apiKey: pineconeConfig.apiKey
    });
    assert.ok(pc, "Pinecone client instance must be successfully constructed.");
    console.log("  => Pinecone client initialized successfully.");
  } catch (err) {
    throw new Error(`Failed to initialize Pinecone client: ${err.message}`);
  }

  // 3. Verify connection successful (listing indexes)
  console.log("Step 3: Verifying connection to Pinecone console...");
  let indexes;
  try {
    indexes = await pc.listIndexes();
    assert.ok(indexes, "listIndexes() must return a valid response.");
    console.log("  => Connection successful. Indexes listed:");
    console.log(JSON.stringify(indexes, null, 2));
  } catch (err) {
    throw new Error(`Failed to connect to Pinecone or list indexes: ${err.message}`);
  }

  // 4. Verify Index exists (Create if missing)
  console.log(`Step 4: Verifying target index '${pineconeConfig.indexName}' exists...`);
  const targetIndex = pineconeConfig.indexName;
  const indexList = Array.isArray(indexes.indexes) ? indexes.indexes : indexes;
  let exists = indexList.some(idx => idx.name === targetIndex);

  if (!exists) {
    console.log(`  => Index '${targetIndex}' does not exist. Creating index...`);
    try {
      await pc.createIndex({
        name: targetIndex,
        dimension: 1536,
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1"
          }
        }
      });
      console.log(`  => Index creation initiated successfully.`);
      
      let ready = false;
      let checkCount = 0;
      while (!ready && checkCount < 30) {
        console.log("     Waiting for index to become ready...");
        await new Promise(r => setTimeout(r, 5000));
        const desc = await pc.describeIndex(targetIndex);
        ready = desc.status.ready;
        checkCount++;
      }
      assert.ok(ready, "Index must become ready for operations.");
      exists = true;
      console.log(`  => Index '${targetIndex}' created and ready.`);
    } catch (err) {
      throw new Error(`Failed to create index: ${err.message}`);
    }
  } else {
    console.log(`  => Index '${targetIndex}' exists.`);
  }

  // 5. Verify Ready for vector operations
  console.log("Step 5: Describing index status & verifying operational readiness...");
  try {
    const indexDesc = await pc.describeIndex(targetIndex);
    assert.ok(indexDesc, "describeIndex() must return description metadata.");
    assert.strictEqual(indexDesc.status.ready, true, "Index status must be ready.");
    console.log("  => Index is ready for vector operations. Details:");
    console.log(`     Dimension: ${indexDesc.dimension}`);
    console.log(`     Metric: ${indexDesc.metric}`);
    console.log(`     Host: ${indexDesc.host}`);
  } catch (err) {
    throw new Error(`Failed describing index or index is not ready: ${err.message}`);
  }

  console.log("\n=== PINECONE INTEGRATION VALIDATION PASSED ===");
}

run().catch(err => {
  console.error("\n❌ PINECONE VALIDATION FAILED:");
  console.error(err.message || err);
  process.exit(1);
});
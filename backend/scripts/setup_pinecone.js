const { Pinecone } = require("@pinecone-database/pinecone");
const pineconeConfig = require("../config/pinecone.config");

async function run() {
  console.log("=== PINECONE INFRASTRUCTURE PROVISIONING ===");

  if (!pineconeConfig.apiKey) {
    console.error("Error: PINECONE_API_KEY is missing from environment.");
    process.exit(1);
  }

  const pc = new Pinecone({ apiKey: pineconeConfig.apiKey });

  console.log("Connecting to Pinecone...");
  const indexesResponse = await pc.listIndexes();
  const indexList = Array.isArray(indexesResponse.indexes) ? indexesResponse.indexes : indexesResponse;

  const targetIndex = pineconeConfig.indexName;
  const exists = indexList.some(idx => idx.name === targetIndex);

  if (exists) {
    console.log(`Index '${targetIndex}' already exists.`);
    
    // Check existing index description
    const desc = await pc.describeIndex(targetIndex);
    console.log(`Current dimension: ${desc.dimension}`);
    
    if (desc.dimension !== pineconeConfig.dimension) {
      console.warn(`WARNING: Dimension mismatch! Configuration requires ${pineconeConfig.dimension} but index has ${desc.dimension}.`);
    }
    console.log("No provisioning needed.");
    process.exit(0);
  }

  console.log(`Index '${targetIndex}' does not exist. Provisioning...`);
  console.log(`Configuration:`);
  console.log(`  Dimension: ${pineconeConfig.dimension}`);
  console.log(`  Metric: ${pineconeConfig.metric}`);
  console.log(`  Cloud: ${pineconeConfig.cloud}`);
  console.log(`  Region: ${pineconeConfig.region}`);

  try {
    await pc.createIndex({
      name: targetIndex,
      dimension: pineconeConfig.dimension,
      metric: pineconeConfig.metric,
      spec: {
        serverless: {
          cloud: pineconeConfig.cloud,
          region: pineconeConfig.region
        }
      }
    });
    console.log("Index creation initiated successfully.");

    let ready = false;
    let checkCount = 0;
    while (!ready && checkCount < 30) {
      console.log("Waiting for index to become ready (polling)...");
      await new Promise(r => setTimeout(r, 5000));
      const desc = await pc.describeIndex(targetIndex);
      ready = desc.status.ready;
      checkCount++;
    }

    if (ready) {
      console.log(`Index '${targetIndex}' is successfully provisioned and ready.`);
    } else {
      console.error("Index creation timed out.");
      process.exit(1);
    }
  } catch (err) {
    console.error(`Provisioning failed: ${err.message}`);
    process.exit(1);
  }
}

run().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});

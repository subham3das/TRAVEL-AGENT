const fs = require("fs");
const path = require("path");
const cache = require("../cache/knowledge_cache");
const { validateSchema, validateReferential } = require("../validator/graph_validator");

// ponytail: recursive JSON reader + schema validator + index builder
class KnowledgeLoader {
  constructor() {
    this.schemas = {};
    this.baseDir = path.resolve(__dirname, "..");
  }

  loadSchemas() {
    const schemasDir = path.join(this.baseDir, "schemas");
    const files = fs.readdirSync(schemasDir);

    for (const file of files) {
      if (file.endsWith(".schema.json")) {
        const type = file.replace(".schema.json", "");
        const filePath = path.join(schemasDir, file);
        const schemaContent = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        this.schemas[type] = schemaContent;
      }
    }
  }

  // Recursively read all files under a directory and filter for .json files
  readJsonFilesRecursively(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(this.readJsonFilesRecursively(filePath));
      } else if (file.endsWith(".json")) {
        results.push(filePath);
      }
    }
    return results;
  }

  load() {
    // Clear cache first
    cache.clear();

    // 1. Load schemas
    this.loadSchemas();

    const errors = [];
    const warnings = [];

    // Directories to scan (excluding 'schemas')
    const subDirs = ["destinations", "attractions", "restaurants", "hotels", "transport", "rules"];

    const filePaths = [];
    for (const subDir of subDirs) {
      const dirPath = path.join(this.baseDir, subDir);
      filePaths.push(...this.readJsonFilesRecursively(dirPath));
    }

    // 2. Load and validate individual nodes
    for (const filePath of filePaths) {
      try {
        const node = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        
        if (!node.type) {
          errors.push(`File '${path.basename(filePath)}' missing required 'type' field`);
          continue;
        }

        const schema = this.schemas[node.type];
        if (!schema) {
          errors.push(`No schema found for node type '${node.type}' in file '${path.basename(filePath)}'`);
          continue;
        }

        const schemaErrors = validateSchema(node, schema);
        if (schemaErrors.length > 0) {
          schemaErrors.forEach(err => {
            errors.push(`Schema violation in file '${path.basename(filePath)}' (ID: ${node.id}): ${err}`);
          });
          continue;
        }

        // Cache valid node
        cache.set(node.id, node);
      } catch (err) {
        errors.push(`Failed to parse file ${path.basename(filePath)}: ${err.message}`);
      }
    }

    // 3. Perform graph referential checks if no initial loading errors occurred
    if (errors.length === 0) {
      const refErrors = validateReferential(cache);
      errors.push(...refErrors);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      loadedCount: cache.getAll().length
    };
  }
}

module.exports = new KnowledgeLoader();

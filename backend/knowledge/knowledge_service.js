const loader = require("./loader/knowledge_loader");
const cache = require("./cache/knowledge_cache");
const queryEngine = require("./query/query_engine");

// Travel Intelligence OS - Knowledge Service Facade
class KnowledgeService {
  loadKnowledge() {
    return loader.load();
  }

  query(options = {}) {
    return queryEngine.query(options);
  }

  getNode(id) {
    return cache.get(id);
  }

  refreshCache() {
    return loader.load();
  }
}

module.exports = new KnowledgeService();

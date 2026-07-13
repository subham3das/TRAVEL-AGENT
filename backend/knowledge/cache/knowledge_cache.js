// ponytail: simple in-memory cache for graph nodes and indexes
class KnowledgeCache {
  constructor() {
    this.nodes = new Map(); // id -> node
    this.byDestination = new Map(); // destinationId -> Array of nodes
    this.byType = new Map(); // type -> Array of nodes
  }

  set(id, node) {
    this.nodes.set(id, node);

    // Index by destination
    if (node.destinationId) {
      if (!this.byDestination.has(node.destinationId)) {
        this.byDestination.set(node.destinationId, []);
      }
      this.byDestination.get(node.destinationId).push(node);
    }

    // Index by type
    if (node.type) {
      if (!this.byType.has(node.type)) {
        this.byType.set(node.type, []);
      }
      this.byType.get(node.type).push(node);
    }
  }

  get(id) {
    return this.nodes.get(id);
  }

  getAll() {
    return Array.from(this.nodes.values());
  }

  getByDestination(destId) {
    return this.byDestination.get(destId) || [];
  }

  getByType(type) {
    return this.byType.get(type) || [];
  }

  clear() {
    this.nodes.clear();
    this.byDestination.clear();
    this.byType.clear();
  }
}

module.exports = new KnowledgeCache();

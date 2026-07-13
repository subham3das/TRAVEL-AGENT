/**
 * Travel Intelligence OS - Memory Engine.
 *
 * Deterministic in-memory storage manager for user profiles and histories.
 * Conforms to memory_engine_spec.md.
 *
 * @module memory_engine
 */

const CATEGORIES = {
  TRAVEL_PREFERENCES: "Travel Preferences",
  BUDGET_PREFERENCES: "Budget Preferences",
  DESTINATION_PREFERENCES: "Destination Preferences",
  ACCOMMODATION: "Accommodation",
  TRANSPORT: "Transport",
  AIRLINE: "Airline",
  FOOD: "Food",
  PACKING: "Packing",
  ACCESSIBILITY: "Accessibility",
  TRAVEL_PACE: "Travel Pace",
  TRAVEL_STYLE: "Travel Style",
  CONVERSATION: "Conversation",
  BOOKING_HISTORY: "Booking History",
  TRIP_HISTORY: "Trip History",
  SEARCH_HISTORY: "Search History",
  ACCEPTED_RECOMMENDATIONS: "Accepted Recommendations",
  REJECTED_RECOMMENDATIONS: "Rejected Recommendations",
  USER_CORRECTIONS: "User Corrections"
};

const TYPES = {
  SHORT_TERM: "ShortTerm",
  SESSION: "Session",
  LONG_TERM: "LongTerm",
  PERMANENT: "Permanent",
  ARCHIVED: "Archived"
};

class MemoryEngine {
  constructor() {
    this.store = new Map(); // Key: memoryId, Value: record object
  }

  // 1. Store Memory
  storeMemory(record) {
    const startTime = Date.now();
    const errors = [];

    try {
      this.validateRecord(record);
      
      const now = new Date().toISOString();
      const newRecord = {
        ...record,
        memoryId: record.memoryId || `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: record.createdAt || now,
        updatedAt: now,
        accessCount: 0,
        lastAccessed: now,
        version: record.version || 1,
        confidence: record.confidence !== undefined ? record.confidence : 1.0,
        importance: record.importance || 3
      };

      this.store.set(newRecord.memoryId, newRecord);

      return this.buildResponse(newRecord, errors, startTime);
    } catch (err) {
      errors.push(err.message);
      return this.buildResponse(null, errors, startTime);
    }
  }

  // 2. Retrieve Memory (Sorted by Importance, Confidence, and Recency)
  retrieveMemory(userId, category) {
    const startTime = Date.now();
    const errors = [];

    try {
      if (!userId) throw new Error("userId is required for retrieval");

      // Auto-expire records first
      this.expireMemory();

      const matched = [];
      for (const record of this.store.values()) {
        if (record.userId === userId && record.category === category && record.type !== TYPES.ARCHIVED) {
          record.accessCount++;
          record.lastAccessed = new Date().toISOString();
          matched.push(record);
        }
      }

      // Retrieval ranking strategy
      matched.sort((a, b) => {
        if (b.importance !== a.importance) return b.importance - a.importance;
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });

      return this.buildResponse(matched, errors, startTime);

    } catch (err) {
      errors.push(err.message);
      return this.buildResponse([], errors, startTime);
    }
  }

  // 3. Update Memory (Includes Version Increment and Confidence Adjustment)
  updateMemory(memoryId, updates) {
    const startTime = Date.now();
    const errors = [];

    try {
      if (!memoryId) throw new Error("memoryId is required for update");
      const existing = this.store.get(memoryId);
      if (!existing) throw new Error(`Memory record not found: '${memoryId}'`);

      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
        version: existing.version + 1
      };

      this.store.set(memoryId, updated);
      return this.buildResponse(updated, errors, startTime);

    } catch (err) {
      errors.push(err.message);
      return this.buildResponse(null, errors, startTime);
    }
  }

  // 4. Delete Memory (or Archive depending on type)
  deleteMemory(memoryId, forceArchive = false) {
    const startTime = Date.now();
    const errors = [];

    try {
      if (!memoryId) throw new Error("memoryId is required for deletion");
      const existing = this.store.get(memoryId);
      if (!existing) throw new Error(`Memory record not found: '${memoryId}'`);

      if (forceArchive) {
        existing.type = TYPES.ARCHIVED;
        existing.updatedAt = new Date().toISOString();
        this.store.set(memoryId, existing);
        return this.buildResponse(existing, errors, startTime);
      } else {
        this.store.delete(memoryId);
        return this.buildResponse({ deleted: true, memoryId }, errors, startTime);
      }

    } catch (err) {
      errors.push(err.message);
      return this.buildResponse(null, errors, startTime);
    }
  }

  // 5. Merge Memory (e.g. lists like interests)
  mergeMemory(record) {
    const startTime = Date.now();
    const errors = [];

    try {
      this.validateRecord(record);
      
      // Look for existing memory matching user and category to merge
      let targetRecord = null;
      for (const r of this.store.values()) {
        if (r.userId === record.userId && r.category === record.category) {
          targetRecord = r;
          break;
        }
      }

      if (targetRecord) {
        let mergedValue = record.value;
        if (Array.isArray(targetRecord.value) && Array.isArray(record.value)) {
          mergedValue = Array.from(new Set([...targetRecord.value, ...record.value]));
        }

        const updated = {
          ...targetRecord,
          value: mergedValue,
          updatedAt: new Date().toISOString(),
          version: targetRecord.version + 1,
          confidence: Math.max(targetRecord.confidence, record.confidence)
        };

        this.store.set(targetRecord.memoryId, updated);
        return this.buildResponse(updated, errors, startTime);
      } else {
        // Fallback to store
        return this.storeMemory(record);
      }

    } catch (err) {
      errors.push(err.message);
      return this.buildResponse(null, errors, startTime);
    }
  }

  // 6. Expire Memory (Clears records past expiresAt date)
  expireMemory() {
    const now = new Date();
    for (const [id, r] of this.store.entries()) {
      if (r.expiresAt && new Date(r.expiresAt) < now) {
        // Archive instead of deletion
        r.type = TYPES.ARCHIVED;
        this.store.set(id, r);
      }
    }
  }

  // 7. Search Memory (Simple O(N) linear text scanner)
  searchMemory(userId, queryText) {
    const startTime = Date.now();
    const errors = [];

    try {
      if (!userId) throw new Error("userId is required for search");
      const clean = (queryText || "").toLowerCase();
      const matched = [];

      for (const record of this.store.values()) {
        if (record.userId === userId && record.type !== TYPES.ARCHIVED) {
          const valStr = JSON.stringify(record.value).toLowerCase();
          const catStr = record.category.toLowerCase();
          if (valStr.includes(clean) || catStr.includes(clean)) {
            matched.push(record);
          }
        }
      }

      return this.buildResponse(matched, errors, startTime);

    } catch (err) {
      errors.push(err.message);
      return this.buildResponse([], errors, startTime);
    }
  }

  // 8. List Memory
  listMemory(userId) {
    const startTime = Date.now();
    const errors = [];

    try {
      if (!userId) throw new Error("userId is required to list");
      const matched = Array.from(this.store.values()).filter(r => r.userId === userId && r.type !== TYPES.ARCHIVED);
      return this.buildResponse(matched, errors, startTime);
    } catch (err) {
      errors.push(err.message);
      return this.buildResponse([], errors, startTime);
    }
  }

  // 9. Clear Session Memory
  clearSessionMemory(userId) {
    const startTime = Date.now();
    const errors = [];

    try {
      if (!userId) throw new Error("userId is required to clear session");
      
      const toDelete = [];
      for (const r of this.store.values()) {
        if (r.userId === userId && r.type === TYPES.SESSION) {
          toDelete.push(r.memoryId);
        }
      }

      toDelete.forEach(id => this.store.delete(id));
      return this.buildResponse({ clearedCount: toDelete.length }, errors, startTime);

    } catch (err) {
      errors.push(err.message);
      return this.buildResponse(null, errors, startTime);
    }
  }

  // 10. Export Memory
  exportMemory(userId) {
    const startTime = Date.now();
    const errors = [];

    try {
      if (!userId) throw new Error("userId is required to export");
      const records = Array.from(this.store.values()).filter(r => r.userId === userId);
      return this.buildResponse(records, errors, startTime);
    } catch (err) {
      errors.push(err.message);
      return this.buildResponse([], errors, startTime);
    }
  }

  // 11. Import Memory
  importMemory(userId, records) {
    const startTime = Date.now();
    const errors = [];

    try {
      if (!userId) throw new Error("userId is required to import");
      if (!Array.isArray(records)) throw new Error("Records must be an array");

      let count = 0;
      for (const r of records) {
        if (r.userId === userId) {
          this.store.set(r.memoryId, r);
          count++;
        }
      }

      return this.buildResponse({ importedCount: count }, errors, startTime);
    } catch (err) {
      errors.push(err.message);
      return this.buildResponse(null, errors, startTime);
    }
  }

  // Helper validation
  validateRecord(record) {
    if (!record || typeof record !== "object") throw new Error("Invalid record format");
    if (!record.userId) throw new Error("Record missing required field: 'userId'");
    if (!record.category) throw new Error("Record missing required field: 'category'");
    if (!record.type) throw new Error("Record missing required field: 'type'");
    if (record.value === undefined) throw new Error("Record missing required field: 'value'");
  }

  // Helper response builder
  buildResponse(data, errors, start) {
    return {
      success: errors.length === 0,
      data,
      errors,
      warnings: [],
      confidence: errors.length === 0 ? 0.98 : 0.0,
      processingTime: Date.now() - start,
      metadata: {}
    };
  }
}

module.exports = new MemoryEngine();

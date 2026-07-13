const cache = require("../cache/knowledge_cache");
const {
  filterByDestination,
  filterByCategory,
  filterByTags,
  filterByBudget,
  filterByTimeOfDay,
  filterByAccessibility,
  filterByPlannerScore
} = require("./filters");
const { rankNodes } = require("./ranking");

// ponytail: Orchestrates filters and ranking, strictly outputs the standardized Response Contract
class QueryEngine {
  query(options = {}) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      const {
        type,
        destinationId,
        category,
        tags,
        budgetCategory,
        timeOfDay,
        accessibility,
        minPlannerScore,
        sortBy,
        scoreType
      } = options;

      // 1. Fetch source list from cache
      let nodes = type ? cache.getByType(type) : cache.getAll();

      // 2. Apply filters
      const filtered = nodes.filter(node => {
        return (
          filterByDestination(node, destinationId) &&
          filterByCategory(node, category) &&
          filterByTags(node, tags) &&
          filterByBudget(node, budgetCategory) &&
          filterByTimeOfDay(node, timeOfDay) &&
          filterByAccessibility(node, accessibility) &&
          filterByPlannerScore(node, minPlannerScore)
        );
      });

      // 3. Sort/Rank results
      const ranked = rankNodes(filtered, { sortBy, scoreType });

      // 4. Calculate aggregate confidence score
      let avgConfidence = 1.0;
      if (ranked.length > 0) {
        const sum = ranked.reduce((acc, curr) => acc + (curr.confidence || 0), 0);
        avgConfidence = Number((sum / ranked.length).toFixed(2));
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        data: ranked,
        errors,
        warnings,
        confidence: avgConfidence,
        processingTime,
        metadata: {
          totalCount: ranked.length,
          queryOptions: options
        }
      };
    } catch (err) {
      const processingTime = Date.now() - startTime;
      errors.push(err.message);
      return {
        success: false,
        data: [],
        errors,
        warnings,
        confidence: 0,
        processingTime,
        metadata: {
          queryOptions: options
        }
      };
    }
  }
}

module.exports = new QueryEngine();

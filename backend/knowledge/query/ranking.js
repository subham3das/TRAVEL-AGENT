// ponytail: simple sorting helper for query engine
function rankNodes(nodes, options = {}) {
  const { sortBy = "confidence", scoreType } = options;

  return [...nodes].sort((a, b) => {
    if (sortBy === "confidence") {
      return (b.confidence || 0) - (a.confidence || 0);
    }

    if (sortBy === "score" && scoreType) {
      const scoreA = a.plannerScore ? (a.plannerScore[scoreType] || 0) : 0;
      const scoreB = b.plannerScore ? (b.plannerScore[scoreType] || 0) : 0;
      return scoreB - scoreA;
    }

    return 0; // maintain original order
  });
}

module.exports = { rankNodes };

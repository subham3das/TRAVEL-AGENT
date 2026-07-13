// ponytail: reusable filter predicates for graph queries
function filterByDestination(node, destId) {
  if (!destId) return true;
  if (node.type === "destination") {
    return node.id === destId;
  }
  return node.destinationId === destId;
}

function filterByCategory(node, category) {
  if (!category) return true;
  const targetCategory = category.toLowerCase();
  
  if (node.category) {
    return node.category.toLowerCase() === targetCategory;
  }
  if (node.transportType) {
    return node.transportType.toLowerCase() === targetCategory;
  }
  if (Array.isArray(node.cuisine)) {
    return node.cuisine.some(c => c.toLowerCase() === targetCategory);
  }
  return false;
}

function filterByTags(node, tags) {
  if (!tags || !Array.isArray(tags) || tags.length === 0) return true;
  const nodeTags = (node.tags || []).concat(node.travelTags || []).map(t => t.toLowerCase());
  return tags.every(tag => nodeTags.includes(tag.toLowerCase()));
}

function filterByBudget(node, budgetCategory) {
  if (!budgetCategory) return true;
  const target = budgetCategory.toLowerCase();

  // Attraction
  if (node.budgetCategory) {
    return node.budgetCategory.toLowerCase() === target;
  }

  // Restaurant
  if (node.priceLevel) {
    if (target === "budget") return node.priceLevel === "$" || node.priceLevel === "$$";
    if (target === "mid") return node.priceLevel === "$$" || node.priceLevel === "$$$";
    if (target === "luxury") return node.priceLevel === "$$$" || node.priceLevel === "$$$$";
  }

  // Hotel category
  if (node.category) {
    if (node.category.toLowerCase() === target) return true;
  }

  return true;
}

function filterByTimeOfDay(node, timeOfDay) {
  if (!timeOfDay) return true;
  const target = timeOfDay.toLowerCase();

  // Attraction planner hints or time slots
  if (node.plannerHints && node.plannerHints.visitBefore) {
    if (node.plannerHints.visitBefore.toLowerCase() === target) return true;
  }

  // Check insights / tags or custom properties
  const matchesTag = (node.tags || []).some(t => t.toLowerCase() === target);
  if (matchesTag) return true;

  // Check opening hours text
  if (node.openingHours) {
    const hours = node.openingHours.toLowerCase();
    if (target === "morning" && (hours.includes("am") || hours.includes("24 hours"))) return true;
    if (target === "evening" && (hours.includes("pm") || hours.includes("24 hours"))) return true;
  }

  return false;
}

function filterByAccessibility(node, accessibilityList) {
  if (!accessibilityList || !Array.isArray(accessibilityList) || accessibilityList.length === 0) return true;

  return accessibilityList.every(feature => {
    // Check direct boolean flags
    if (node[feature] === true) return true;
    
    // Check specific wheelchair accessibility or child-friendly fields
    if (feature === "wheelchairAccessible" && node.wheelchairAccessible === true) return true;
    if (feature === "kidFriendly" && node.kidFriendly === true) return true;
    if (feature === "seniorFriendly" && node.seniorFriendly === true) return true;

    return false;
  });
}

function filterByPlannerScore(node, minScores) {
  if (!minScores || typeof minScores !== "object") return true;
  if (!node.plannerScore) return true; // non-attractions pass or skip depending on rule. Let's make non-attractions pass.

  return Object.entries(minScores).every(([scoreType, minVal]) => {
    const actualScore = node.plannerScore[scoreType];
    return actualScore !== undefined ? actualScore >= minVal : true;
  });
}

module.exports = {
  filterByDestination,
  filterByCategory,
  filterByTags,
  filterByBudget,
  filterByTimeOfDay,
  filterByAccessibility,
  filterByPlannerScore
};

const knowledgeService = require("../knowledge/knowledge_service");

// Abstract Price Provider to resolve pricing for nodes (can be replaced by booking APIs later)
class PriceProvider {
  getNodePrice(node, category, travelStyle = "mid") {
    if (!node) return 0;
    
    if (category === "hotel") {
      return node.averagePrice || 0;
    }
    if (category === "food") {
      return node.averageMealCost || 300;
    }
    if (category === "activity") {
      if (node.estimatedSpend) {
        return node.estimatedSpend[travelStyle] !== undefined ? node.estimatedSpend[travelStyle] : node.estimatedSpend.budget || 0;
      }
      return 0;
    }
    return 0;
  }
}

// Budget Engine
class BudgetEngine {
  constructor() {
    this.priceProvider = new PriceProvider();
  }

  calculate(context) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      const optimizedItinerary = context.recommendations?.optimizedItinerary ?? context.optimizedItinerary ?? context.improvedItinerary ?? context.draftItinerary ?? null;
      if (!optimizedItinerary) {
        throw new Error("No optimized itinerary found in TravelContext for budget calculation");
      }

      const userPrefs = context.user?.preferences || {};
      const normalized = context.state?.normalizedEntities ?? context.normalizedEntities ?? {};
      const userLimit = Number(normalized.budget || userPrefs.budget || 10000);
      const travelStyle = normalized.travelStyle || userPrefs.travelStyle || "mid";

      const dailyPlans = optimizedItinerary.dailyPlans || [];
      
      let totalHotel = 0;
      let totalTransport = 0;
      let totalFood = 0;
      let totalActivities = 0;
      let totalMisc = 0;

      const dailyBudgets = [];

      // 1. Calculate costs by day and slot
      for (const day of dailyPlans) {
        let dayHotel = 0;
        let dayTransport = 0;
        let dayFood = 0;
        let dayActivities = 0;
        let dayMisc = 0;

        for (const slot of day.slots) {
          if (slot.type === "stay") {
            const hotel = knowledgeService.getNode(slot.nodeId);
            dayHotel += this.priceProvider.getNodePrice(hotel, "hotel", travelStyle);
          } else if (slot.type === "lunch") {
            const rest = slot.nodeId ? knowledgeService.getNode(slot.nodeId) : null;
            dayFood += this.priceProvider.getNodePrice(rest, "food", travelStyle);
          } else if (slot.type === "activity" && slot.nodeId) {
            const attr = knowledgeService.getNode(slot.nodeId);
            dayActivities += this.priceProvider.getNodePrice(attr, "activity", travelStyle);
          } else if (slot.type === "travel") {
            dayTransport += slot.cost || 0;
          }
        }

        // Add 10% miscellaneous buffer of the day's baseline cost, flat capped
        const baseline = dayHotel + dayTransport + dayFood + dayActivities;
        dayMisc = Math.round(baseline * 0.1) || 100;

        const dayTotal = baseline + dayMisc;

        totalHotel += dayHotel;
        totalTransport += dayTransport;
        totalFood += dayFood;
        totalActivities += dayActivities;
        totalMisc += dayMisc;

        dailyBudgets.push({
          day: day.day,
          totalCost: dayTotal,
          breakdown: {
            hotel: dayHotel,
            transport: dayTransport,
            food: dayFood,
            activities: dayActivities,
            miscellaneous: dayMisc
          }
        });
      }

      const totalCost = totalHotel + totalTransport + totalFood + totalActivities + totalMisc;
      const remainingBudget = userLimit - totalCost;
      const overspent = totalCost > userLimit;

      // 2. Estimate Budget Risk
      let budgetRisk = "low";
      const ratio = totalCost / userLimit;
      if (ratio > 0.95) budgetRisk = "high";
      else if (ratio > 0.75) budgetRisk = "medium";

      // 3. Generate deterministic cost-saving suggestions
      const costSavingSuggestions = [];
      if (overspent) {
        if (totalHotel > 0) {
          costSavingSuggestions.push({
            category: "hotel",
            suggestion: "Downgrade stays to budget accommodations to save up to 50% on lodging costs.",
            impactEstimated: Math.round(totalHotel * 0.4)
          });
        }
        if (totalTransport > 500) {
          costSavingSuggestions.push({
            category: "transport",
            suggestion: "Utilize public transit modes or walking instead of private driving cabs.",
            impactEstimated: Math.round(totalTransport * 0.3)
          });
        }
        if (totalFood > 1000) {
          costSavingSuggestions.push({
            category: "food",
            suggestion: "Dine at local street shacks or budget restaurants instead of premium eateries.",
            impactEstimated: Math.round(totalFood * 0.2)
          });
        }
      }

      const categoryBreakdown = {
        hotel: totalHotel,
        transport: totalTransport,
        food: totalFood,
        activities: totalActivities,
        miscellaneous: totalMisc
      };

      const budgetSummary = {
        totalCost,
        userLimit,
        remainingBudget,
        overspent,
        budgetRisk
      };

      const validation = {
        valid: !overspent,
        warnings: overspent ? [`Trip cost (₹${totalCost}) exceeds your budget limit of ₹${userLimit}`] : []
      };

      const data = {
        budgetSummary,
        dailyBudgets,
        categoryBreakdown,
        remainingBudget,
        budgetRisk,
        costSavingSuggestions,
        validation
      };

      return {
        success: true,
        data,
        errors,
        warnings,
        confidence: 0.98,
        processingTime: Date.now() - startTime,
        metadata: {
          overspendRatio: Number(ratio.toFixed(2))
        }
      };

    } catch (err) {
      errors.push(err.message);
      return {
        success: false,
        data: null,
        errors,
        warnings,
        confidence: 0.0,
        processingTime: Date.now() - startTime,
        metadata: {}
      };
    }
  }
}

module.exports = new BudgetEngine();

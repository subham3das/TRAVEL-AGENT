const knowledgeService = require("../knowledge/knowledge_service");

// Travel Intelligence OS - Recommendation Engine
class RecommendationEngine {
  recommend(context) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      const optimizedItinerary = context.recommendations?.optimizedItinerary ?? context.optimizedItinerary ?? context.improvedItinerary ?? context.draftItinerary ?? null;
      if (!optimizedItinerary) {
        throw new Error("No itinerary found in TravelContext for recommendations");
      }

      const userPrefs = context.user?.preferences || {};
      const normalized = context.state?.normalizedEntities ?? context.normalizedEntities ?? {};
      
      const destinationId = normalized.destination || "goa";
      const travelersType = normalized.travelersType || userPrefs.travelersType || "solo";
      const travelStyle = normalized.travelStyle || userPrefs.travelStyle || "mid";
      const userInterests = normalized.interests || userPrefs.interests || [];
      const travelDates = normalized.travelDates || null;

      const seasonKey = this.getSeasonKey(travelDates);

      // Load destination nodes
      const queryRes = knowledgeService.query({ destinationId });
      if (!queryRes.success) {
        throw new Error("Failed to load Knowledge Graph data");
      }

      const allNodes = queryRes.data;
      const attractions = allNodes.filter(n => n.type === "attraction");
      const restaurants = allNodes.filter(n => n.type === "restaurant");
      const rules = allNodes.filter(n => n.type === "rule");

      // Extract currently scheduled node IDs
      const scheduledIds = [];
      const dailyPlans = optimizedItinerary.dailyPlans || [];
      for (const day of dailyPlans) {
        for (const slot of day.slots) {
          if (slot.nodeId) {
            scheduledIds.push(slot.nodeId);
          }
        }
      }

      // 1. Recommended Places (not already scheduled)
      const recommendedPlaces = attractions
        .filter(a => !scheduledIds.includes(a.id))
        .map(a => ({
          id: a.id,
          name: a.name,
          reason: `High match for your interest tags. Suitable for a ${travelersType} trip.`,
          score: a.plannerScore ? (a.plannerScore[travelersType] || 80) : 80
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

      // 2. Recommended Restaurants
      const recommendedRestaurants = restaurants
        .map(r => ({
          id: r.id,
          name: r.name,
          reason: `Offers authentic ${r.cuisine ? r.cuisine.join("/") : "local"} cuisine with a rating of ${r.rating || 4.5}/5.`,
          rating: r.rating || 4.5
        }))
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 2);

      // 3. Hidden Gems (priorityScore < 40 and high quality)
      const hiddenGems = attractions
        .filter(a => a.priorityScore < 50)
        .map(a => ({
          id: a.id,
          name: a.name,
          reason: `High rating but low crowd profile. Ideal off-beat spot in ${seasonKey} months.`,
          score: 90
        }));

      // 4. Food Recommendations
      const foodRecommendations = [
        { dish: "Goan Fish Curry", type: "Seafood", description: "Fresh catch cooked in spiced coconut gravy." },
        { dish: "Bebinca", type: "Dessert", description: "Traditional layered Indo-Portuguese sweet pudding." }
      ];

      // 5. Shopping Recommendations
      const shoppingRecommendations = [];
      const anjunaBeach = attractions.find(a => a.id === "goa_attraction_anjuna_beach");
      if (anjunaBeach) {
        shoppingRecommendations.push({
          area: "Anjuna Flea Market",
          details: "Famous Wednesday market for beachwear, local crafts, spices, and souvenirs."
        });
      }

      // 6. Packing Suggestions based on Season
      const packingSuggestions = [];
      if (seasonKey === "rain") {
        packingSuggestions.push("Umbrella/Raincoat", "Waterproof footwear", "Insect repellent");
      } else if (seasonKey === "summer") {
        packingSuggestions.push("Sunscreen SPF 50+", "Sunglasses & Hat", "Light cotton clothes");
      } else {
        packingSuggestions.push("Comfortable walking shoes", "Sunscreen", "Light jacket for evenings");
      }

      // 7. Safety Advice
      const safetyTips = [];
      const ruleNode = rules[0];
      if (ruleNode && ruleNode.alcoholRules) {
        safetyTips.push(ruleNode.alcoholRules);
      }
      safetyTips.push("Do not enter the sea if red warning flags are placed on beaches by lifeguards.");

      // 8. Seasonal Advice
      let seasonalAdvice = "Pleasant winter weather is ideal for water sports and outdoor beach exploration.";
      if (seasonKey === "rain") {
        seasonalAdvice = "Monsoon rain brings scenic greenery, but beach water sports are closed. Swim only inside pools.";
      } else if (seasonKey === "summer") {
        seasonalAdvice = "Mid-day heat can be intense. Plan indoor activities or restaurant breaks between 12:00 PM and 3:00 PM.";
      }

      // 9. Etiquette and local culture tips
      const culturalTips = [];
      if (ruleNode && ruleNode.dressCodes) {
        culturalTips.push(...ruleNode.dressCodes);
      }
      if (ruleNode && ruleNode.localCustoms) {
        culturalTips.push(...ruleNode.localCustoms);
      }

      // 10. Alternatives (same category replacements)
      const alternatives = {};
      for (const nodeId of scheduledIds) {
        const node = knowledgeService.getNode(nodeId);
        if (node && node.type === "attraction") {
          // Find an unscheduled attraction of the same category
          const altNode = attractions.find(a => a.category === node.category && a.id !== node.id && !scheduledIds.includes(a.id));
          if (altNode) {
            alternatives[node.id] = {
              id: altNode.id,
              name: altNode.name,
              reason: `Alternative ${altNode.category} with a lower crowd profile.`,
              score: altNode.priorityScore || 80
            };
          }
        }
      }

      const recommendationScores = {};
      attractions.forEach(a => {
        recommendationScores[a.id] = a.plannerScore ? (a.plannerScore[travelersType] || 80) : 80;
      });

      const data = {
        recommendedPlaces,
        recommendedRestaurants,
        hiddenGems,
        foodRecommendations,
        shoppingRecommendations,
        packingSuggestions,
        seasonalAdvice,
        safetyTips,
        culturalTips,
        alternatives,
        recommendationScores
      };

      return {
        success: true,
        data,
        errors,
        warnings,
        confidence: 0.95,
        processingTime: Date.now() - startTime,
        metadata: {
          recommendedPlacesCount: recommendedPlaces.length,
          alternativesCount: Object.keys(alternatives).length
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

  getSeasonKey(travelDates) {
    if (!travelDates) return "winter";
    let dateStr = "";
    if (typeof travelDates === "string") {
      dateStr = travelDates;
    } else if (travelDates.startDate) {
      dateStr = travelDates.startDate;
    }

    if (!dateStr) return "winter";

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "winter";

    const month = date.getMonth();
    if (month === 11 || month === 0 || month === 1) return "winter";
    if (month >= 5 && month <= 8) return "rain";
    if (month >= 2 && month <= 4) return "summer";
    return "sunny";
  }
}

module.exports = new RecommendationEngine();

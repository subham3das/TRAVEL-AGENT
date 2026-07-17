/**
 * Travel Intelligence OS - Template Renderer.
 *
 * Generates markdown trip summaries from deterministic planner output.
 * No LLM needed — the planner already knows everything.
 *
 * @module template_renderer
 */

class TemplateRenderer {
  /**
   * Render a complete trip summary from composed response data.
   * @param {object} composedData - output from ResponseComposer
   * @param {object} context - TravelContext
   * @returns {string} markdown-formatted trip summary
   */
  renderTripSummary(composedData, context) {
    if (!composedData) return "Trip planned successfully! Check your itinerary details.";

    const parts = [];
    const trip = composedData.tripSummary;
    const itinerary = composedData.dailyPlans;
    const budget = composedData.budgetBreakdown;
    const transport = composedData.transportPlan;
    const stay = composedData.stayPlan;
    const recommendations = composedData.recommendations;

    // Header
    if (trip) {
      const dest = (trip.destination || "your destination").charAt(0).toUpperCase() + (trip.destination || "your destination").slice(1);
      parts.push(`## \u2708\uFE0F Your ${trip.durationDays || ""} Day ${dest} Trip`);
      parts.push("");

      const tags = [];
      if (trip.travelStyle) tags.push(`\uD83C\uDFF7\uFE0F ${trip.travelStyle}`);
      if (trip.travelersType) tags.push(`\uD83D\uDC65 ${trip.travelersType}`);
      if (tags.length) parts.push(tags.join(" \u2022 "));
      parts.push("");
    }

    // Daily Plans
    if (itinerary && itinerary.length > 0) {
      parts.push("### \uD83D\uDCC5 Itinerary");
      parts.push("");

      for (const day of itinerary) {
        parts.push(`**Day ${day.day}**`);

        if (day.slots && day.slots.length > 0) {
          for (const slot of day.slots) {
            if (slot.type === "travel") continue; // Skip travel slots in summary
            const icon = this.getSlotIcon(slot.type);
            const time = slot.time || "";
            parts.push(`- ${icon} ${time ? `${time}: ` : ""}${slot.name || "Activity"}`);
          }
        }

        if (day.metrics) {
          const m = day.metrics;
          const details = [];
          if (m.distanceKm) details.push(`${m.distanceKm} km`);
          if (m.travelTimeMinutes) details.push(`${m.travelTimeMinutes} min travel`);
          if (details.length) parts.push(`  _${details.join(" \u2022 ")}_`);
        }
        parts.push("");
      }
    }

    // Stay
    if (stay) {
      parts.push("### \uD83C\uDFE8 Accommodation");
      parts.push(`- **${stay.hotelName || "Recommended Hotel"}**`);
      if (stay.pricePerNight) parts.push(`  \u20B9${stay.pricePerNight}/night`);
      parts.push("");
    }

    // Budget
    if (budget) {
      parts.push("### \uD83D\uDCB0 Budget Summary");
      if (budget.totalCost) parts.push(`- **Total Estimated Cost**: \u20B9${budget.totalCost.toLocaleString()}`);
      if (budget.budgetRisk) parts.push(`- **Budget Risk**: ${budget.budgetRisk}`);
      if (budget.dailyAverage) parts.push(`- **Daily Average**: \u20B9${budget.dailyAverage.toLocaleString()}`);
      parts.push("");
    }

    // Transport
    if (transport) {
      parts.push("### \uD83D\uDE97 Transport");
      if (transport.primaryMode) parts.push(`- **Mode**: ${transport.primaryMode}`);
      if (transport.totalTravelTimeMinutes) parts.push(`- **Total Travel Time**: ${transport.totalTravelTimeMinutes} min`);
      if (transport.transportCost) parts.push(`- **Transport Cost**: \u20B9${transport.transportCost}`);
      parts.push("");
    }

    // Recommendations
    if (recommendations) {
      if (recommendations.tips && recommendations.tips.length > 0) {
        parts.push("### \uD83D\uDCA1 Travel Tips");
        for (const tip of recommendations.tips.slice(0, 3)) {
          parts.push(`- ${tip}`);
        }
        parts.push("");
      }
      if (recommendations.safetyAdvice && recommendations.safetyAdvice.length > 0) {
        parts.push("### \u26A0\uFE0F Safety");
        for (const advice of recommendations.safetyAdvice.slice(0, 2)) {
          parts.push(`- ${advice}`);
        }
        parts.push("");
      }
    }

    if (parts.length === 0) {
      return "Trip planned successfully! Check the itinerary panel for your complete plan.";
    }

    return parts.join("\n");
  }

  /**
   * Render a clarification prompt.
   */
  renderClarification(missingFields) {
    const fieldLabels = {
      travelDates: "\uD83D\uDCC5 When would you like to travel?",
      travelersType: "\uD83D\uDC65 Who's traveling? (solo, couple, family, group)",
      travelStyle: "\uD83C\uDFF7\uFE0F What's your travel style? (budget, mid, luxury)",
      durationDays: "\u23F3 How many days?",
      budget: "\uD83D\uDCB0 What's your budget?",
      destination: "\uD83D\uDCCD Where would you like to go?"
    };

    const lines = ["I need a few more details to plan your trip:\n"];
    for (const field of missingFields) {
      lines.push(`- ${fieldLabels[field] || field}`);
    }
    return lines.join("\n");
  }

  /**
   * Render a Knowledge Graph answer for travel questions.
   */
  renderKnowledgeAnswer(destination, topic, nodes) {
    if (!nodes || nodes.length === 0) {
      return null; // Signal that LLM is needed
    }

    const dest = destination.charAt(0).toUpperCase() + destination.slice(1);
    const parts = [`Here's what I know about **${dest}**${topic !== "overview" ? ` (${topic})` : ""}:\n`];

    for (const node of nodes.slice(0, 5)) {
      if (node.name) {
        parts.push(`\u2022 **${node.name}**${node.category ? ` (${node.category})` : ""}`);
      }
      if (node.insights && node.insights.length > 0) {
        for (const insight of node.insights.slice(0, 2)) {
          parts.push(`  _${insight}_`);
        }
      }
    }

    return parts.join("\n");
  }

  getSlotIcon(type) {
    switch (type) {
      case "activity": return "\uD83C\uDFAF";
      case "stay": return "\uD83C\uDFE8";
      case "meal": return "\uD83C\uDF5C";
      case "transport": case "travel": return "\uD83D\uDE97";
      default: return "\u2022";
    }
  }

  renderGreeting() {
    return "Hi! I'm your travel assistant. Tell me where you'd like to go and I'll help plan your trip. You can say things like:\n\n• \"Plan a 3 day trip to Manali\"\n• \"Best time to visit Goa\"\n• \"Help\"";
  }
}

module.exports = new TemplateRenderer();

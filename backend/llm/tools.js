/**
 * Travel Intelligence OS - Tool definitions.
 *
 * Defines tool calling schemas for native function declarations.
 * Conforms to llm_adapter_spec.md.
 *
 * @module tools
 */

export const tools = [
  {
    name: "plan_trip",
    description: "Plan a new trip itinerary from scratch for a destination.",
    parameters: {
      type: "OBJECT",
      properties: {
        destination: { type: "STRING", description: "Target destination name (e.g. goa)" },
        durationDays: { type: "INTEGER", description: "Duration of the trip in days" },
        travelStyle: { type: "STRING", description: "budget, mid, or luxury" },
        travelersType: { type: "STRING", description: "solo, couple, family, or group" },
        startDate: { type: "STRING", description: "Start date in YYYY-MM-DD format" }
      },
      required: ["destination"]
    }
  },
  {
    name: "modify_trip",
    description: "Modify an existing trip configuration parameters (e.g. change budget, duration, or style).",
    parameters: {
      type: "OBJECT",
      properties: {
        destination: { type: "STRING", description: "Destination name" },
        durationDays: { type: "INTEGER", description: "New duration in days" },
        travelStyle: { type: "STRING", description: "New travel style" },
        budget: { type: "INTEGER", description: "New budget limit" }
      },
      required: ["destination"]
    }
  },
  {
    name: "book_trip",
    description: "Confirm and book hotels and transport for the planned itinerary.",
    parameters: {
      type: "OBJECT",
      properties: {
        destination: { type: "STRING", description: "Destination name to confirm booking for" }
      },
      required: ["destination"]
    }
  },
  {
    name: "calculate_budget",
    description: "Assess costs, daily limits, and category splits for a target budget.",
    parameters: {
      type: "OBJECT",
      properties: {
        destination: { type: "STRING", description: "Destination name" },
        budget: { type: "INTEGER", description: "Total budget limit" },
        travelStyle: { type: "STRING", description: "Travel style classification" }
      },
      required: ["destination", "budget"]
    }
  },
  {
    name: "recommend_places",
    description: "Get off-beat sightseeing places and restaurant suggestions.",
    parameters: {
      type: "OBJECT",
      properties: {
        destination: { type: "STRING", description: "Destination name" },
        interests: { type: "ARRAY", items: { type: "STRING" }, description: "Traveler interests list" }
      },
      required: ["destination"]
    }
  }
];

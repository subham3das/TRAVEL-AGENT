import { ApiResponse } from "./api";

export interface MockItinerary {
  dailyPlan: any[];
  budgetSummary: {
    totalCost: number;
    breakdown: {
      stays: number;
      activities: number;
      food: number;
      transport: number;
    };
  };
  composedText: string;
  weather: {
    temp: string;
    condition: string;
    precipitation: string;
  };
  packing: string[];
}

export const MOCK_GOA_TRIP: ApiResponse<MockItinerary> = {
  success: true,
  data: {
    dailyPlan: [
      {
        day: 1,
        slots: [
          {
            time: "09:00 AM - 12:00 PM",
            type: "activity",
            nodeId: "goa_attraction_baga_beach",
            name: "Baga Beach",
            category: "beach",
            transitFromPreviousMinutes: 0,
            score: { photography: 90 }
          },
          {
            time: "12:00 PM - 01:30 PM",
            type: "lunch",
            nodeId: "goa_restaurant_britannia",
            name: "Britannia Beach Shack",
            category: "local",
            transitFromPreviousMinutes: 15
          },
          {
            time: "01:30 PM - 05:00 PM",
            type: "activity",
            nodeId: "goa_attraction_anjuna_beach",
            name: "Anjuna Beach",
            category: "beach",
            transitFromPreviousMinutes: 20,
            score: { photography: 85 }
          },
          {
            time: "07:00 PM onwards",
            type: "stay",
            nodeId: "goa_hotel_budget_1",
            name: "Goa BUDGET Hotel 1",
            transitFromPreviousMinutes: 30
          }
        ],
        metrics: {
          travelTimeMinutes: 65,
          spend: 2350,
          fatigue: 3
        }
      },
      {
        day: 2,
        slots: [
          {
            time: "09:00 AM - 12:00 PM",
            type: "activity",
            nodeId: "goa_attraction_bom_jesus",
            name: "Basilica of Bom Jesus",
            category: "historical",
            transitFromPreviousMinutes: 40,
            score: { photography: 95 }
          },
          {
            time: "12:00 PM - 01:30 PM",
            type: "lunch",
            nodeId: "goa_restaurant_2",
            name: "Goa Fine Dining 2",
            category: "Indian",
            transitFromPreviousMinutes: 10
          },
          {
            time: "07:00 PM onwards",
            type: "stay",
            nodeId: "goa_hotel_budget_1",
            name: "Goa BUDGET Hotel 1",
            transitFromPreviousMinutes: 25
          }
        ],
        metrics: {
          travelTimeMinutes: 75,
          spend: 3400,
          fatigue: 4
        }
      },
      {
        day: 3,
        slots: [
          {
            time: "09:00 AM - 12:00 PM",
            type: "activity",
            nodeId: "goa_attraction_historical_4",
            name: "Goa Attraction HISTORICAL 4",
            category: "historical",
            transitFromPreviousMinutes: 30,
            score: { photography: 80 }
          },
          {
            time: "12:00 PM - 01:30 PM",
            type: "lunch",
            nodeId: "goa_restaurant_britannia",
            name: "Britannia Beach Shack",
            category: "local",
            transitFromPreviousMinutes: 15
          },
          {
            time: "07:00 PM onwards",
            type: "stay",
            nodeId: "goa_hotel_budget_1",
            name: "Goa BUDGET Hotel 1",
            transitFromPreviousMinutes: 20
          }
        ],
        metrics: {
          travelTimeMinutes: 65,
          spend: 1800,
          fatigue: 2
        }
      },
      {
        day: 4,
        slots: [
          {
            time: "09:00 AM - 12:00 PM",
            type: "activity",
            nodeId: "goa_attraction_beach_8",
            name: "Goa Attraction BEACH 8",
            category: "beach",
            transitFromPreviousMinutes: 35,
            score: { photography: 90 }
          },
          {
            time: "12:00 PM - 01:30 PM",
            type: "lunch",
            nodeId: "goa_restaurant_2",
            name: "Goa Fine Dining 2",
            category: "Indian",
            transitFromPreviousMinutes: 10
          },
          {
            time: "07:00 PM onwards",
            type: "stay",
            nodeId: "goa_hotel_budget_1",
            name: "Goa BUDGET Hotel 1",
            transitFromPreviousMinutes: 25
          }
        ],
        metrics: {
          travelTimeMinutes: 70,
          spend: 2200,
          fatigue: 3
        }
      },
      {
        day: 5,
        slots: [
          {
            time: "09:00 AM - 12:00 PM",
            type: "activity",
            nodeId: "goa_attraction_cultural_10",
            name: "Goa Attraction CULTURAL 10",
            category: "cultural",
            transitFromPreviousMinutes: 45,
            score: { photography: 92 }
          },
          {
            time: "12:00 PM - 01:30 PM",
            type: "lunch",
            nodeId: "goa_restaurant_britannia",
            name: "Britannia Beach Shack",
            category: "local",
            transitFromPreviousMinutes: 15
          },
          {
            time: "07:00 PM onwards",
            type: "stay",
            nodeId: "goa_hotel_budget_1",
            name: "Goa BUDGET Hotel 1",
            transitFromPreviousMinutes: 20
          }
        ],
        metrics: {
          travelTimeMinutes: 80,
          spend: 2150,
          fatigue: 4
        }
      }
    ],
    budgetSummary: {
      totalCost: 15711,
      breakdown: {
        stays: 7500,
        activities: 1200,
        food: 4500,
        transport: 2511
      }
    },
    composedText: "Curated 5-day Goa sequence assembled. Optimized stay at Goa BUDGET Hotel 1, connecting Baga Beach, Anjuna Beach, and Basilica of Bom Jesus with efficient transit routes.",
    weather: {
      temp: "29°C",
      condition: "Sunny & Humid",
      precipitation: "10% chance of rain"
    },
    packing: ["Sunscreen", "Beach sandals", "Modest temple attire", "Light cotton shirts", "Waterproof pouch"]
  },
  errors: [],
  warnings: [],
  confidence: 0.95,
  processingTime: 120,
  metadata: {
    apiVersion: "v1.0.0"
  }
};

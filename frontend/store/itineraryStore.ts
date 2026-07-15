import { create } from "zustand";

interface ItineraryState {
  dailyPlan: any[] | null;
  budgetSummary: any | null;
  setItinerary: (dailyPlan: any[], budgetSummary: any) => void;
  clearItinerary: () => void;
}

export const useItineraryStore = create<ItineraryState>((set) => ({
  dailyPlan: null,
  budgetSummary: null,
  setItinerary: (dailyPlan, budgetSummary) => set({ dailyPlan, budgetSummary }),
  clearItinerary: () => set({ dailyPlan: null, budgetSummary: null }),
}));

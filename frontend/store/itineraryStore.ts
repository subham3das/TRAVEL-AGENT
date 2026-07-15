import { create } from "zustand";

interface ItineraryState {
  dailyPlan: any[] | null;
  budgetSummary: any | null;
  activeContext: any | null;
  weather: any | null;
  packing: string[];
  setItinerary: (
    dailyPlan: any[],
    budgetSummary: any,
    activeContext?: any,
    weather?: any,
    packing?: string[]
  ) => void;
  clearItinerary: () => void;
}

export const useItineraryStore = create<ItineraryState>((set) => ({
  dailyPlan: null,
  budgetSummary: null,
  activeContext: null,
  weather: null,
  packing: [],
  setItinerary: (dailyPlan, budgetSummary, activeContext = null, weather = null, packing = []) =>
    set({ dailyPlan, budgetSummary, activeContext, weather, packing }),
  clearItinerary: () =>
    set({
      dailyPlan: null,
      budgetSummary: null,
      activeContext: null,
      weather: null,
      packing: [],
    }),
}));

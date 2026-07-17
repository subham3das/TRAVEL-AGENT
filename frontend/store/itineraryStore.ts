import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ItineraryState {
  dailyPlan: any[] | null;
  budgetSummary: any | null;
  activeContext: any | null;
  weather: any | null;
  travelScore: any | null;
  packing: string[];
  backendOutput: any | null;
  executionSummary: string | null;
  conversationState: string | null;
  nextActions: string[];
  tripSummary: any | null;
  recommendations: any | null;
  transportPlan: any | null;
  stayPlan: any | null;
  categoryBreakdown: any | null;
  isGenerating: boolean;
  generationStage: string;
  setItineraryFromResponse: (response: any) => void;
  clearItinerary: () => void;
  setGenerating: (isGenerating: boolean, stage?: string) => void;
}

export const useItineraryStore = create<ItineraryState>()(
  persist(
    (set) => ({
  dailyPlan: null,
  budgetSummary: null,
  activeContext: null,
  weather: null,
  travelScore: null,
  packing: [],
  backendOutput: null,
  executionSummary: null,
  conversationState: null,
  nextActions: [],
  tripSummary: null,
  recommendations: null,
  transportPlan: null,
  stayPlan: null,
  categoryBreakdown: null,
  isGenerating: false,
  generationStage: "Analyzing Travel Context...",
  setItineraryFromResponse: (res) => {
    const data = res?.data || {};
    const meta = res?.metadata || {};
    const bo = data.backendOutput || {};
    const ctx = meta.activeContext || null;

    set({
      dailyPlan: data.dailyPlan || bo.dailyPlan || null,
      budgetSummary: data.budgetSummary || bo.budgetSummary || null,
      activeContext: ctx,
      weather: bo.weatherAdvice || null,
      travelScore: data.travelScore || bo.travelScore || null,
      packing: bo.packingChecklist || [],
      backendOutput: bo,
      executionSummary: data.executionSummary || null,
      conversationState: bo.conversationState || null,
      nextActions: bo.nextActions || [],
      tripSummary: data.tripSummary || bo.tripSummary || null,
      recommendations: bo.recommendations || null,
      transportPlan: data.transportPlan || bo.transportPlan || null,
      stayPlan: data.stayPlan || bo.stayPlan || null,
      categoryBreakdown: data.categoryBreakdown || bo.categoryBreakdown || null,
      isGenerating: false,
    });
  },
  clearItinerary: () =>
    set({
      dailyPlan: null,
      budgetSummary: null,
      activeContext: null,
      weather: null,
      travelScore: null,
      packing: [],
      backendOutput: null,
      executionSummary: null,
      conversationState: null,
      nextActions: [],
      tripSummary: null,
      recommendations: null,
      transportPlan: null,
      stayPlan: null,
      categoryBreakdown: null,
      isGenerating: false,
    }),
  setGenerating: (isGenerating, stage) =>
    set((state) => ({
      isGenerating,
      generationStage: stage || state.generationStage
    })),
    }),
    {
      name: "travel-os-itinerary",
    }
  )
);

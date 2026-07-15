import { create } from "zustand";

interface UIState {
  theme: "dark" | "light";
  activeDayIndex: number;
  sidebarOpen: boolean;
  selectedSlotId: string | null;
  setTheme: (theme: "dark" | "light") => void;
  setActiveDay: (index: number) => void;
  toggleSidebar: () => void;
  setSelectedSlot: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: "dark",
  activeDayIndex: 1,
  sidebarOpen: true,
  selectedSlotId: null,
  setTheme: (theme) => set({ theme }),
  setActiveDay: (index) => set({ activeDayIndex: index }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSelectedSlot: (id) => set({ selectedSlotId: id }),
}));

import { create } from "zustand";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
}

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  currentTokens: string;
  addMessage: (text: string, role: "user" | "assistant" | "system") => void;
  setStreaming: (active: boolean) => void;
  appendTokens: (tokens: string) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [
    {
      id: "msg-1",
      role: "system",
      text: "Travel Intelligence OS active. Welcome to your journey.",
      timestamp: new Date().toISOString(),
    }
  ],
  isStreaming: false,
  currentTokens: "",
  addMessage: (text, role) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role,
          text,
          timestamp: new Date().toISOString(),
        },
      ],
    })),
  setStreaming: (active) => set({ isStreaming: active }),
  appendTokens: (tokens) =>
    set((state) => ({ currentTokens: state.currentTokens + tokens })),
  clearChat: () =>
    set({
      messages: [],
      isStreaming: false,
      currentTokens: "",
    }),
}));

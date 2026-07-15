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
  addMessage: (text: string, role: "user" | "assistant" | "system") => void;
  setStreaming: (active: boolean) => void;
  startAssistantMessage: () => void;
  updateActiveAssistantMessage: (tokens: string) => void;
  finalizeAssistantMessage: (finalText: string) => void;
  clearChat: () => void;
}

function validateUniqueIds(messages: Message[]) {
  const ids = messages.map((m) => m.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    console.warn(`[ChatStore Validation] Duplicate message IDs detected in store: ${duplicates.join(", ")}`);
  }
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

  addMessage: (text, role) =>
    set((state) => {
      const newMsg: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role,
        text,
        timestamp: new Date().toISOString(),
      };
      const updated = [...state.messages, newMsg];
      validateUniqueIds(updated);
      return { messages: updated };
    }),

  setStreaming: (active) => set({ isStreaming: active }),

  startAssistantMessage: () =>
    set((state) => {
      const activeMsg: Message = {
        id: "active-assistant",
        role: "assistant",
        text: "",
        timestamp: new Date().toISOString(),
      };
      const updated = [...state.messages, activeMsg];
      validateUniqueIds(updated);
      return { messages: updated };
    }),

  updateActiveAssistantMessage: (tokens) =>
    set((state) => {
      const updated = state.messages.map((m) => {
        if (m.id === "active-assistant") {
          return { ...m, text: m.text + tokens };
        }
        return m;
      });
      return { messages: updated };
    }),

  finalizeAssistantMessage: (finalText) =>
    set((state) => {
      const updated = state.messages.map((m) => {
        if (m.id === "active-assistant") {
          return {
            ...m,
            id: `msg-assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            text: finalText || m.text,
          };
        }
        return m;
      });
      validateUniqueIds(updated);
      return { messages: updated };
    }),

  clearChat: () =>
    set({
      messages: [],
      isStreaming: false,
    }),
}));

import { create } from "zustand";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
  status?: "streaming" | "complete" | "error" | "cancelled";
}

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  addMessage: (text: string, role: "user" | "assistant" | "system") => void;
  setStreaming: (active: boolean) => void;
  startAssistantMessage: () => string;
  updateAssistantMessage: (id: string, text: string) => void;
  finalizeAssistantMessage: (id: string, status?: "complete" | "error" | "cancelled", finalText?: string) => void;
  clearChat: () => void;
}

function assertSingleStreaming(messages: Message[]) {
  const streamingCount = messages.filter((m) => m.role === "assistant" && m.status === "streaming").length;
  if (streamingCount > 1) {
    throw new Error(`[ChatStore Assertion Failure] Multiple streaming assistant messages detected! Active streaming count: ${streamingCount}`);
  }
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [
    {
      id: "msg-1",
      role: "system",
      text: "Travel Intelligence OS active. Welcome to your journey.",
      timestamp: new Date().toISOString(),
      status: "complete",
    }
  ],
  isStreaming: false,

  addMessage: (text, role) =>
    set((state) => {
      const newMsg: Message = {
        id: `msg-${role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role,
        text,
        timestamp: new Date().toISOString(),
        status: "complete",
      };
      const updated = [...state.messages, newMsg];
      assertSingleStreaming(updated);
      return { messages: updated };
    }),

  setStreaming: (active) => set({ isStreaming: active }),

  startAssistantMessage: () => {
    let activeId = "";
    set((state) => {
      const existing = state.messages.find((m) => m.role === "assistant" && m.status === "streaming");
      if (existing) {
        activeId = existing.id;
        return {};
      }
      activeId = `msg-assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const activeMsg: Message = {
        id: activeId,
        role: "assistant",
        text: "",
        timestamp: new Date().toISOString(),
        status: "streaming",
      };
      const updated = [...state.messages, activeMsg];
      assertSingleStreaming(updated);
      return { messages: updated };
    });
    return activeId;
  },

  updateAssistantMessage: (id, text) =>
    set((state) => {
      const updated = state.messages.map((m) => {
        if (m.id === id) {
          return { ...m, text: m.text + text };
        }
        return m;
      });
      return { messages: updated };
    }),

  finalizeAssistantMessage: (id, status = "complete", finalText) =>
    set((state) => {
      const updated = state.messages.map((m) => {
        if (m.id === id) {
          return {
            ...m,
            status,
            text: finalText !== undefined ? finalText : m.text,
          };
        }
        return m;
      });
      assertSingleStreaming(updated);
      return { messages: updated };
    }),

  clearChat: () =>
    set({
      messages: [],
      isStreaming: false,
    }),
}));

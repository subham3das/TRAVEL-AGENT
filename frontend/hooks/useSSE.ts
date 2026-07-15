import { useState, useCallback } from "react";
import { useChatStore } from "@/store/chatStore";
import { useItineraryStore } from "@/store/itineraryStore";

export function useSSE() {
  const [error, setError] = useState<string | null>(null);
  const addMessage = useChatStore((s) => s.addMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const startAssistantMessage = useChatStore((s) => s.startAssistantMessage);
  const updateAssistantMessage = useChatStore((s) => s.updateAssistantMessage);
  const finalizeAssistantMessage = useChatStore((s) => s.finalizeAssistantMessage);

  const setItinerary = useItineraryStore((s) => s.setItinerary);

  const startStream = useCallback(
    (query: string, context?: any) => {
      setError(null);
      setStreaming(true);
      
      addMessage(query, "user");
      const activeId = startAssistantMessage();

      const contextParam = context ? `&context=${encodeURIComponent(JSON.stringify(context))}` : "";
      const eventSource = new EventSource(
        `/api/chat?message=${encodeURIComponent(query)}${contextParam}`
      );

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === "token") {
            updateAssistantMessage(activeId, payload.data.token);
          }

          if (payload.type === "result") {
            const res = payload.data.response;
            if (res.success) {
              setItinerary(
                res.data.dailyPlan,
                res.data.budgetSummary,
                res.data.activeContext,
                res.data.weather,
                res.data.packing
              );
              finalizeAssistantMessage(activeId, "complete", res.data.composedText || "Trip planned.");
            } else {
              setError(res.errors.join(", "));
              finalizeAssistantMessage(activeId, "error", `Failed to process plan: ${res.errors.join(", ")}`);
            }
            eventSource.close();
            setStreaming(false);
          }
        } catch (err) {
          console.error("Failed to parse SSE payload:", err);
          setError("Malformed stream data received");
          finalizeAssistantMessage(activeId, "error", "Error occurred during response generation.");
          eventSource.close();
          setStreaming(false);
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE stream error:", err);
        setError("Connection to stream failed");
        finalizeAssistantMessage(activeId, "error", "Connection to travel assistant was lost.");
        eventSource.close();
        setStreaming(false);
      };

      return () => {
        eventSource.close();
        setStreaming(false);
      };
    },
    [
      addMessage,
      setStreaming,
      startAssistantMessage,
      updateAssistantMessage,
      finalizeAssistantMessage,
      setItinerary,
    ]
  );

  return { startStream, error };
}

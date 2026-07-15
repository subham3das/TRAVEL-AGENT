import { useState, useCallback } from "react";
import { useChatStore } from "@/store/chatStore";
import { useItineraryStore } from "@/store/itineraryStore";

export function useSSE() {
  const [error, setError] = useState<string | null>(null);
  const appendTokens = useChatStore((s) => s.appendTokens);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const addMessage = useChatStore((s) => s.addMessage);
  const setItinerary = useItineraryStore((s) => s.setItinerary);

  const startStream = useCallback(
    (query: string) => {
      setError(null);
      setStreaming(true);
      
      addMessage(query, "user");

      const eventSource = new EventSource(
        `/api/chat?message=${encodeURIComponent(query)}`
      );

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === "token") {
            appendTokens(payload.data.token);
          }

          if (payload.type === "result") {
            const res = payload.data.response;
            if (res.success) {
              setItinerary(res.data.dailyPlan, res.data.budgetSummary);
              addMessage(res.data.composedText || "Trip structured successfully.", "assistant");
            } else {
              setError(res.errors.join(", "));
            }
            eventSource.close();
            setStreaming(false);
          }
        } catch (err) {
          console.error("Failed to parse SSE payload:", err);
          setError("Malformed stream data received");
          eventSource.close();
          setStreaming(false);
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE stream error:", err);
        setError("Connection to stream failed");
        eventSource.close();
        setStreaming(false);
      };

      return () => {
        eventSource.close();
        setStreaming(false);
      };
    },
    [addMessage, appendTokens, setStreaming, setItinerary]
  );

  return { startStream, error };
}

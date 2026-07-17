import { useState, useCallback, useRef } from "react";
import { useChatStore } from "@/store/chatStore";
import { useItineraryStore } from "@/store/itineraryStore";
import { useQueryClient } from "@tanstack/react-query";

export function useSSE() {
  const [error, setError] = useState<string | null>(null);
  const addMessage = useChatStore((s) => s.addMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const startAssistantMessage = useChatStore((s) => s.startAssistantMessage);
  const updateAssistantMessage = useChatStore((s) => s.updateAssistantMessage);
  const finalizeAssistantMessage = useChatStore((s) => s.finalizeAssistantMessage);

  const setItineraryFromResponse = useItineraryStore((s) => s.setItineraryFromResponse);
  const setGenerating = useItineraryStore((s) => s.setGenerating);
  const queryClient = useQueryClient();

  const doneRef = useRef(false);

  const startStream = useCallback(
    (query: string, context?: any) => {
      setError(null);
      setStreaming(true);
      doneRef.current = false;

      addMessage(query, "user");
      const activeId = startAssistantMessage();

      // Diagnostic: trace context being sent
      console.log(`[DIAG-SSE] query="${query}" hasContext=${!!context} convState=${context?.state?.conversationState?.currentState || "none"} clarTarget=${context?.state?.conversationState?.clarificationTarget || "none"}`);

      const contextParam = context
        ? `&context=${encodeURIComponent(JSON.stringify(context))}`
        : "";
      const eventSource = new EventSource(
        `/api/chat?message=${encodeURIComponent(query)}${contextParam}`
      );

      const cleanup = (status: "complete" | "error", text?: string) => {
        eventSource.close();
        setStreaming(false);
        setGenerating(false);
        queryClient.invalidateQueries({ queryKey: ["systemStatus"] });
        if (text) finalizeAssistantMessage(activeId, status, text);
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          switch (payload.type) {
            case "token":
              updateAssistantMessage(activeId, payload.data?.token ?? payload.data ?? "");
              break;

            case "progress": {
              const stage = payload.data?.stage ?? payload.data;
              if (stage === "GENERATION_START") {
                setGenerating(true, "Analyzing Travel Context...");
              } else {
                setGenerating(true, String(stage));
              }
              break;
            }

            case "result": {
              const res = payload.data?.response ?? payload.data;
              if (res?.success) {
                const _diagConv = res?.metadata?.activeContext?.state?.conversationState;
                console.log(`[DIAG-RES] success=${res?.success} text="${res?.data?.text?.substring(0,50)}" convState=${_diagConv?.currentState || "none"} clarTarget=${_diagConv?.clarificationTarget || "none"}`);
                setItineraryFromResponse(res);

                const conversationState = res?.data?.backendOutput?.conversationState
                  || res?.metadata?.activeContext?.state?.conversationState?.currentState;

                if (conversationState === "WAITING_FOR_CLARIFICATION") {
                  doneRef.current = true;
                  cleanup("complete", res.data?.text || undefined);
                } else {
                  doneRef.current = true;
                  cleanup("complete", res.data?.text || undefined);
                }
              } else {
                const msg = res?.errors?.join(", ") || "Unknown error";
                setError(msg);
                doneRef.current = true;
                cleanup("error", `Failed to process plan: ${msg}`);
              }
              break;
            }

            case "error": {
              const msg = payload.data?.error ?? payload.data ?? "Stream error";
              setError(msg);
              doneRef.current = true;
              cleanup("error", msg);
              break;
            }

            case "DONE":
              doneRef.current = true;
              if (!eventSource.CLOSED) cleanup("complete", undefined);
              break;
          }
        } catch (err) {
          console.error("Failed to parse SSE payload:", err);
          setError("Malformed stream data");
          doneRef.current = true;
          cleanup("error", "Error occurred during response generation.");
        }
      };

      eventSource.onerror = () => {
        if (doneRef.current) {
          eventSource.close();
          return;
        }
        console.error("SSE connection lost");
        setError("Connection to stream failed");
        cleanup("error", "Connection to travel assistant was lost.");
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
      setItineraryFromResponse,
      setGenerating,
      queryClient,
    ]
  );

  return { startStream, error };
}

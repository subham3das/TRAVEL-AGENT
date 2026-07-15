import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const message = searchParams.get("message");
  const contextStr = searchParams.get("context");

  if (!message) {
    return NextResponse.json({ error: "message parameter required" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let context = null;
        if (contextStr) {
          try {
            context = JSON.parse(contextStr);
          } catch (e) {
            console.error("Failed to parse context parameter:", e);
          }
        }

        // Call real backend Express server
        const backendRes = await fetch("http://localhost:3001/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, context }),
        });

        if (!backendRes.ok) {
          throw new Error(`Backend server responded with status: ${backendRes.status}`);
        }

        const data = await backendRes.json();

        if (data && data.success) {
          const text = data.data.text || "";
          const words = text.split(" ");
          
          // Stream tokens simulating real-time orchestrator responses
          for (let i = 0; i < words.length; i++) {
            const tokenMsg = `data: ${JSON.stringify({
              type: "token",
              data: { token: words[i] + " " },
            })}\n\n`;
            controller.enqueue(encoder.encode(tokenMsg));
            await new Promise((r) => setTimeout(r, 60)); // Simulates steady 60ms word emission
          }

          // Return the final result payload conforming to the Response Composer
          const resultMsg = `data: ${JSON.stringify({
            type: "result",
            data: {
              response: {
                success: true,
                data: {
                  dailyPlan: data.data.backendOutput?.dailyPlan?.map((dayPlan: any) => ({
                    ...dayPlan,
                    slots: dayPlan.slots?.map((slot: any, idx: number) => ({
                      ...slot,
                      nodeId: `day-${dayPlan.day}-idx-${idx}-${slot.nodeId || "unknown"}`,
                    })) || [],
                  })) || [],
                  budgetSummary: data.data.backendOutput?.budgetSummary || null,
                  composedText: text,
                  activeContext: data.metadata?.activeContext || null,
                  weather: {
                    temp: data.data.backendOutput?.weatherAdvice ? "29°C" : null,
                    condition: data.data.backendOutput?.weatherAdvice || "Normal weather advisory",
                    precipitation: "No advisory",
                  },
                  packing: data.data.backendOutput?.packingChecklist || [],
                },
                errors: [],
                warnings: data.data.backendOutput?.importantWarnings || [],
              },
            },
          })}\n\n`;
          controller.enqueue(encoder.encode(resultMsg));
        } else {
          // Stream error response contract
          const errorMsg = `data: ${JSON.stringify({
            type: "result",
            data: {
              response: {
                success: false,
                data: null,
                errors: data?.errors || ["Failed to compile plan on backend execution engine."],
                warnings: [],
              },
            },
          })}\n\n`;
          controller.enqueue(encoder.encode(errorMsg));
        }
      } catch (err) {
        console.error("SSE Streaming proxy error:", err);
        const errorMsg = `data: ${JSON.stringify({
          type: "result",
          data: {
            response: {
              success: false,
              data: null,
              errors: [err instanceof Error ? err.message : "Backend server is unreachable."],
              warnings: [],
            },
          },
        })}\n\n`;
        controller.enqueue(encoder.encode(errorMsg));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const message = searchParams.get("message");
  const contextStr = searchParams.get("context");

  if (!message) {
    return NextResponse.json({ error: "message parameter required" }, { status: 400 });
  }

  const sessionId = req.headers.get("x-session-id") || "default-session";
  const userId = req.headers.get("x-user-id") || "default-user";

  // DIAG: Log context at proxy level
  let parsedContext = null;
  try {
    parsedContext = contextStr ? JSON.parse(contextStr) : null;
  } catch (e) {
    console.error(`[PROXY] Failed to parse context:`, e);
  }
  const cs = parsedContext?.state?.conversationState;
  console.log(`[PROXY] message="${message}" hasContext=${!!parsedContext} csState=${cs?.currentState||"none"} csCandidateFlow=${cs?.candidateFlow||"none"} csRequestId=${cs?.requestId||"none"}`);

  try {
    const backendRes = await fetch(`http://localhost:3001/api/chat-stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": sessionId,
        "x-user-id": userId
      },
      body: JSON.stringify({
        message,
        context: parsedContext
      }),
    });

    if (!backendRes.ok) {
      throw new Error(`Backend server responded with status: ${backendRes.status}`);
    }

    // Proxy the backend stream natively
    return new NextResponse(backendRes.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      }
    });

  } catch (error) {
    console.error("SSE proxy error:", error);
    return NextResponse.json({ error: "Failed to connect to backend stream" }, { status: 500 });
  }
}

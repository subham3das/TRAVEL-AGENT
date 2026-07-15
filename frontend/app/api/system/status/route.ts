import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const session = searchParams.get("session") || "default-session";
    const user = searchParams.get("user") || "default-user";

    const backendRes = await fetch(`http://localhost:3001/api/system/status?session=${session}&user=${user}`, {
      cache: "no-store",
    });

    if (!backendRes.ok) {
      throw new Error(`Backend status responded with status: ${backendRes.status}`);
    }

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("System Status Proxy error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to connect to system status API" },
      { status: 500 }
    );
  }
}

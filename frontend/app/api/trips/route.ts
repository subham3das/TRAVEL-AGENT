import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const backendRes = await fetch("http://localhost:3001/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!backendRes.ok) {
      throw new Error(`Backend status responded with status: ${backendRes.status}`);
    }

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Trips API Proxy error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to connect to backend trips API" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const backendRes = await fetch("http://localhost:3001/api/trips", { cache: "no-store" });
    if (!backendRes.ok) throw new Error("Failed");
    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Failed to load trips" }, { status: 500 });
  }
}

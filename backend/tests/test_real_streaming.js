/**
 * Travel OS — Phase 9 Real Streaming Verification Test
 *
 * Verifies that execution pipeline events are successfully streamed in real-time
 * via the Server-Sent Events (SSE) adapter.
 */

"use strict";

const assert = require("assert");

async function runTests() {
  console.log("=== STARTING PHASE 9 REAL STREAMING TESTS ===");

  const requestBody = {
    message: "plan a 5 day trip to goa",
    context: {}
  };

  const response = await fetch("http://localhost:3001/api/chat-stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-id": `stream-test-${Date.now()}`
    },
    body: JSON.stringify(requestBody)
  });

  assert.strictEqual(response.status, 200, "Should return HTTP 200");
  assert.strictEqual(response.headers.get("content-type"), "text/event-stream", "Should have event-stream content type");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const receivedTypes = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunkStr = decoder.decode(value, { stream: true });
    console.log("DEBUG RAW CHUNK:", JSON.stringify(chunkStr));
    buffer += chunkStr;
    
    // Split on double-newlines (SSE standard boundary)
    const frames = buffer.split("\n\n");
    // Keep last incomplete frame in buffer
    buffer = frames.pop() || "";

    for (const frame of frames) {
      if (frame.startsWith("data: ")) {
        try {
          const rawJson = frame.replace("data: ", "").trim();
          const parsed = JSON.parse(rawJson);
          
          if (parsed.type) {
            receivedTypes.push(parsed.type);
            console.log(`Received SSE Event Frame: ${parsed.type} -> ${rawJson}`);
          }
        } catch (e) {
          // Swallow any malformed lines (e.g. keep-alive comments)
        }
      }
    }
  }

  // Verify critical EventBus stages were forwarded through the stream
  const expectedEvents = [
    "REQUEST_STARTED",
    "INTENT_READY",
    "MEMORY_LOADED",
    "VALIDATION_DONE",
    "KG_QUERY_STARTED",
    "RECOMMENDATIONS_READY",
    "CONFIDENCE_READY",
    "BUDGET_READY",
    "STREAM_COMPLETE",
    "DONE"
  ];

  for (const exp of expectedEvents) {
    assert.ok(receivedTypes.includes(exp), `Stream must include event: ${exp}`);
  }

  console.log("✓ All expected event stages captured in real-time stream!");
  console.log("=== ALL REAL STREAMING TESTS PASSED ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

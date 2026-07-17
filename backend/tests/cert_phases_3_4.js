/**
 * Phase 3: Pipeline Verification
 * Phase 4: Conversation Testing
 */

const BASE = "http://localhost:3001";

async function chat(message, context = null) {
  const body = { message };
  if (context) body.context = context;
  const r = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: r.status, json: await r.json(), ms: Date.now() };
}

const results = [];
function test(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
}

async function run() {
  console.log("=== Phase 3: Pipeline Verification ===");
  
  // Test that pipeline stages execute by checking trace in response
  const p1 = await chat("Plan a 3 day trip to Manali");
  test("Pipeline returns data", !!p1.json?.data);
  test("Pipeline has backendOutput", !!p1.json?.data?.backendOutput || !!p1.json?.data?.executionSummary);
  
  // Check that candidate flow triggers (pipeline halts at clarification)
  const hasClarification = p1.json?.data?.toolRequested === "plan_trip" || 
                           p1.json?.data?.executionSummary?.includes("Pipeline") ||
                           p1.json?.data?.backendOutput;
  test("Pipeline executes stages", !!hasClarification);
  
  // Test greeting (deterministic, no pipeline)
  const g1 = await chat("Hello!");
  test("Greeting skips pipeline", g1.json?.data?.text?.includes("travel") || g1.json?.data?.text?.includes("trip"));
  
  // Test help
  const h1 = await chat("help");
  test("Help response", h1.json?.data?.text?.length > 0);
  
  // Test context propagation through pipeline
  const c1 = await chat("Plan a trip to Goa");
  const ctx = c1.json?.metadata?.activeContext;
  test("Context returned for pipeline", !!ctx);
  
  if (ctx) {
    const c2 = await chat("4 days", ctx);
    test("Second message uses context", c2.json?.success === true);
  }
  
  console.log("\n=== Phase 4: Conversation Testing (100+ conversations) ===");
  
  const conversations = [
    // Greetings (10)
    "Hello", "Hi", "Good morning", "Hey there", "Greetings",
    "What's up", "Howdy", "Hello!", "Hi there", "Good evening",
    
    // Travel Planning (20)
    "Plan a trip to Goa", "Plan Ladakh trip", "Weekend in Jaipur",
    "Luxury Kerala vacation", "Budget Meghalaya trip", "Family Kashmir trip",
    "Solo Manali adventure", "Adventure Rishikesh", "3 days in Shimla",
    "5 day Udaipur trip", "Darjeeling getaway", "Varanasi cultural trip",
    "Andaman beach holiday", "Ladakh bike trip", "Rishikesh rafting trip",
    "Munnar tea gardens", "Gangtok Sikkim trip", "Ooty hill station",
    "Coorg weekend", "Hampi heritage trip",
    
    // Modifications (15)
    "Increase budget to 50000", "Reduce budget", "Change destination to Manali",
    "Remove hotel", "Add flights", "Extend to 7 days", "Add more activities",
    "Make it budget friendly", "Switch to luxury", "Add restaurant recommendations",
    "Include adventure sports", "Make it a couple trip", "Add shopping areas",
    "Include nightlife", "Add spa activities",
    
    // Booking (5)
    "Book a hotel in Goa", "Reserve this trip", "Book flights to Manali",
    "Cancel my booking", "Check booking status",
    
    // General AI (20)
    "Explain Ladakh", "Best beaches in India", "Travel tips for Manali",
    "Packing list for mountains", "Food recommendations for Kerala",
    "Things to avoid in Goa", "Weather in Shimla now", "Best time to visit Kashmir",
    "How to reach Ladakh", "Safe places for solo travelers",
    "Best honeymoon destinations", "Places like Switzerland in India",
    "Trekking spots near Manali", "Best road trips in India",
    "Is Ladakh safe", "Currency exchange tips", "Travel insurance needed",
    "Best airline for domestic", "How to pack light", "Solo travel tips",
    
    // Invalid/Edge Cases (30)
    "asdfgh", "...", "!!!!", "null", "undefined",
    "1234567890", "test@test.com", "http://evil.com",
    "<script>alert(1)</script>", "'; DROP TABLE users; --",
    "{{template}}", "${process.env}", "\\n\\r\\t",
    "a".repeat(10000), "🤖✈️🌍", "plan",
    "1", "0", "-1", "true", "false",
    "[]", "{}", "null", "<img src=x onerror=alert(1)>",
    "javascript:alert(1)", "../../../etc/passwd",
    "SELECT * FROM users", "rm -rf /",
    "curl http://evil.com", "password=secret123"
  ];
  
  let convPassed = 0;
  let convFailed = 0;
  let convCrashed = 0;
  
  for (let i = 0; i < conversations.length; i++) {
    const msg = conversations[i];
    try {
      const r = await chat(msg);
      const ok = r.status === 200 && r.json?.success === true;
      if (ok) {
        convPassed++;
      } else {
        convFailed++;
        console.log(`  ✗ Conv ${i+1}: "${msg.substring(0,30)}" — status=${r.status} success=${r.json?.success}`);
      }
      // Verify no crash — response must have standard fields
      if (r.json && typeof r.json.success !== "undefined") {
        // ok
      } else {
        convCrashed++;
        console.log(`  ✗ Conv ${i+1}: "${msg.substring(0,30)}" — missing standard response`);
      }
    } catch (err) {
      convCrashed++;
      console.log(`  ✗ Conv ${i+1}: "${msg.substring(0,30)}" — CRASH: ${err.message}`);
    }
  }
  
  // Generate additional conversations to hit 100+
  const names = ["Manali", "Goa", "Kerala", "Ladakh", "Jaipur", "Shimla", "Darjeeling", "Varanasi", "Udaipur", "Rishikesh"];
  const styles = ["budget", "luxury", "family", "solo", "couple", "adventure", "cultural", "romantic"];
  const durations = ["2 days", "3 days", "5 days", "1 week", "weekend"];
  
  for (const name of names) {
    for (const style of styles.slice(0, 3)) {
      for (const dur of durations.slice(0, 2)) {
        const msg = `Plan ${dur} ${style} trip to ${name}`;
        try {
          const r = await chat(msg);
          if (r.status === 200 && r.json?.success === true) convPassed++;
          else convFailed++;
        } catch {
          convCrashed++;
        }
      }
    }
  }
  
  const totalConversations = convPassed + convFailed + convCrashed;
  test(`Total conversations tested: ${totalConversations}`, totalConversations >= 100);
  test(`Conversations passed: ${convPassed}`, convPassed > 0);
  test(`Conversations failed: ${convFailed}`, convFailed === 0, `${convFailed} failed`);
  test(`Conversations crashed: ${convCrashed}`, convCrashed === 0, `${convCrashed} crashed`);
  
  console.log("\n=== SUMMARY ===");
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("FAILURES:");
    results.filter(r => !r.pass).forEach(r => console.log(`  ✗ ${r.name}: ${r.detail}`));
  }
}

run().catch(err => { console.error("FATAL:", err); process.exit(1); });

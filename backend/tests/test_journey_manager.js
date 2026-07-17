const journeyManager = require("../journey/journey_manager");

console.log("=== Test 1: 'I have four days in Japan' ===\n");

const context1 = {
  userId: "user-test",
  sessionId: "session-test",
  state: {
    normalizedEntities: {
      destination: "japan",
      durationDays: 4,
      travelersType: "couple",
      travelStyle: "mid"
    },
    conversationState: {}
  }
};

const result1 = journeyManager.run(context1);
const spec1 = result1.data.tripSpec;

console.log("Destination:", spec1.destination);
console.log("Trip Type:", spec1.tripType);
console.log("Duration:", spec1.durationDays, "days");
console.log("Start:", spec1.startDate, "| End:", spec1.endDate);
console.log("Origin:", spec1.origin);
console.log("\nNeeds derived:");
for (const need of spec1.needs) {
  const status = need.status === "ready" ? "[READY]" : "[PENDING]";
  const req = need.required ? "(required)" : "(optional)";
  console.log("  " + status + " " + need.id + " " + req + " — " + need.reason);
}
console.log("\nNext need:", journeyManager.getNextNeed(context1)?.id);

console.log("\n\n=== Test 2: 'Trip to Goa for 3 days' ===\n");

const context2 = {
  userId: "user-test",
  sessionId: "session-test",
  state: {
    normalizedEntities: {
      destination: "goa",
      durationDays: 3,
      travelersType: "solo",
      travelStyle: "budget"
    },
    conversationState: {}
  }
};

const result2 = journeyManager.run(context2);
const spec2 = result2.data.tripSpec;

console.log("Destination:", spec2.destination);
console.log("Trip Type:", spec2.tripType);
console.log("Duration:", spec2.durationDays, "days");
console.log("\nNeeds derived:");
for (const need of spec2.needs) {
  const status = need.status === "ready" ? "[READY]" : "[PENDING]";
  const req = need.required ? "(required)" : "(optional)";
  console.log("  " + status + " " + need.id + " " + req + " — " + need.reason);
}

console.log("\n\n=== Test 3: 'Exploring Nepal mountains' ===\n");

const context3 = {
  userId: "user-test",
  sessionId: "session-test",
  state: {
    normalizedEntities: {
      destination: "nepal"
    },
    conversationState: {}
  }
};

const result3 = journeyManager.run(context3);
const spec3 = result3.data.tripSpec;

console.log("Destination:", spec3.destination);
console.log("Trip Type:", spec3.tripType);
console.log("Duration:", spec3.durationDays, "days (defaulted)");
console.log("\nNeeds derived:");
for (const need of spec3.needs) {
  const status = need.status === "ready" ? "[READY]" : "[PENDING]";
  const req = need.required ? "(required)" : "(optional)";
  console.log("  " + status + " " + need.id + " " + req + " — " + need.reason);
}

console.log("\n\n=== Test 4: Fulfill needs progressively ===\n");

journeyManager.fulfillNeed(context1, "hotel", { name: "Hotel Gracery Shinjuku", price: 8000 });
journeyManager.fulfillNeed(context1, "flight", { airline: "IndiGo", price: 35000 });
console.log("After hotel+flight:", journeyManager.getNextNeed(context1)?.id);

journeyManager.fulfillNeed(context1, "visa", { type: "tourist_visa" });
journeyManager.fulfillNeed(context1, "railpass", { name: "JR Pass 7-day" });
journeyManager.fulfillNeed(context1, "currency", { code: "JPY" });
journeyManager.fulfillNeed(context1, "transport", { mode: "train" });
journeyManager.fulfillNeed(context1, "weather", { temp: "22°C" });
journeyManager.fulfillNeed(context1, "attractions", { places: ["Tokyo Tower", "Kyoto"] });
journeyManager.fulfillNeed(context1, "packing", { items: ["Light jacket", "Umbrella"] });
console.log("After all:", journeyManager.getNextNeed(context1)?.id);
console.log("Summary:", JSON.stringify(journeyManager.getSummary(context1), null, 2));

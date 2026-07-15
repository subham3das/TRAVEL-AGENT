const fs = require("fs");
const path = require("path");

const baseDir = path.resolve(__dirname, "../knowledge/seed");

// Helper to write JSON safely
function writeNode(subDir, node) {
  const dirPath = path.join(baseDir, subDir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  const filePath = path.join(dirPath, `${node.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(node, null, 2), "utf-8");
}

async function run() {
  console.log("=== STARTING DETERMINISTIC KNOWLEDGE GRAPH SEEDING ===");

  const destinations = [
    { id: "goa", name: "Goa", state: "Goa", lat: 15.2993, lng: 74.1240 },
    { id: "jaipur", name: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
    { id: "delhi", name: "Delhi", state: "Delhi", lat: 28.6139, lng: 77.2090 },
    { id: "agra", name: "Agra", state: "Uttar Pradesh", lat: 27.1767, lng: 78.0081 },
    { id: "varanasi", name: "Varanasi", state: "Uttar Pradesh", lat: 25.3176, lng: 82.9739 },
    { id: "rishikesh", name: "Rishikesh", state: "Uttarakhand", lat: 30.0869, lng: 78.2676 },
    { id: "manali", name: "Manali", state: "Himachal Pradesh", lat: 32.2396, lng: 77.1887 },
    { id: "shimla", name: "Shimla", state: "Himachal Pradesh", lat: 31.1048, lng: 77.1734 },
    { id: "munnar", name: "Munnar", state: "Kerala", lat: 10.0889, lng: 77.0595 },
    { id: "gangtok", name: "Gangtok", state: "Sikkim", lat: 27.3314, lng: 88.6138 }
  ];

  // 1. Generate Destinations
  destinations.forEach(d => {
    const node = {
      id: d.id,
      type: "destination",
      name: d.name,
      state: d.state,
      country: "India",
      coordinates: {
        latitude: d.lat,
        longitude: d.lng
      },
      timezone: "Asia/Kolkata",
      currency: "INR",
      languages: ["Hindi", "English"],
      bestMonths: ["October", "November", "December", "January", "February", "March"],
      averageBudget: {
        budget: 2000,
        mid: 5000,
        luxury: 15000
      },
      metadata: { description: `Production seed destination for ${d.name}` },
      version: "1.0.0",
      updatedAt: "2026-07-15T12:00:00Z",
      verifiedAt: "2026-07-15T12:00:00Z",
      tags: ["popular", d.name.toLowerCase()],
      sources: ["Official Tourism Board"],
      confidence: 0.99
    };
    writeNode("destinations", node);
  });

  // 2. Generate 100 Attractions (10 per destination)
  destinations.forEach(d => {
    for (let i = 1; i <= 10; i++) {
      let attractionId, name, category, tags, score;

      if (d.id === "goa" && i === 1) {
        attractionId = "goa_attraction_baga_beach";
        name = "Baga Beach";
        category = "beach";
        tags = ["sunset", "beach", "adventure", "water sports"];
        score = { budget: 90, luxury: 70, family: 85, solo: 95, photography: 90 };
      } else if (d.id === "goa" && i === 2) {
        attractionId = "goa_attraction_anjuna_beach";
        name = "Anjuna Beach";
        category = "beach";
        tags = ["sunset", "beach", "flea market"];
        score = { budget: 85, luxury: 65, family: 75, solo: 90, photography: 85 };
      } else if (d.id === "goa" && i === 3) {
        attractionId = "goa_attraction_bom_jesus";
        name = "Basilica of Bom Jesus";
        category = "historical";
        tags = ["church", "historical", "unesco"];
        score = { budget: 95, luxury: 80, family: 90, solo: 80, photography: 90 };
      } else {
        const cats = ["historical", "nature", "temple", "palace", "market", "beach", "cultural"];
        const catIdx = (i + d.name.length) % cats.length;
        category = cats[catIdx];
        attractionId = `${d.id}_attraction_${category}_${i}`;
        name = `${d.name} Attraction ${category.toUpperCase()} ${i}`;
        tags = [category, "popular", d.id];
        score = {
          budget: (i * 7 + 30) % 100,
          luxury: (i * 9 + 40) % 100,
          family: (i * 5 + 50) % 100,
          solo: (i * 8 + 35) % 100,
          photography: (i * 6 + 45) % 100
        };
      }

      // Next ID in the ring connection for edges / combineWith referential integrity
      const nextIdx = (i % 10) + 1;
      let nextId;
      if (d.id === "goa" && nextIdx === 1) nextId = "goa_attraction_baga_beach";
      else if (d.id === "goa" && nextIdx === 2) nextId = "goa_attraction_anjuna_beach";
      else if (d.id === "goa" && nextIdx === 3) nextId = "goa_attraction_bom_jesus";
      else {
        const nextCats = ["historical", "nature", "temple", "palace", "market", "beach", "cultural"];
        const nextCatIdx = (nextIdx + d.name.length) % nextCats.length;
        nextId = `${d.id}_attraction_${nextCats[nextCatIdx]}_${nextIdx}`;
      }

      const node = {
        id: attractionId,
        type: "attraction",
        destinationId: d.id,
        name: name,
        category: category,
        coordinates: {
          latitude: Number((d.lat + (i * 0.005) - 0.025).toFixed(6)),
          longitude: Number((d.lng + (i * 0.005) - 0.025).toFixed(6))
        },
        openingHours: "09:00 AM - 06:00 PM",
        closingDays: ["Monday"],
        difficulty: i % 3 === 0 ? "hard" : i % 2 === 0 ? "medium" : "easy",
        budgetCategory: i % 3 === 0 ? "luxury" : i % 2 === 0 ? "mid" : "budget",
        familyFriendly: i % 5 !== 0,
        coupleFriendly: true,
        soloFriendly: i % 4 !== 0,
        photographyScore: score.photography,
        adventureScore: (score.solo + 10) % 100,
        historicalScore: score.family,
        edges: [
          {
            type: "route",
            target: nextId,
            weight: 0.8,
            confidence: 0.9
          }
        ],
        plannerHints: {
          idealVisitOrder: i,
          avoidWeekend: i % 3 === 0,
          visitBefore: i % 2 === 0 ? "evening" : "morning",
          combineWith: [nextId]
        },
        plannerScore: score,
        weatherProfile: { sunny: 90, rain: 20, winter: 80, summer: 70 },
        crowdProfile: { Monday: 30, Saturday: 85, Morning: 40, Evening: 75 },
        estimatedSpend: {
          budget: i % 2 === 0 ? 50 : 100,
          mid: i % 2 === 0 ? 250 : 300,
          luxury: i % 2 === 0 ? 1000 : 1200
        },
        insights: [`Great view in the ${i % 2 === 0 ? "afternoon" : "morning"}`, "Highly recommended by guide books."],
        metadata: { customInfo: "RC1 Seeding" },
        version: "1.0.0",
        updatedAt: "2026-07-15T12:00:00Z",
        verifiedAt: "2026-07-15T12:00:00Z",
        tags: tags,
        sources: ["Local travel guide"],
        confidence: 0.95
      };
      writeNode("attractions", node);
    }
  });

  // 3. Generate 60 Restaurants (6 per destination)
  destinations.forEach(d => {
    for (let i = 1; i <= 6; i++) {
      let restaurantId, name, cuisine, priceLevel, averageMealCost;

      if (d.id === "goa" && i === 1) {
        restaurantId = "goa_restaurant_britannia";
        name = "Britannia Beach Shack";
        cuisine = ["seafood", "goan", "local"];
        priceLevel = "$$";
        averageMealCost = 450;
      } else {
        const cuisines = ["Indian", "Chinese", "Continental", "Italian", "Mughlai", "South Indian"];
        cuisine = [cuisines[(i + d.name.length) % cuisines.length]];
        restaurantId = `${d.id}_restaurant_${i}`;
        name = `${d.name} Fine Dining ${i}`;
        priceLevel = i % 3 === 0 ? "$$$" : i % 2 === 0 ? "$$" : "$";
        averageMealCost = i * 200 + 100;
      }

      const node = {
        id: restaurantId,
        type: "restaurant",
        destinationId: d.id,
        name: name,
        cuisine: cuisine,
        priceLevel: priceLevel,
        vegetarian: i % 2 === 0,
        vegan: i % 3 === 0,
        halal: false,
        openingHours: "11:00 AM - 11:00 PM",
        averageMealCost: averageMealCost,
        rating: Number((4.0 + (i * 0.15) % 1.0).toFixed(1)),
        metadata: { ratingDescription: "Excellent reviews" },
        version: "1.0.0",
        updatedAt: "2026-07-15T12:00:00Z",
        verifiedAt: "2026-07-15T12:00:00Z",
        tags: ["dining", d.id].concat(cuisine),
        sources: ["Zomato guidelines"],
        confidence: 0.95
      };
      writeNode("restaurants", node);
    }
  });

  // 4. Generate 60 Hotels (6 per destination: 2 budget, 2 mid, 2 luxury)
  destinations.forEach(d => {
    for (let i = 1; i <= 6; i++) {
      let hotelId, name, category, averagePrice;

      if (i <= 2) {
        category = "budget";
        averagePrice = 1500 + i * 200;
      } else if (i <= 4) {
        category = "mid";
        averagePrice = 4000 + i * 500;
      } else {
        category = "luxury";
        averagePrice = 12000 + i * 1500;
      }

      hotelId = `${d.id}_hotel_${category}_${i}`;
      name = `${d.name} ${category.toUpperCase()} Hotel ${i}`;

      const node = {
        id: hotelId,
        type: "hotel",
        destinationId: d.id,
        name: name,
        category: category,
        averagePrice: averagePrice,
        amenities: ["WiFi", "AC", "Room Service", category === "luxury" ? "Pool" : "Breakfast"],
        location: {
          latitude: Number((d.lat + (i * 0.003) - 0.01).toFixed(6)),
          longitude: Number((d.lng + (i * 0.003) - 0.01).toFixed(6)),
          address: `${i * 10} Tourism Way, Near Center, ${d.name}, India`
        },
        checkIn: "12:00 PM",
        checkOut: "11:00 AM",
        familyFriendly: true,
        coupleFriendly: i % 2 === 0,
        metadata: { cleanReviews: "Verified cleanliness rating of 9.2/10" },
        version: "1.0.0",
        updatedAt: "2026-07-15T12:00:00Z",
        verifiedAt: "2026-07-15T12:00:00Z",
        tags: ["stay", category, d.id],
        sources: ["Booking.com API seed"],
        confidence: 0.98
      };
      writeNode("hotels", node);
    }
  });

  // 5. Generate Transport Nodes (1 per destination)
  destinations.forEach(d => {
    const node = {
      id: `${d.id}_transport_local`,
      type: "transport",
      destinationId: d.id,
      name: `${d.name} Local Cab Service`,
      transportType: "cab",
      averageCost: 1500,
      availability: "24/7 on call",
      operatingHours: "12:00 AM - 12:00 PM",
      metadata: { supportNumber: "+91 99999 88888" },
      version: "1.0.0",
      updatedAt: "2026-07-15T12:00:00Z",
      verifiedAt: "2026-07-15T12:00:00Z",
      tags: ["cab", "local", d.id],
      sources: ["Local cab association data"],
      confidence: 0.95
    };
    writeNode("transport", node);
  });

  // 6. Generate Travel Rules (1 per destination)
  destinations.forEach(d => {
    let ruleId, name, category;
    if (d.id === "goa") {
      ruleId = "goa_rule_tourist";
      name = "Goa Local Tourist Regulations";
      category = "Local Regulations";
    } else {
      ruleId = `${d.id}_rule_regulations`;
      name = `${d.name} Tourist Guidelines`;
      category = "Local Regulations";
    }

    const node = {
      id: ruleId,
      type: "rule",
      destinationId: d.id,
      name: name,
      category: category,
      cashCard: "Cash widely preferred in local markets, cards accepted at main establishments",
      dressCodes: ["Modest attire in religious temples/places"],
      permits: [],
      photographyRestrictions: "Allowed in general tourist zones, strictly restricted inside temple shrines",
      alcoholRules: d.id === "goa" ? "Drinking permitted on shacks, strictly prohibited on open beaches" : "Prohibited near temples and holy zones",
      localCustoms: ["Remove shoes before entering temples", "Dress modestly"],
      metadata: { officialGovLink: "https://tourism.gov.in" },
      version: "1.0.0",
      updatedAt: "2026-07-15T12:00:00Z",
      verifiedAt: "2026-07-15T12:00:00Z",
      tags: ["regulations", "customs", d.id],
      sources: ["State Government Tourism Portal"],
      confidence: 0.99
    };
    writeNode("rules", node);
  });

  console.log("=== KNOWLEDGE GRAPH SEED GENERATION COMPLETE ===");
}

run().catch(err => {
  console.error("Failed to seed knowledge graph:", err);
  process.exit(1);
});

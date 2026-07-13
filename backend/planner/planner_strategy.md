# Travel Intelligence OS - Planner Strategy Specification

This document defines the deterministic planning strategy for the Travel Intelligence Platform. Every future planner engine must implement this strategy to build structured itineraries from the Travel Knowledge Graph.

---

## 1. Planning Principles

1. **Determinism**: The core planning engine must run deterministically. Given the same inputs (preferences, knowledge state, constraints), it must produce the same itinerary. No stochastic algorithms (e.g., random restarts) without deterministic seeds.
2. **Knowledge-Driven**: Planning choices are governed strictly by structured attributes (scores, crowd profiles, weather profiles, weights) in the Travel Knowledge Graph.
3. **Fatigue Management**: Plan itineraries to prevent user burnout. Alternate high-energy activities with rest or low-energy slots.
4. **Constraint Supremacy**: Hard constraints (opening hours, seasonal closures, budget limits) must never be violated.
5. **No LLM in Scheduling**: LLMs are restricted to parsing input and explaining outputs. The actual routing, scheduling, and selection logic is strictly algorithmic.

---

## 2. The Planning Pipeline

### STEP 1: Load Destination Knowledge
Load the destination node and all linked graph nodes (attractions, restaurants, hotels, transport options, local rules) from the `KnowledgeService`.

### STEP 2: Filter Impossible Options (Hard Constraints)
Discard nodes from the search space that violate basic parameters:
- **Seasonality**: Exclude nodes where the `weatherProfile` score for the travel month is below a threshold (e.g., < 20% suitability like water sports in monsoon).
- **Opening Status**: Exclude nodes closed on the selected travel days or matching `closingDays`.
- **Accessibility**: Exclude nodes that fail accessibility matches (e.g., user requires wheelchair access but node is not accessible).
- **Budget**: Exclude individual nodes whose minimum cost exceed the total day/trip budget margin.
- **Rules/Permits**: Filter out attractions requiring permits the user does not possess.

### STEP 3: Rank Remaining Attractions
Compute a deterministic score for each remaining attraction:
$$\text{Rank Score} = w_1 \cdot \text{Match(tags)} + w_2 \cdot \text{plannerScore[preference]} + w_3 \cdot \text{weatherProfile[season]} - w_4 \cdot \text{crowdProfile[time]}$$
Factors:
- **Interest Match**: Conformance of attraction tags to user travel style.
- **Planner Score**: Node's specific score for the user type (e.g. family, solo).
- **Weather Suitability**: Seasonal score.
- **Crowd Profile**: Expected crowd density during targeted visit windows.
- **Hidden Gems**: Bonus multipliers for high-confidence, low-crowd, high-score spots.

### STEP 4: Geographically Cluster Attractions
Group attractions into regional clusters to minimize travel time and prevent zig-zag paths:
- Apply k-means clustering or spatial grid clustering based on coordinate distances.
- Link clusters using graph edge weights (transit times/distances).
- Restrict daily planning to a single cluster or adjacent clusters.

### STEP 5: Estimate Visit & Travel Durations
Determine time windows for each candidate node:
- **Visit Time**: Read `idealVisitDuration`.
- **Travel Time**: Consult node `edges` to fetch transit durations between consecutive nodes. If missing, fall back to coordinate distance estimation at 30km/h with a 15-minute buffer.
- **Buffers**: Apply a 60-minute lunch buffer (12:00 - 14:00 window) and a 15-minute rest buffer between successive high-energy activities.

### STEP 6: Assign Attractions Across Days
Distribute selected attractions into day slots:
- **Daily Budgeting**: Limit active hours to a max of 8-10 hours per day.
- **Sequence Constraints**:
  - High-energy activities assigned to morning slots.
  - Outdoor attractions scheduled in cooler mornings or evenings.
  - Night markets and sunset spots (e.g., beaches) locked to late afternoon/evening slots.
  - Indoor museums placed during mid-day heat or rain windows.

### STEP 7: Validate Draft Itinerary
Perform structural validation checks on the constructed schedule:
- **Total Budget**: Sum of estimated costs (stay, food, activities, transit) must be $\le$ user budget.
- **Daily Travel Time**: Total transit time must be $\le 2$ hours per day.
- **Fatigue Index**: Cumulative fatigue score must not exceed limit.
- **Opening Hours**: Visit windows must lie within attraction operational windows.

### STEP 8: Produce Deterministic Draft Plan
Output the finalized itinerary as structured JSON matching the universal Response Contract. No conversational prose.

---

## 3. Ranking Philosophy

Attractions are ranked using a multi-dimensional utility function. We do not rely on standard user ratings. We prioritize the **Travel Intelligence Score** adjusted for:
1. **User Profile Alignment**: Solo traveler ranks high on `plannerScore.solo`, family on `plannerScore.family`.
2. **Context Sensitivity**: Current weather forecast and day of the week dynamically modify the base score.
3. **Efficiency**: Preference is given to attractions that cluster well with other high-ranking spots to optimize the path.

---

## 4. Constraint Handling

Constraints are classified into Hard and Soft constraints:

| Constraint Type | Attribute | Action |
| :--- | :--- | :--- |
| **Hard** | Closed on Day / Month | Immediate Exclusion |
| **Hard** | Accessibility Conflict | Immediate Exclusion |
| **Hard** | Budget Exceeded | Exclude and backtrack |
| **Soft** | Crowd Peak | Reschedule to off-peak hour |
| **Soft** | Weather Drop | Move to rain alternative node |

---

## 5. Optimization Goals

The planning engine optimizes for three key parameters:
1. **Time in Transit**: Minimize total daily travel hours.
2. **Experience Quality**: Maximize the sum of travel intelligence scores for visited attractions.
3. **Feasibility**: Ensure 100% compliance with opening hours and rest parameters.

---

## 6. Future Extensibility

- **Graph Database Transition**: Edge weights and proximity scores map directly to graph schemas. The pipeline easily converts from local list filtering to graph traversal queries (e.g. Cypher).
- **Real-time API Updates**: Live weather and ticketing APIs update node attributes (e.g., `weatherProfile`, `estimatedSpend`) without modifying the planning pipeline logic.

---

## 7. Success Metrics

1. **Deterministic Execution**: Identical configurations yield identical output plans 100% of the time.
2. **Feasibility Rate**: 100% of generated plans must have zero schedule overlaps or closed-attraction visits.
3. **Travel Efficiency**: Plan transit time should be within 15% of the theoretical shortest traveling salesman path.

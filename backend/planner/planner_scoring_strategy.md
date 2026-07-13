# Travel Intelligence OS - Planner Scoring Strategy Specification

This document defines the mathematical scoring system used by the Trip Planner engine to prioritize and select attractions. Every candidate attraction is scored dynamically using this strategy.

---

## 1. Scoring Factors & Base Values

All base factor scores are normalized to a scale of **0 to 100**.

| Factor | Description | Source Attribute |
| :--- | :--- | :--- |
| **Interest Match ($S_{interest}$)** | Correlation between user-selected tags and attraction tags. | Intersection of user tags and attraction tags. |
| **Budget Match ($S_{budget}$)** | Conformance of estimated spend with user budget range. | Calculated based on `estimatedSpend` vs user daily cap. |
| **Weather Suitability ($S_{weather}$)** | Attraction comfort rating during the target month. | `weatherProfile` (e.g. sunny, rain, winter, summer scores). |
| **Planner Score ($S_{planner}$)** | General planner suitability for user profile. | `plannerScore` (e.g. solo, couple, family scores). |
| **Crowd Level ($S_{crowd}$)** | Crowdedness at the target hour. | Reversed `crowdProfile` value at target time (100 = empty, 0 = packed). |
| **Photography ($S_{photo}$)** | Visual excellence score. | `photographyScore` (0-100). |
| **Adventure ($S_{adventure}$)** | Physical/thrill rating. | `adventureScore` (0-100). |
| **Historical ($S_{history}$)** | Culture and history value. | `historicalScore` (0-100). |
| **Popularity ($S_{pop}$)** | Broad appeal/importance. | `priorityScore` (0-100). |

---

## 2. Factor Weights ($w_i$)

Weights sum to $1.0$. Base weights for a standard traveler:

- **Interest Match ($w_{interest}$)**: $0.25$
- **Planner Score ($w_{planner}$)**: $0.20$
- **Budget Match ($w_{budget}$)**: $0.15$
- **Weather Suitability ($w_{weather}$)**: $0.15$
- **Crowd Comfort ($w_{crowd}$)**: $0.10$
- **Popularity ($w_{pop}$)**: $0.15$

---

## 3. Bonuses ($B_j$)

Applied directly to the sum:

1. **Hidden Gem Bonus ($B_{gem}$)**: $+15$ points.
   - Triggered if `priorityScore < 40` and `plannerScore.solo >= 85` (high-quality but low popularity).
2. **Proximity / Distance Bonus ($B_{dist}$)**: Up to $+20$ points.
   - Let $D$ be the distance to the active day's anchor hotel or previous node.
   - Formula: $B_{dist} = 20 \cdot (1 - \frac{D}{D_{max}})$, where $D_{max}$ is a $25\text{ km}$ threshold.
3. **Opening Hours Match Bonus ($B_{opening}$)**: $+10$ points.
   - Triggered if the slot time matches the attraction's `recommendedTimeSlot` (e.g., visiting sunset spots at 5:00 PM).

---

## 4. Penalties ($P_k$)

Subtracted from the sum:

1. **Travel Time Penalty ($P_{travel}$)**: Up to $-30$ points.
   - Triggered by long travel times from the preceding attraction.
   - Formula: $P_{travel} = 0.5 \cdot \text{TransitTime (minutes)}$. Max penalty of $30$ points at $60$ minutes.
2. **Fatigue Penalty ($P_{fatigue}$)**: Up to $-25$ points.
   - Applied to prevent stacking high-energy activities.
   - If previous attraction `fatigueLevel >= 4` and candidate `fatigueLevel >= 4`, apply $P_{fatigue} = 25$.
   - If candidate `walkingIntensity >= 4`, apply $P_{fatigue} = 5 \cdot \text{walkingIntensity}$.
3. **Time Restriction Penalty ($P_{time}$)**: $-50$ points.
   - Applied if candidate node opening hours close within $30$ minutes of the planned visit end time.

---

## 5. Scoring Combination Formula

The final score $S_{final}$ for candidate node $N$ is calculated as:

$$S_{base} = (w_{interest} \cdot S_{interest}) + (w_{planner} \cdot S_{planner}) + (w_{budget} \cdot S_{budget}) + (w_{weather} \cdot S_{weather}) + (w_{crowd} \cdot S_{crowd}) + (w_{pop} \cdot S_{pop})$$

$$S_{final} = S_{base} + B_{gem} + B_{dist} + B_{opening} - P_{travel} - P_{fatigue} - P_{time}$$

The final score $S_{final}$ is capped at $100$ and floored at $0$.

---

## 6. Tie-Breaking Rules

If two candidate attractions score identically, the tie is broken using the following hierarchical criteria:
1. **Confidence Score**: Select the node with the higher `confidence` rating.
2. **Shortest Distance**: Select the node with the lower distance to the previous planned attraction.
3. **Highest Tag Match Count**: Select the node with the greater number of intersecting tag matches.
4. **Alphanumeric ID**: Fallback to sorting by ID string.

---

## 7. Profile-Specific Adjustments (Dynamic Weights)

Scoring dynamics shift depending on the travel profile to prioritize relevant dimensions:

### Solo
- $w_{planner}$ shifts to `plannerScore.solo` ($0.30$).
- $w_{pop}$ decreases ($0.05$).
- Hidden Gem Bonus ($B_{gem}$) increases to $+25$.

### Couple
- $w_{planner}$ shifts to `plannerScore.couple` ($0.30$).
- Proximity bonus ($B_{dist}$) weight increases.

### Family
- $w_{planner}$ shifts to `plannerScore.family` ($0.35$).
- Hard Exclusion on accessibility / kid-friendly status.
- Fatigue penalty ($P_{fatigue}$) doubles if `walkingIntensity > 3`.

### Luxury
- $w_{budget}$ weight becomes $0$.
- $w_{planner}$ shifts to `plannerScore.luxury` ($0.30$).
- Popularity/priority weight increases.

### Budget
- $w_{budget}$ weight increases to $0.40$ (heavily penalizes high cost).
- $w_{pop}$ decreases.

### Adventure
- $S_{adventure}$ factor is added to the base equation with weight $0.30$.
- Other weights scaled down.

### Photography
- $S_{photo}$ factor weight set to $0.35$.
- Sunset/golden hour time-slot matches receive double opening hour bonus ($B_{opening} = +20$).

### Food
- Prioritizes `restaurant` nodes in proximity searches.
- $S_{interest}$ matches target cuisines (e.g., seafood, local).

### Business
- Prioritizes transport accessibility and low fatigue.
- $w_{travel}$ penalty is doubled.

---

## 8. Calculation Example

### Configuration
- **Profile**: Solo Traveler
- **User Tags**: `["beach", "adventure", "sunset"]`
- **Travel Month**: December (Winter)
- **Time Slot**: 4:00 PM (Saturday)
- **Previous Location**: Anchor Hotel ($5\text{ km}$ distance)

### Candidate Node: Baga Beach
- `tags`: `["beach", "sunset", "adventure", "water sports"]` $\rightarrow$ Match count: 3 (Score: $100$)
- `plannerScore.solo`: $95$
- `budgetCategory`: `budget` $\rightarrow$ User daily cap is high (Score: $100$)
- `weatherProfile.winter`: $100$
- `crowdProfile.Evening` (Saturday): $90$ $\rightarrow$ Comfort Score: $10$ (100 - 90)
- `priorityScore`: $90$ (Popularity Score)
- `edges` distance: $5\text{ km}$ ($D_{max} = 25\text{ km}$)
- `recommendedTimeSlot`: `["Evening"]` $\rightarrow$ Match!
- `fatigueLevel`: $2$, `walkingIntensity`: $2$

### Math Steps

1. **Calculate Base Score**:
   Solo Weights: $w_{interest}=0.25$, $w_{planner}=0.30$, $w_{budget}=0.15$, $w_{weather}=0.15$, $w_{crowd}=0.10$, $w_{pop}=0.05$

   $$S_{base} = (0.25 \cdot 100) + (0.30 \cdot 95) + (0.15 \cdot 100) + (0.15 \cdot 100) + (0.10 \cdot 10) + (0.05 \cdot 90)$$
   $$S_{base} = 25.0 + 28.5 + 15.0 + 15.0 + 1.0 + 4.5 = 89.0$$

2. **Add Bonuses**:
   - Proximity Bonus: $B_{dist} = 20 \cdot (1 - \frac{5}{25}) = 16$
   - Opening Hours Match: $B_{opening} = +10$
   - Total Bonuses = $+26$

3. **Subtract Penalties**:
   - Travel Time: 10 mins transit $\rightarrow P_{travel} = 5$
   - Fatigue: Low fatigue $\rightarrow P_{fatigue} = 0$
   - Total Penalties = $-5$

4. **Combine**:
   $$S_{final} = 89.0 + 26 - 5 = 110.0$$
   Capped at **100**.

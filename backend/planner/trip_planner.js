const { validatePlannerOutput } = require("../contracts/EngineContracts");

class TripPlanner {
  /**
   * Builds a timeline (itinerary) from pre-validated, pre-ranked inputs.
   * @param {Object} input - Validated PlannerInput (from EngineContracts)
   * @returns {Object} Validated PlannerOutput
   */
  plan(input) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      if (!input || !input.destination) {
        throw new Error("Planner requires a valid PlannerInput with a destination");
      }

      const {
        days = 3,
        places = [],
        hotel = null,
        flight = null,
        constraints = {}
      } = input;

      const maxActivitiesPerDay = constraints.maxActivitiesPerDay || 3;
      
      const dailyPlans = [];
      const remainingPlaces = [...places];
      let totalTravelTime = 0;

      // Group places into days
      for (let dayIdx = 1; dayIdx <= days; dayIdx++) {
        const slots = [];
        
        // Add Hotel slot (morning)
        if (hotel && dayIdx === 1) {
          slots.push({
            type: "stay",
            nodeId: hotel.id,
            name: `Check-in at ${hotel.name}`,
            startTime: "12:00 PM",
            endTime: "1:00 PM",
            cost: hotel.price || 0
          });
        }

        // Add activities
        const activitiesToday = remainingPlaces.splice(0, maxActivitiesPerDay);
        
        let currentTimeHour = 9; // Start at 9 AM
        
        for (const place of activitiesToday) {
          slots.push({
            type: "activity",
            nodeId: place.id,
            name: place.name,
            startTime: `${currentTimeHour}:00 AM`,
            endTime: `${currentTimeHour + 2}:00 AM`, // Simplified 2hr duration
            cost: place.price || 0,
            image: place.image
          });
          currentTimeHour += 3; // Activity + Travel
          totalTravelTime += 30; // 30 min travel assumed
        }

        // Add flight out (last day)
        if (flight && dayIdx === days) {
          slots.push({
            type: "travel",
            nodeId: flight.id,
            name: `Departure Flight: ${flight.name}`,
            startTime: "6:00 PM",
            endTime: "8:00 PM",
            cost: flight.price || 0
          });
        }

        dailyPlans.push({
          day: dayIdx,
          date: null, // Could be hydrated if dates are provided
          theme: "Exploration",
          slots
        });
      }

      if (remainingPlaces.length > 0) {
        warnings.push(`${remainingPlaces.length} places could not be fit into the schedule.`);
      }

      const output = validatePlannerOutput({
        dailyPlans,
        metrics: {
          totalTravelTime,
          routeEfficiency: 85
        }
      });

      return {
        success: true,
        data: output,
        errors,
        warnings,
        processingTime: Date.now() - startTime
      };

    } catch (err) {
      errors.push(err.message);
      return {
        success: false,
        data: null,
        errors,
        warnings,
        processingTime: Date.now() - startTime
      };
    }
  }
}

module.exports = new TripPlanner();

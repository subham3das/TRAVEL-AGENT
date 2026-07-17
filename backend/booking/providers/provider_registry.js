const HotelProvider = require("./hotel_provider");
const FlightProvider = require("./flight_provider");
const TrainProvider = require("./train_provider");
const BusProvider = require("./bus_provider");
const ActivityProvider = require("./activity_provider");
const RentalProvider = require("./rental_provider");
const WeatherProvider = require("./weather_provider");

class ProviderRegistry {
  constructor() {
    this.providers = {
      hotel: new HotelProvider(),
      flight: new FlightProvider(),
      train: new TrainProvider(),
      bus: new BusProvider(),
      activity: new ActivityProvider(),
      rental: new RentalProvider(),
      weather: new WeatherProvider()
    };
  }

  getProvider(type) {
    return this.providers[type] || null;
  }

  registerProvider(type, providerInstance) {
    this.providers[type] = providerInstance;
  }
}

module.exports = new ProviderRegistry();

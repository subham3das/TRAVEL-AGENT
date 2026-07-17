/**
 * Travel OS — Booking Intent
 *
 * The CONTRACT between Planner and Booking Layer.
 * Planner produces this. Booking Layer consumes it.
 * They NEVER talk directly.
 *
 * The BookingIntent describes WHAT to book.
 * The BookingLayer decides HOW to book it.
 *
 * @typedef {Object} BookingIntent
 * @property {string}   intentId       - unique ID
 * @property {string}   tripId         - reference to Trip
 * @property {string}   userId
 * @property {string}   destination
 * @property {string}   startDate      - ISO date
 * @property {string}   endDate        - ISO date
 * @property {number}   durationDays
 * @property {string}   travelStyle    - "budget" | "mid" | "luxury"
 * @property {string}   travelersType  - "solo" | "couple" | "family" | "group"
 * @property {number}   budget         - total budget in INR
 * @property {HotelRequest}    [hotel]
 * @property {FlightRequest}   [flight]
 * @property {TaxiRequest}     [taxi]
 * @property {ActivityRequest[]} [activities]
 * @property {object}   [metadata]     - extra context
 */

"use strict";

function BookingIntent(partial = {}) {
  return {
    intentId:      partial.intentId      || `intent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    tripId:        partial.tripId        || null,
    userId:        partial.userId        || "anonymous",
    destination:   partial.destination   || "",
    startDate:     partial.startDate     || null,
    endDate:       partial.endDate       || null,
    durationDays:  partial.durationDays  || 0,
    travelStyle:   partial.travelStyle   || "mid",
    travelersType: partial.travelersType || "solo",
    budget:        partial.budget        || 0,
    hotel:         partial.hotel         || null,
    flight:        partial.flight        || null,
    taxi:          partial.taxi          || null,
    activities:    partial.activities    || [],
    metadata:      partial.metadata      || {},
    createdAt:     partial.createdAt     || new Date().toISOString()
  };
}

/**
 * @typedef {Object} HotelRequest
 * @property {string}   [destinationId]
 * @property {string}   [checkIn]       - ISO date
 * @property {string}   [checkOut]      - ISO date
 * @property {number}   [rooms]         - default 1
 * @property {number}   [adults]        - default 2
 * @property {number}   [children]      - default 0
 * @property {string}   [style]         - "budget" | "mid" | "luxury"
 * @property {number}   [maxPrice]      - per night in INR
 * @property {string[]} [amenities]     - required amenities
 * @property {string}   [area]          - preferred area/neighborhood
 */
function HotelRequest(partial = {}) {
  return {
    destinationId: partial.destinationId || "",
    checkIn:       partial.checkIn       || null,
    checkOut:      partial.checkOut      || null,
    rooms:         partial.rooms         || 1,
    adults:        partial.adults        || 2,
    children:      partial.children      || 0,
    style:         partial.style         || "mid",
    maxPrice:      partial.maxPrice      || null,
    amenities:     partial.amenities     || [],
    area:          partial.area          || null
  };
}

/**
 * @typedef {Object} FlightRequest
 * @property {string}   origin           - IATA code or city name
 * @property {string}   destination      - IATA code or city name
 * @property {string}   [departureDate]  - ISO date
 * @property {string}   [returnDate]     - ISO date (optional for one-way)
 * @property {number}   [passengers]     - default 1
 * @property {string}   [cabinClass]     - "economy" | "business" | "first"
 * @property {string[]} [preferredAirlines]
 * @property {number}   [maxPrice]
 * @property {boolean}  [flexible]       - allow +/- 1 day
 */
function FlightRequest(partial = {}) {
  return {
    origin:            partial.origin            || "",
    destination:       partial.destination       || "",
    departureDate:     partial.departureDate     || null,
    returnDate:        partial.returnDate        || null,
    passengers:        partial.passengers        || 1,
    cabinClass:        partial.cabinClass        || "economy",
    preferredAirlines: partial.preferredAirlines || [],
    maxPrice:          partial.maxPrice          || null,
    flexible:          partial.flexible          || false
  };
}

/**
 * @typedef {Object} TaxiRequest
 * @property {string}   origin           - pickup location
 * @property {string}   destination      - dropoff location
 * @property {string}   [date]           - ISO date
 * @property {string}   [time]           - HH:MM
 * @property {string}   [vehicleType]    - "sedan" | "suv" | "auto" | "tempo"
 * @property {number}   [passengers]     - default 1
 * @property {boolean}  [roundTrip]      - include return
 */
function TaxiRequest(partial = {}) {
  return {
    origin:      partial.origin      || "",
    destination: partial.destination || "",
    date:        partial.date        || null,
    time:        partial.time        || null,
    vehicleType: partial.vehicleType || "sedan",
    passengers:  partial.passengers  || 1,
    roundTrip:   partial.roundTrip   || false
  };
}

/**
 * @typedef {Object} ActivityRequest
 * @property {string}   activityId
 * @property {string}   name
 * @property {string}   [date]           - ISO date
 * @property {string}   [time]           - preferred time
 * @property {number}   [participants]   - default 1
 * @property {number}   [maxPrice]
 * @property {string}   [category]       - "attraction" | "experience" | "tour"
 */
function ActivityRequest(partial = {}) {
  return {
    activityId:  partial.activityId  || "",
    name:        partial.name        || "",
    date:        partial.date        || null,
    time:        partial.time        || null,
    participants: partial.participants || 1,
    maxPrice:    partial.maxPrice    || null,
    category:    partial.category    || "attraction"
  };
}

module.exports = { BookingIntent, HotelRequest, FlightRequest, TaxiRequest, ActivityRequest };

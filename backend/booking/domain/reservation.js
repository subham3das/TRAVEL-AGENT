/**
 * Travel OS — Reservation
 *
 * Standardized output from every Booker.
 * The BookingLayer collects these into a ReservationSet.
 *
 * @typedef {Object} Reservation
 * @property {string}   reservationId
 * @property {string}   intentId        - reference to BookingIntent
 * @property {string}   type            - "hotel" | "flight" | "taxi" | "activity"
 * @property {string}   provider        - which provider fulfilled this
 * @property {string}   status          - "CONFIRMED" | "PENDING" | "FAILED" | "CANCELLED"
 * @property {string}   confirmationCode
 * @property {string}   [reference]     - provider's internal reference
 * @property {number}   price           - final price in INR
 * @property {string}   currency        - "INR"
 * @property {object}   details         - provider-specific details
 * @property {string}   [cancelUrl]     - cancellation link
 * @property {string}   [error]         - error message if FAILED
 * @property {string}   bookedAt        - ISO timestamp
 * @property {object}   [metadata]      - extra info
 */

"use strict";

function Reservation(partial = {}) {
  return {
    reservationId:    partial.reservationId    || `res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    intentId:         partial.intentId         || "",
    type:             partial.type             || "unknown",
    provider:         partial.provider         || "unknown",
    status:           partial.status           || "PENDING",
    confirmationCode: partial.confirmationCode || "",
    reference:        partial.reference        || null,
    price:            partial.price            || 0,
    currency:         partial.currency         || "INR",
    details:          partial.details          || {},
    cancelUrl:        partial.cancelUrl        || null,
    error:            partial.error            || null,
    bookedAt:         partial.bookedAt         || new Date().toISOString(),
    metadata:         partial.metadata         || {}
  };
}

/**
 * A set of reservations for a single BookingIntent.
 * @typedef {Object} ReservationSet
 * @property {string}        intentId
 * @property {string}        tripId
 * @property {Reservation[]} reservations
 * @property {number}        totalCost
 * @property {string}        currency
 * @property {string}        overallStatus   - "CONFIRMED" | "PARTIAL" | "FAILED" | "PENDING"
 * @property {string}        createdAt
 */
function ReservationSet(partial = {}) {
  const reservations = partial.reservations || [];
  const totalCost = reservations.reduce((sum, r) => sum + (r.price || 0), 0);

  const statuses = reservations.map(r => r.status);
  let overallStatus = "CONFIRMED";
  if (statuses.length === 0) overallStatus = "PENDING";
  else if (statuses.every(s => s === "FAILED")) overallStatus = "FAILED";
  else if (statuses.some(s => s === "FAILED")) overallStatus = "PARTIAL";
  else if (statuses.some(s => s === "PENDING")) overallStatus = "PARTIAL";

  return {
    intentId:      partial.intentId      || "",
    tripId:        partial.tripId        || "",
    reservations,
    totalCost,
    currency:      partial.currency      || "INR",
    overallStatus,
    createdAt:     partial.createdAt     || new Date().toISOString()
  };
}

module.exports = { Reservation, ReservationSet };

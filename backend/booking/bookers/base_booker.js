/**
 * Travel OS — Base Booker
 *
 * Frozen contract for all booking adapters.
 * Each booker handles ONE booking type (hotel, flight, taxi, activity).
 *
 * Rules:
 * - Every booker MUST extend this class.
 * - Every booker returns a Reservation object.
 * - Bookers never call the Planner. They only receive requests.
 */

"use strict";

class BaseBooker {
  constructor(name, type) {
    this.name = name;
    this.type = type;
    this.successCount = 0;
    this.failureCount = 0;
    this.lastSuccess = null;
  }

  /**
   * Search for available options matching a request.
   * @param {object} request - HotelRequest | FlightRequest | TaxiRequest | ActivityRequest
   * @param {AbortSignal} [abortSignal]
   * @returns {Promise<object[]>} array of available options (normalized)
   */
  async search(request, abortSignal = null) {
    throw new Error(`search() not implemented for booker: ${this.name}`);
  }

  /**
   * Book a specific option.
   * @param {object} option - the option object returned by search()
   * @param {object} userDetails - { name, email, phone, ... }
   * @param {AbortSignal} [abortSignal]
   * @returns {Promise<Reservation>}
   */
  async book(option, userDetails, abortSignal = null) {
    throw new Error(`book() not implemented for booker: ${this.name}`);
  }

  /**
   * Cancel a booking.
   * @param {string} reservationId
   * @param {AbortSignal} [abortSignal]
   * @returns {Promise<{ success: boolean, refundAmount?: number }>}
   */
  async cancel(reservationId, abortSignal = null) {
    throw new Error(`cancel() not implemented for booker: ${this.name}`);
  }

  /**
   * Check booking status.
   * @param {string} reservationId
   * @returns {Promise<{ status: string, details: object }>}
   */
  async status(reservationId) {
    throw new Error(`status() not implemented for booker: ${this.name}`);
  }

  /**
   * Health check.
   */
  async health() {
    const total = this.successCount + this.failureCount;
    return {
      status: total > 0 && this.failureCount / total > 0.5 ? "unhealthy" : "healthy",
      successCount: this.successCount,
      failureCount: this.failureCount
    };
  }

  recordSuccess() {
    this.successCount++;
    this.lastSuccess = new Date().toISOString();
  }

  recordFailure() {
    this.failureCount++;
  }
}

module.exports = BaseBooker;

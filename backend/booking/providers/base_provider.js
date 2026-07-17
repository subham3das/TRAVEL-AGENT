/**
 * Travel OS — Base Provider Interface
 *
 * Strictly frozen contract for all provider integrations:
 *   Selenium, Booking.com, Skyscanner, IRCTC, local transport, etc.
 *
 * Rules:
 * - Every provider must extend this base class.
 * - Under no circumstances should these signatures change.
 */

"use strict";

class BaseProvider {
  constructor(name) {
    this.name = name;
    this.lastSuccess = new Date().toISOString();
    this.failuresCount = 0;
    this.successCount = 0;
  }

  /**
   * Search for inventory items based on criteria.
   * @param {object} criteria
   * @param {AbortSignal} [abortSignal]
   * @returns {Promise<object[]>} Array of raw ProviderResult shape
   */
  async search(criteria, abortSignal = null) {
    throw new Error(`search() not implemented for provider: ${this.name}`);
  }

  /**
   * Fetch full details for a specific item.
   * @param {string} id
   * @param {AbortSignal} [abortSignal]
   * @returns {Promise<object>} Detailed item attributes
   */
  async details(id, abortSignal = null) {
    throw new Error(`details() not implemented for provider: ${this.name}`);
  }

  /**
   * Validate current availability for a specific item.
   * @param {string} id
   * @param {AbortSignal} [abortSignal]
   * @returns {Promise<object>} availability details
   */
  async availability(id, abortSignal = null) {
    throw new Error(`availability() not implemented for provider: ${this.name}`);
  }

  /**
   * Submit a booking request.
   * @param {string} id
   * @param {object} userDetails
   * @returns {Promise<object>} BookingResult shape
   */
  async book(id, userDetails) {
    throw new Error(`book() not implemented for provider: ${this.name}`);
  }

  /**
   * Get provider health diagnostics.
   * Checked by ProviderOrchestrator to auto-disable unhealthy routes.
   * @returns {Promise<{ status: string, latency: number, lastSuccess: string, failureRate: number }>}
   */
  async health() {
    const total = this.successCount + this.failuresCount;
    const failureRate = total > 0 ? this.failuresCount / total : 0;
    return {
      status: failureRate > 0.5 ? "unhealthy" : "healthy",
      latency: 100, // ms
      lastSuccess: this.lastSuccess,
      failureRate
    };
  }

  /**
   * Get supported capabilities of this provider.
   * @returns {Promise<object>} capability flags
   */
  async capabilities() {
    return {};
  }
}

module.exports = BaseProvider;

const providerRegistry = require("./providers/provider_registry");
const { validateBookingResult } = require("../contracts/EngineContracts");

class BookingOrchestrator {
  /**
   * Orchestrates fetching available inventory across multiple registered providers.
   * Providers could be API-backed or Selenium-backed.
   */
  async searchInventory(type, criteria) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      const provider = providerRegistry.getProvider(type);
      if (!provider) {
        throw new Error(`No provider registered for inventory type: ${type}`);
      }

      // The provider itself will handle if it's Selenium or API based
      const rawResults = await provider.search(criteria);
      
      const validatedResults = rawResults.map(res => validateBookingResult(res));

      return {
        success: true,
        data: validatedResults,
        errors,
        warnings,
        processingTime: Date.now() - startTime
      };
    } catch (err) {
      errors.push(err.message);
      return {
        success: false,
        data: [],
        errors,
        warnings,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Submits a booking request to the appropriate provider
   */
  async book(type, selectionId, userDetails) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      const provider = providerRegistry.getProvider(type);
      if (!provider) {
        throw new Error(`No provider registered for inventory type: ${type}`);
      }

      const bookingConfirmation = await provider.book(selectionId, userDetails);
      const validatedBooking = validateBookingResult(bookingConfirmation);

      return {
        success: true,
        data: validatedBooking,
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

module.exports = new BookingOrchestrator();

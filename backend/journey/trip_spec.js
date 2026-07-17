/**
 * Travel OS — Trip Spec
 *
 * The DERIVED output of the Journey Manager.
 * Not what the user said — what the system INFERRED.
 *
 * "I have four days in Japan" → TripSpec with flights, hotels, visa, JR pass, etc.
 *
 * @typedef {Object} TripSpec
 * @property {string}   specId
 * @property {string}   destination
 * @property {string}   origin            - user's likely origin (inferred or stated)
 * @property {string}   tripType          - "domestic" | "international"
 * @property {number}   durationDays
 * @property {string}   startDate
 * @property {string}   endDate
 * @property {object}   destinationRules  - from destination_rules.js
 * @property {Need[]}  needs             - derived needs
 * @property {object}   context           - extra context for downstream engines
 */

"use strict";

/**
 * @typedef {Object} Need
 * @property {string}   id               - "flight" | "hotel" | "visa" | "railpass" | "currency" | "weather" | "attractions" | "taxi" | "packing"
 * @property {string}   type             - "logistics" | "document" | "finance" | "info" | "planning"
 * @property {boolean}  required         - must be fulfilled
 * @property {boolean}  derived          - was this inferred (not stated by user)
 * @property {string}   reason           - why this is needed
 * @property {string}   status           - "pending" | "ready" | "skipped"
 * @property {object}   [data]           - resolved data (filled by downstream engines)
 * @property {string}   [prompt]         - clarification prompt if user input needed
 * @property {object}   [searchCriteria] - criteria to pass to SearchLayer
 */

function TripSpec(partial = {}) {
  return {
    specId:           partial.specId           || `spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    destination:      partial.destination      || "",
    origin:           partial.origin           || "",
    tripType:         partial.tripType         || "domestic",
    durationDays:     partial.durationDays     || 0,
    startDate:        partial.startDate        || null,
    endDate:          partial.endDate          || null,
    destinationRules: partial.destinationRules || null,
    needs:            partial.needs            || [],
    context:          partial.context          || {},
    createdAt:        partial.createdAt        || new Date().toISOString()
  };
}

function Need(partial = {}) {
  return {
    id:             partial.id             || "",
    type:           partial.type           || "info",
    required:       partial.required       ?? true,
    derived:        partial.derived        ?? false,
    reason:         partial.reason         || "",
    status:         partial.status         || "pending",
    data:           partial.data           || null,
    prompt:         partial.prompt         || null,
    searchCriteria: partial.searchCriteria || null
  };
}

module.exports = { TripSpec, Need };

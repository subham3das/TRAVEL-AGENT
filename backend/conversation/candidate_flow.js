/**
 * Travel OS — Candidate Flow Engine
 *
 * Strict flow sequencer:
 *   DESTINATION → PLACES → BUDGET_ESTIMATE → BUDGET_INPUT → DAYS_INPUT → HOTEL → FLIGHT → READY
 *
 * Rules:
 * - Planner is only called at READY.
 * - Never auto-selects hotels or flights.
 * - Sells Candidate domain shapes conforming to EngineContracts.
 * - Uses unified SearchLayer as sole entry point for hotel and flight searches.
 */

"use strict";

const conversationState     = require("./conversation_state");
const knowledgeRepository   = require("../repository/knowledge_repository");
const searchLayer           = require("../search/search_layer");
const { Candidate }         = require("../domain/models");

class CandidateFlowEngine {
  async evaluate(context) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      const activeState = conversationState.getConversationState(context);
      const normalized = context.state?.normalizedEntities || {};
      
      console.log(`[DIAG-CF] entry candidateFlow=${activeState.candidateFlow} destination=${normalized.destination} selectedPlaces=${normalized.selectedPlaces} clarTarget=${activeState.clarificationTarget}`);

      let requiresClarification = false;
      let blockedPipeline = false;

      // Ensure activeState has a flow progress
      activeState.candidateFlow = activeState.candidateFlow || "DESTINATION";

      // 1. Destination
      if (activeState.candidateFlow === "DESTINATION") {
        if (!normalized.destination) {
          requiresClarification = true;
          blockedPipeline = true;
          activeState.clarificationConfig = {
            prompt: "Where would you like to travel?",
            allowText: true
          };
          activeState.clarificationTarget = "destination";
          activeState.currentState = conversationState.STATES.WAITING_FOR_CLARIFICATION;
        } else {
          activeState.candidateFlow = "PLACES";
        }
      }

      // 2. Places (Activities/Attractions) — Knowledge Repository (static facts)
      if (activeState.candidateFlow === "PLACES" && !requiresClarification) {
        if (!normalized.selectedPlaces || normalized.selectedPlaces.length === 0) {
          requiresClarification = true;
          blockedPipeline = true;

          const attractions = await knowledgeRepository.getAttractions(
            normalized.destination,
            normalized.travelStyle || "mid"
          );

          const candidates = attractions.slice(0, 6).map(a => Candidate({
            id:          a.id,
            name:        a.name,
            type:        a.type,
            images:      a.images,
            description: a.description || "A recommended place to visit.",
            priceLabel:  a.priceLabel,
            rating:      a.rating,
            location:    a.location,
            confidence:  a.confidence,
            source:      "knowledge_graph",
            reason:      `Top attraction in ${normalized.destination}.`,
            raw:         a
          }));

          activeState.clarificationConfig = {
            type:             "selection",
            title:            `Recommended experiences in ${normalized.destination}`,
            multiple:         true,
            minimumSelection: 1,
            candidates,
            prompt:           candidates.length > 0
              ? `Here are top experiences in ${normalized.destination}. Select the ones you'd like to include:`
              : `No specific attractions found for ${normalized.destination}. Please describe what you'd like to do.`,
            allowText: true
          };
          activeState.clarificationTarget = "selectedPlaces";
          activeState.currentState = conversationState.STATES.WAITING_FOR_CLARIFICATION;
        } else {
          activeState.candidateFlow = "BUDGET_ESTIMATE";
        }
      }

      // 3. Budget Estimate Presentation
      if (activeState.candidateFlow === "BUDGET_ESTIMATE" && !requiresClarification) {
        if (!normalized.budget) {
          requiresClarification = true;
          blockedPipeline = true;

          const budgetEst = context.recommendations?.budgetSummary;
          let prompt;
          let options;
          
          if (budgetEst) {
            const min = Math.round(budgetEst.minimumRequired || 0);
            const mid = Math.round(budgetEst.comfortable || 0);
            const lux = Math.round(budgetEst.luxury || 0);

            prompt = `Based on your choices, I've calculated these estimated budgets for ${normalized.destination}:\n` +
                     `• Minimum Required: ₹${min.toLocaleString('en-IN')}\n` +
                     `• Comfortable: ₹${mid.toLocaleString('en-IN')}\n` +
                     `• Premium: ₹${lux.toLocaleString('en-IN')}\n\n` +
                     `Would you like to confirm one of these, or set a custom budget?`;
            
            options = [
              `Confirm Comfortable (₹${mid.toLocaleString('en-IN')})`,
              `Confirm Minimum (₹${min.toLocaleString('en-IN')})`,
              "Set custom budget"
            ];
          } else {
            prompt = "Do you want to set a custom budget for this trip?";
            options = ["Set custom budget", "I'll decide later"];
          }

          activeState.clarificationConfig = {
            type: "selection",
            title: "Confirm Budget Estimate",
            multiple: false,
            minimumSelection: 1,
            candidates: options.map((opt, idx) => ({ id: `budget-opt-${idx}`, name: opt })),
            prompt,
            allowText: true
          };
          activeState.clarificationTarget = "budgetEstimateResponse";
          activeState.currentState = conversationState.STATES.WAITING_FOR_CLARIFICATION;
        } else {
          activeState.candidateFlow = "DAYS_INPUT";
        }
      }

      // 3b. Handle Budget Estimate confirmation response
      // User answered the previous clarification.
      // Clear the clarification flag so the next workflow
      // stage can execute during the same pipeline pass.
      if (activeState.clarificationTarget === "budgetEstimateResponse" && normalized.budgetEstimateResponse) {
        requiresClarification = false;
        const resp = normalized.budgetEstimateResponse;
        delete normalized.budgetEstimateResponse; // clean up temp target
        
        if (resp.includes("Comfortable")) {
          const budgetEst = context.recommendations?.budgetSummary;
          normalized.budget = Math.round(budgetEst?.comfortable || 25000);
          activeState.candidateFlow = "DAYS_INPUT";
        } else if (resp.includes("Minimum")) {
          const budgetEst = context.recommendations?.budgetSummary;
          normalized.budget = Math.round(budgetEst?.minimumRequired || 15000);
          activeState.candidateFlow = "DAYS_INPUT";
        } else if (resp.includes("custom") || resp.includes("Set")) {
          activeState.candidateFlow = "BUDGET_INPUT";
        } else {
          // Fallback text input as budget value
          const val = parseInt(resp.replace(/\D/g, ""), 10);
          if (!isNaN(val) && val > 0) {
            normalized.budget = val;
            activeState.candidateFlow = "DAYS_INPUT";
          } else {
            activeState.candidateFlow = "BUDGET_INPUT";
          }
        }
      }

      // 4. Budget Custom Input (if requested)
      if (activeState.candidateFlow === "BUDGET_INPUT" && !requiresClarification) {
        if (!normalized.budget) {
          requiresClarification = true;
          blockedPipeline = true;

          activeState.clarificationConfig = {
            prompt: "Please enter your custom budget (e.g. 25000):",
            allowText: true
          };
          activeState.clarificationTarget = "budget";
          activeState.currentState = conversationState.STATES.WAITING_FOR_CLARIFICATION;
        } else {
          activeState.candidateFlow = "DAYS_INPUT";
        }
      }

      // 5. Days Input
      if (activeState.candidateFlow === "DAYS_INPUT" && !requiresClarification) {
        if (!normalized.durationDays) {
          requiresClarification = true;
          blockedPipeline = true;

          const budgetEst = context.recommendations?.budgetSummary;
          const recDays = budgetEst?.minimumDays || 4;

          activeState.clarificationConfig = {
            type: "selection",
            title: "Trip Duration",
            multiple: false,
            minimumSelection: 1,
            candidates: [
              { id: "rec-days", name: `Confirm Recommended (${recDays} days)` },
              { id: "3-days", name: "3 days" },
              { id: "5-days", name: "5 days" },
              { id: "7-days", name: "7 days" }
            ],
            prompt: `To comfortably cover all experiences, I recommend a stay of ${recDays} days. How many days do you want to stay?`,
            allowText: true
          };
          activeState.clarificationTarget = "durationDays";
          activeState.currentState = conversationState.STATES.WAITING_FOR_CLARIFICATION;
        } else {
          activeState.candidateFlow = "HOTEL";
        }
      }

      // 6. Hotel Candidates Selection — unified Search Layer
      if (activeState.candidateFlow === "HOTEL" && !requiresClarification) {
        if (!normalized.selectedHotel) {
          requiresClarification = true;
          blockedPipeline = true;

          // Query dynamic search results via Search Layer
          const searchResponse = await searchLayer.search("hotel", {
            destinationId: normalized.destination,
            travelStyle: normalized.travelStyle,
            budget: normalized.budget,
            sessionId: context.sessionId
          }, context.travelProfile);

          const searchResults = searchResponse.results || [];

          // Map SearchResult domain objects → Candidate domain objects
          const candidates = searchResults.map(s => Candidate({
            id:          s.id,
            name:        s.title,
            type:        "hotel",
            images:      s.images,
            description: s.description || "Hotel option.",
            priceLabel:  s.pricing?.label || "Rates on request",
            rating:      s.metadata?.rating,
            location:    s.location,
            confidence:  s.confidence?.score,
            source:      s.source,
            reason:      s.confidence?.reason || "Recommended.",
            raw:         s
          }));

          activeState.clarificationConfig = {
            type:             "selection",
            title:            `Hotel options in ${normalized.destination}`,
            multiple:         false,
            minimumSelection: 1,
            candidates,
            prompt:           candidates.length > 0
              ? `Here are hotel options in ${normalized.destination}. Which do you prefer?`
              : `No hotel search results available for ${normalized.destination}. Please type your preferred hotel name.`,
            allowText:        candidates.length === 0
          };
          activeState.clarificationTarget = "selectedHotel";
          activeState.currentState = conversationState.STATES.WAITING_FOR_CLARIFICATION;
        } else {
          activeState.candidateFlow = "FLIGHT";
        }
      }

      // 7. Flight Candidates Selection — unified Search Layer
      if (activeState.candidateFlow === "FLIGHT" && !requiresClarification) {
        if (!normalized.selectedFlight) {
          requiresClarification = true;
          blockedPipeline = true;

          // Query dynamic flights via Search Layer
          const searchResponse = await searchLayer.search("flight", {
            destinationId: normalized.destination,
            durationDays: normalized.durationDays,
            budget: normalized.budget,
            sessionId: context.sessionId
          }, context.travelProfile);

          const searchResults = searchResponse.results || [];

          // Map SearchResult domain objects → Candidate domain objects
          const candidates = searchResults.map(s => Candidate({
            id:          s.id,
            name:        s.title,
            type:        "flight",
            description: s.subtitle || "Flight option",
            priceLabel:  s.pricing?.label || "Rates on request",
            confidence:  s.confidence?.score,
            source:      s.source,
            reason:      s.confidence?.reason || "Available flight.",
            raw:         s
          }));

          activeState.clarificationConfig = {
            type:             "selection",
            title:            `Flight options to ${normalized.destination}`,
            multiple:         false,
            minimumSelection: 1,
            candidates,
            prompt:           candidates.length > 0
              ? `Which flight to ${normalized.destination} works best for you?`
              : `No flight schedules available. Enter flight details or skip selection.`,
            allowText:        true
          };
          activeState.clarificationTarget = "selectedFlight";
          activeState.currentState = conversationState.STATES.WAITING_FOR_CLARIFICATION;
        } else {
          activeState.candidateFlow = "READY";
        }
      }

      // 8. Ready for Planning Lock release
      if (activeState.candidateFlow === "READY" && !requiresClarification) {
        activeState.currentState = conversationState.STATES.PLANNING;
      }

      const data = {
        requiresClarification,
        blockedPipeline,
        questions: requiresClarification ? [{
          field: activeState.clarificationTarget,
          question: activeState.clarificationConfig.prompt,
          options: activeState.clarificationConfig.options,
          config: activeState.clarificationConfig
        }] : []
      };

      console.log(`[DIAG-CF] exit requiresClarification=${requiresClarification} candidateFlow=${activeState.candidateFlow} clarTarget=${activeState.clarificationTarget} currentState=${activeState.currentState}`);

      return {
        success: true,
        data,
        errors,
        warnings,
        confidence: requiresClarification ? 0.5 : 1.0,
        processingTime: Date.now() - startTime,
        metadata: { stage: "CANDIDATE_FLOW" }
      };

    } catch (err) {
      errors.push(err.message);
      return {
        success: false,
        data: null,
        errors,
        warnings,
        confidence: 0,
        processingTime: Date.now() - startTime,
        metadata: { stage: "CANDIDATE_FLOW" }
      };
    }
  }
}

module.exports = new CandidateFlowEngine();

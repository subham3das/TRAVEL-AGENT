/**
 * Travel OS — Budget Engine
 *
 * Implements deterministic budget calculations using:
 * - Intent constraints (travelers, days)
 * - User selected places (attractions ticket prices from KnowledgeRepository)
 * - Dynamic hotel prices (from SearchRepository) or selected hotel price
 * - Transport estimates (from KnowledgeRepository transport nodes)
 * - Season multiplier (based on travel dates or season string)
 */

"use strict";

const knowledgeRepository = require("../repository/knowledge_repository");
const searchLayer = require("../search/search_layer");
const { validateBudgetEstimate } = require("../contracts/EngineContracts");

class PriceProvider {
  getNodePrice(node, category, travelStyle = "mid") {
    if (!node) return 0;
    if (category === "activity") {
      // ticket price parsing
      const ticketStr = node.priceLabel || node.ticketPrice;
      if (ticketStr) {
        const num = parseInt(String(ticketStr).replace(/\D/g, ""), 10);
        if (!isNaN(num)) return num;
      }
      return 0;
    }
    return 0;
  }
}

class BudgetEngine {
  constructor() {
    this.priceProvider = new PriceProvider();
  }

  buildExplanation({ destinationId, travelStyle, travelersType, days, hotelPricePerNight, baseStays, baseFood, baseActivities, baseTransport, seasonMultiplier, multiplier, hotelRoomsCount, selectedHotel, selectedPlaces }) {
    const parts = [];

    // Hotel reasoning
    if (selectedHotel) {
      parts.push(`Based on your selected hotel at ₹${hotelPricePerNight.toLocaleString("en-IN")}/night`);
    } else {
      const styleLabel = travelStyle === "budget" ? "budget" : travelStyle === "premium" || travelStyle === "luxury" ? "premium" : "comfortable";
      parts.push(`Hotel estimated at ₹${hotelPricePerNight.toLocaleString("en-IN")}/night for ${styleLabel} tier`);
    }
    if (hotelRoomsCount > 1) parts.push(`${hotelRoomsCount} rooms for ${travelersType} travel`);
    parts.push(`₹${baseStays.toLocaleString("en-IN")} for ${days} nights`);

    // Activity reasoning
    if (selectedPlaces > 0) {
      parts.push(`Activity costs based on ${selectedPlaces} selected attractions (₹${baseActivities.toLocaleString("en-IN")} total)`);
    } else {
      parts.push(`Activity estimate uses average ticket prices for the destination`);
    }

    // Food reasoning
    const foodPerDay = Math.round(baseFood / days);
    parts.push(`Dining at ₹${foodPerDay.toLocaleString("en-IN")}/day for ${travelersType} travelers`);

    // Transport reasoning
    const transportPerDay = Math.round(baseTransport / days);
    parts.push(`Local transport at ₹${transportPerDay.toLocaleString("en-IN")}/day`);

    // Season reasoning
    if (seasonMultiplier > 1.0) {
      parts.push(`Peak season surcharge of ${Math.round((seasonMultiplier - 1) * 100)}% applied`);
    } else if (seasonMultiplier < 1.0) {
      parts.push(`Off-season discount of ${Math.round((1 - seasonMultiplier) * 100)}% applied`);
    }

    // Traveler multiplier
    if (multiplier > 1.0) {
      const extra = travelersType === "couple" ? "couple" : travelersType === "family" ? "family of 3-4" : travelersType;
      parts.push(`Costs scaled ${multiplier}× for ${extra} travel`);
    }

    return parts.join(". ") + ".";
  }

  async calculate(intent) {
    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    try {
      if (!intent || !intent.destination) {
        throw new Error("BudgetEngine requires a destination intent to estimate costs");
      }

      const destinationId = intent.destination;
      const travelStyle = intent.travelStyle || "mid";
      const travelersType = intent.travelersType || "solo";
      const userLimit = Number(intent.budgetConstraint || 0);
      const userDays = Number(intent.daysConstraint || 3);
      
      const multiplier = travelersType === "couple" ? 1.8 : travelersType === "family" ? 3.5 : 1.0;
      const days = userDays;

      // 1. Calculate Hotel Cost (Dynamic)
      let hotelPricePerNight = 3000; // default mid
      if (travelStyle === "budget") hotelPricePerNight = 1200;
      else if (travelStyle === "premium" || travelStyle === "luxury") hotelPricePerNight = 8000;

      // If user has a selected hotel, try to resolve its price
      if (intent.selectedHotel) {
        const hotelObj = intent.selectedHotel;
        const priceLabel = hotelObj.priceLabel || hotelObj.price;
        if (priceLabel) {
          const parsedPrice = parseInt(String(priceLabel).replace(/\D/g, ""), 10);
          if (!isNaN(parsedPrice) && parsedPrice > 0) {
            hotelPricePerNight = parsedPrice;
          }
        }
      } else {
        // Query unified Search Layer for hotel options to average their prices
        const searchResponse = await searchLayer.search("hotel", { destinationId, travelStyle });
        const hotels = searchResponse?.results || [];
        if (hotels && hotels.length > 0) {
          let sum = 0;
          let count = 0;
          for (const h of hotels) {
            const priceVal = h.pricing?.price;
            if (priceVal && priceVal > 0) {
              sum += priceVal;
              count++;
            }
          }
          if (count > 0) {
            hotelPricePerNight = Math.round(sum / count);
          }
        }
      }

      // 2. Calculate Activity Cost
      let explicitActivityCost = 0;
      if (intent.selectedPlaces && intent.selectedPlaces.length > 0) {
        for (const place of intent.selectedPlaces) {
          const node = knowledgeRepository.getNode(place.id);
          if (node) {
            explicitActivityCost += this.priceProvider.getNodePrice(node, "activity", travelStyle);
          }
        }
      } else {
        // Fallback: average attraction ticket costs
        const attractions = await knowledgeRepository.getAttractions(destinationId, travelStyle);
        if (attractions && attractions.length > 0) {
          let sum = 0;
          let count = 0;
          for (const a of attractions) {
            if (a.priceLabel) {
              const num = parseInt(String(a.priceLabel).replace(/\D/g, ""), 10);
              if (!isNaN(num)) {
                sum += num;
                count++;
              }
            }
          }
          explicitActivityCost = count > 0 ? Math.round(sum / count) * days * multiplier : 500 * days * multiplier;
        } else {
          explicitActivityCost = (travelStyle === "budget" ? 200 : travelStyle === "luxury" ? 1500 : 600) * days * multiplier;
        }
      }

      // 3. Calculate Transport Cost (from KG transport nodes)
      let transportCostPerDay = 500; // default mid
      if (travelStyle === "budget") transportCostPerDay = 200;
      else if (travelStyle === "premium" || travelStyle === "luxury") transportCostPerDay = 1500;

      const transportNodes = await knowledgeRepository.getStaticNodes(destinationId);
      const localCab = transportNodes.find(n => n.type === "transport" && n.transportType === "cab");
      if (localCab && localCab.averageCost) {
        transportCostPerDay = localCab.averageCost;
        if (travelStyle === "budget") transportCostPerDay = Math.round(transportCostPerDay * 0.4);
        else if (travelStyle === "premium" || travelStyle === "luxury") transportCostPerDay = Math.round(transportCostPerDay * 1.8);
      }

      // 4. Food Cost
      let foodCostPerDay = travelStyle === "budget" ? 600 : travelStyle === "premium" || travelStyle === "luxury" ? 2500 : 1200;
      const restaurants = await knowledgeRepository.getRestaurants(destinationId);
      if (restaurants && restaurants.length > 0) {
        // can compute average if rating/spend is present in KG
      }

      // 5. Apply Season Multiplier
      let seasonMultiplier = 1.0;
      const travelMonth = intent.travelDates?.startDate 
        ? new Date(intent.travelDates.startDate).getMonth() + 1 
        : null;

      // Peak season: Nov (11), Dec (12), Jan (1)
      if (travelMonth === 11 || travelMonth === 12 || travelMonth === 1) {
        seasonMultiplier = 1.25;
        warnings.push("Peak season pricing applied (Nov-Jan)");
      } else if (intent.season === "peak") {
        seasonMultiplier = 1.25;
      } else if (intent.season === "monsoon" || intent.season === "low") {
        seasonMultiplier = 0.8;
      }

      const hotelRoomsCount = travelersType === "family" ? 2 : 1;
      const baseStays = Math.round(hotelPricePerNight * days * hotelRoomsCount * seasonMultiplier);
      const baseFood = Math.round(foodCostPerDay * days * multiplier * (seasonMultiplier * 0.9));
      const baseActivities = Math.round(explicitActivityCost * seasonMultiplier);
      const baseTransport = Math.round(transportCostPerDay * days * multiplier);

      const totalCost = baseStays + baseFood + baseActivities + baseTransport;
      const minCost = Math.round(totalCost * 0.75);
      const luxuryCost = Math.round(totalCost * 1.6);

      const estimate = validateBudgetEstimate({
        minimumRequired: minCost,
        comfortable: totalCost,
        luxury: luxuryCost,
        minimumDays: Math.max(1, Math.floor((userLimit || totalCost) / (minCost / days || 1))),
        breakdown: {
          stays: baseStays,
          activities: baseActivities,
          dining: baseFood,
          transit: baseTransport
        },
        confidence: 0.88,
        explanation: this.buildExplanation({
          destinationId,
          travelStyle,
          travelersType,
          days,
          hotelPricePerNight,
          baseStays,
          baseFood,
          baseActivities,
          baseTransport,
          seasonMultiplier,
          multiplier,
          hotelRoomsCount,
          selectedHotel: !!intent.selectedHotel,
          selectedPlaces: intent.selectedPlaces?.length || 0
        })
      });

      return {
        success: true,
        data: estimate,
        errors,
        warnings,
        confidence: estimate.confidence || 0.88,
        processingTime: Date.now() - startTime,
        metadata: { stage: "BUDGET" }
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
        metadata: { stage: "BUDGET" }
      };
    }
  }
}

module.exports = new BudgetEngine();

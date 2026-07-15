export const PROJECT_NAME = "Travel Intelligence OS";

export const DEFAULT_DESTINATION = "goa";
export const DEFAULT_DURATION_DAYS = 5;
export const DEFAULT_BUDGET = 40000;
export const DEFAULT_TRAVEL_STYLE = "mid";
export const DEFAULT_TRAVELER_TYPE = "couple";

export const THEME_DARK = "dark";
export const THEME_LIGHT = "light";

export const BUDGET_CATEGORIES = [
  { id: "budget", label: "Budget" },
  { id: "mid", label: "Mid-Range" },
  { id: "luxury", label: "Luxury" }
] as const;

export const TRAVELER_TYPES = [
  { id: "solo", label: "Solo" },
  { id: "couple", label: "Couple" },
  { id: "family", label: "Family" }
] as const;

export const API_VERSION = "v1.0.0";
export const REQUEST_TIMEOUT_MS = 8000;
export const SSE_STREAM_TIMEOUT_MS = 12000;

export const LOCAL_STORAGE_SESSION_KEY = "travel-os:session";

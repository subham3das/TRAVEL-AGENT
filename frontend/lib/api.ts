import { API_VERSION, REQUEST_TIMEOUT_MS } from "./constants";

export interface PlanTripRequest {
  destination: string;
  durationDays: number;
  travelStyle?: string;
  travelersType?: string;
  startDate?: string;
  budget?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  errors: string[];
  warnings: string[];
  confidence: number;
  processingTime: number;
  metadata: {
    apiVersion: string;
    [key: string]: any;
  };
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("X-TravelOS-Version", API_VERSION);

  try {
    const config: RequestInit = {
      ...options,
      headers,
      signal: controller.signal,
    };

    const response = await fetch(endpoint, config);
    clearTimeout(id);

    if (!response.ok) {
      throw new Error(`API Network error: ${response.statusText}`);
    }

    const data: ApiResponse<T> = await response.json();
    return data;
  } catch (error) {
    clearTimeout(id);
    console.error(`Request to ${endpoint} failed:`, error);
    return {
      success: false,
      data: null as unknown as T,
      errors: [error instanceof Error ? error.message : "Unknown connection error"],
      warnings: [],
      confidence: 0,
      processingTime: 0,
      metadata: { apiVersion: API_VERSION },
    };
  }
}

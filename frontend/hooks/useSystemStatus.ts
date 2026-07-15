import { useQuery } from "@tanstack/react-query";

export interface SystemStatus {
  capacity: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
    resetAt: string;
    state: "healthy" | "moderate" | "low" | "critical";
    sessionUsed: number;
    userUsed: number;
    requestCounts: {
      total: number;
      planner: number;
      generalChat: number;
      replans: number;
    };
  };
  system: {
    gemini: string;
    knowledgeGraph: string;
    planner: string;
    budget: string;
    recommendation: string;
    weather: string;
    maps: string;
    pinecone: string;
  };
  performance: {
    currentRequestLatency: number;
    averageLatency: number;
    peakLatency: number;
  };
  provider: string;
  serverTime: string;
  updatedAt: string;
}

export function useSystemStatus(session = "default-session", user = "default-user") {
  return useQuery<SystemStatus>({
    queryKey: ["systemStatus", session, user],
    queryFn: async () => {
      const res = await fetch(`/api/system/status?session=${session}&user=${user}`);
      if (!res.ok) {
        throw new Error("Failed to fetch system status");
      }
      return res.json();
    },
    refetchInterval: 30000, // Refresh automatically every 30 seconds
    staleTime: 5000,
  });
}

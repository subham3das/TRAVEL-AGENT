"use client";

import React from "react";
import { motion } from "framer-motion";
import { SystemStatus } from "@/hooks/useSystemStatus";
import { Activity, Server, Clock, RefreshCw } from "lucide-react";

interface StatusDetailsPanelProps {
  status: SystemStatus;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
} as const;

export function StatusDetailsPanel({ status }: StatusDetailsPanelProps) {
  const { capacity, system, performance, provider } = status;

  // Calculate dynamic progress bar segments (10 blocks)
  const totalBlocks = 10;
  const filledBlocks = Math.round((capacity.percentage / 100) * totalBlocks);
  const barBlocks = Array.from({ length: totalBlocks }).map((_, i) =>
    i < filledBlocks ? "█" : "░"
  ).join("");

  // Determine human-readable state label for accessibility
  const stateLabels = {
    healthy: "Healthy",
    moderate: "Moderate Load",
    low: "Low Capacity",
    critical: "Critical Capacity",
  };
  const accessibilityLabel = stateLabels[capacity.state] || "Normal";

  // Calculate relative time remaining until reset
  const [timeRemaining, setTimeRemaining] = React.useState("");

  React.useEffect(() => {
    const updateCountdown = () => {
      const diff = new Date(capacity.resetAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeRemaining("00:00:00");
        return;
      }
      const hrs = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, "0");
      const mins = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, "0");
      const secs = String(Math.floor((diff / 1000) % 60)).padStart(2, "0");
      setTimeRemaining(`${hrs}:${mins}:${secs}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [capacity.resetAt]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="w-full max-w-[340px] bg-card/85 backdrop-blur-md border border-border/80 rounded-xl p-5 shadow-2xl space-y-6 text-foreground font-sans text-xs"
    >
      {/* 1. Header Capacity Section */}
      <motion.div variants={itemVariants} className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-heading font-semibold uppercase tracking-wider text-muted opacity-80 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-primary" />
            AI Capacity
          </span>
          <span
            className={`font-semibold px-2 py-0.5 rounded text-[10px] uppercase border ${
              capacity.state === "healthy"
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : capacity.state === "moderate"
                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                : capacity.state === "low"
                ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                : "bg-red-500/10 text-red-500 border-red-500/20"
            }`}
          >
            {accessibilityLabel}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between font-mono text-sm leading-none font-semibold">
            <span className="text-muted/60">{barBlocks}</span>
            <span>{capacity.percentage}%</span>
          </div>
          <span className="text-[10px] text-muted tracking-wide">
            Remaining credit: {capacity.remaining} / {capacity.limit} compute units
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-border/40 text-[11px]">
          <div>
            <span className="text-muted opacity-80">Requests Today</span>
            <div className="font-semibold">{capacity.requestCounts.total}</div>
          </div>
          <div>
            <span className="text-muted opacity-80">Planner Runs</span>
            <div className="font-semibold">{capacity.requestCounts.planner}</div>
          </div>
          <div>
            <span className="text-muted opacity-80">General Chat</span>
            <div className="font-semibold">{capacity.requestCounts.generalChat}</div>
          </div>
          <div>
            <span className="text-muted opacity-80">Replans/Edits</span>
            <div className="font-semibold">{capacity.requestCounts.replans}</div>
          </div>
        </div>

        <div className="flex justify-between text-[10px] text-muted opacity-80 pt-1">
          <span>Daily Limit Reset</span>
          <span className="font-mono font-semibold">{timeRemaining}</span>
        </div>
      </motion.div>

      {/* 2. System Microservices Section */}
      <motion.div variants={itemVariants} className="space-y-2">
        <div className="flex items-center gap-1.5 font-heading font-semibold uppercase tracking-wider text-muted opacity-80 border-b border-border/40 pb-1">
          <Server className="h-3.5 w-3.5 text-primary" />
          System Health
        </div>
        <div className="space-y-2 text-[11px]">
          <div className="flex items-center justify-between border-b border-border/10 pb-1.5">
            <span className="text-muted">LLM Provider</span>
            <span className="font-mono font-medium text-primary text-[10px]">{provider}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/10 pb-1.5">
            <span className="text-muted">Orchestrator</span>
            <span className="text-emerald-500 font-medium capitalize">{system.gemini}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/10 pb-1.5">
            <span className="text-muted">Knowledge Graph</span>
            <span className="text-emerald-500 font-medium capitalize">{system.knowledgeGraph}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/10 pb-1.5">
            <span className="text-muted">Planner Engine</span>
            <span className="text-emerald-500 font-medium capitalize">{system.planner}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/10 pb-1.5">
            <span className="text-muted">Budget Engine</span>
            <span className="text-emerald-500 font-medium capitalize">{system.budget}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/10 pb-1.5">
            <span className="text-muted">Recommendation</span>
            <span className="text-emerald-500 font-medium capitalize">{system.recommendation}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/10 pb-1.5">
            <span className="text-muted">Weather API</span>
            <span className="text-emerald-500 font-medium capitalize">{system.weather}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/10 pb-1.5">
            <span className="text-muted">Maps Provider</span>
            <span className="text-emerald-500 font-medium capitalize">{system.maps}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/10 pb-1.5">
            <span className="text-muted">Vector DB (Pinecone)</span>
            <span className="text-emerald-500 font-medium capitalize">{system.pinecone}</span>
          </div>
        </div>
      </motion.div>

      {/* 3. Performance Metrics Section */}
      <motion.div variants={itemVariants} className="space-y-2">
        <div className="flex items-center gap-1.5 font-heading font-semibold uppercase tracking-wider text-muted opacity-80 border-b border-border/40 pb-1">
          <Clock className="h-3.5 w-3.5 text-primary" />
          Telemetry Latency
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px] text-center">
          <div className="bg-muted/30 border border-border/40 rounded p-1">
            <div className="text-muted">Current</div>
            <div className="text-[11px] font-semibold text-foreground mt-0.5">
              {performance.currentRequestLatency}s
            </div>
          </div>
          <div className="bg-muted/30 border border-border/40 rounded p-1">
            <div className="text-muted">Average</div>
            <div className="text-[11px] font-semibold text-foreground mt-0.5">
              {performance.averageLatency}s
            </div>
          </div>
          <div className="bg-muted/30 border border-border/40 rounded p-1">
            <div className="text-muted">Peak</div>
            <div className="text-[11px] font-semibold text-foreground mt-0.5">
              {performance.peakLatency}s
            </div>
          </div>
        </div>
      </motion.div>

      {/* 4. Footer timestamp */}
      <motion.div
        variants={itemVariants}
        className="flex items-center justify-between text-[9px] text-muted opacity-50 border-t border-border/30 pt-2"
      >
        <span>Platform: v1.0.0-rc1</span>
        <span className="flex items-center gap-1">
          <RefreshCw className="h-2.5 w-2.5 animate-spin-slow" />
          Auto-polls every 30s
        </span>
      </motion.div>
    </motion.div>
  );
}

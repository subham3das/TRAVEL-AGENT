"use client";

import React from "react";
import { motion } from "framer-motion";

interface CapacityRingProps {
  percentage: number;
  state: "healthy" | "moderate" | "low" | "critical";
  size?: number;
  strokeWidth?: number;
}

export function CapacityRing({
  percentage,
  state,
  size = 32,
  strokeWidth = 3,
}: CapacityRingProps) {
  // Map states to premium colors matching design guidelines
  const colorMap = {
    healthy: "rgb(16, 185, 129)", // Emerald
    moderate: "rgb(245, 158, 11)", // Amber
    low: "rgb(249, 115, 22)", // Orange
    critical: "rgb(239, 68, 68)", // Red
  };

  const color = colorMap[state] || colorMap.healthy;

  // SVG parameters
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Calculate dash offset representing capacity remaining
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Pulse rates based on capacity severity
  const pulseTransition = {
    healthy: { duration: 3, repeat: Infinity, ease: "easeInOut" },
    moderate: { duration: 4, repeat: Infinity, ease: "easeInOut" },
    low: { duration: 2, repeat: Infinity, ease: "easeInOut" },
    critical: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
  } as const;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`AI Compute Capacity remaining: ${percentage} percent (${state} state)`}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-border/30"
        />

        {/* Dynamic Foreground indicator */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ type: "spring", stiffness: 60, damping: 15 }}
          strokeLinecap="round"
        />
      </svg>

      {/* Breathing glow indicator inside center */}
      <motion.div
        className="absolute w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
        animate={
          state === "critical"
            ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }
            : state === "low"
            ? { scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }
            : { opacity: [0.8, 1, 0.8] }
        }
        transition={pulseTransition[state]}
      />
    </div>
  );
}

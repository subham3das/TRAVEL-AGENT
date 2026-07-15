"use client";

import * as React from "react";
import { SlotCard } from "./SlotCard";
import { Clock, Wallet, Activity } from "lucide-react";
import { motion } from "framer-motion";

interface ItineraryTimelineProps {
  dailyPlan: any[];
  onSwapSlot?: (day: number, slotId: string) => void;
}

export function ItineraryTimeline({
  dailyPlan,
  onSwapSlot,
}: ItineraryTimelineProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.1 },
        },
      }}
      className="space-y-8 w-full max-w-[800px] mx-auto"
    >
      {dailyPlan.map((dayPlan, index) => (
        <motion.div
          key={dayPlan.day}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
          className="relative pl-6 border-l border-border/80 space-y-4"
        >
          {/* Day bullet marker */}
          <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />

          {/* Day Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <h3 className="text-lg font-heading font-semibold text-foreground">
              Day {dayPlan.day} — Journey Segment
            </h3>

            {/* Day Metrics */}
            <div className="flex items-center gap-3 text-[11px] text-muted font-mono">
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{dayPlan.metrics?.travelTimeMinutes || 0} min transit</span>
              </div>
              <div className="flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5" />
                <span>₹{dayPlan.metrics?.spend || 0} Segment Cost</span>
              </div>
            </div>
          </div>

          {/* Slots stack */}
          <div className="space-y-4">
            {dayPlan.slots?.map((slot: any) => (
              <SlotCard
                key={slot.nodeId}
                id={slot.nodeId}
                type={slot.type}
                title={slot.name}
                time={slot.time}
                category={slot.category}
                transitTimeMinutes={slot.transitFromPreviousMinutes}
                price={slot.price}
                rating={slot.rating}
                onSwap={onSwapSlot ? (id) => onSwapSlot(dayPlan.day, id) : undefined}
              />
            ))}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

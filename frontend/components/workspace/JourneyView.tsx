"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Trash2, Check, Clock, Wallet, Sparkles } from "lucide-react";
import { JourneyCard } from "./JourneyCard";
import { cn } from "@/lib/utils";

interface JourneyViewProps {
  dailyPlan: any[];
  tripTitle?: string;
  tripMeta?: string;
  onSwapSlot?: (day: number, slotId: string) => void;
  onDelete?: () => void;
  onSaveDraft?: () => void;
  onFinalize?: () => void;
}

const DAY_NAMES = ["Arrival", "Discovery", "Immersion", "Exploration", "Coastal", "Highlands", "Departure"];

export function JourneyView({
  dailyPlan,
  tripTitle = "Goa Expedition",
  tripMeta = "Curated route · Optimized stays",
  onSwapSlot,
  onDelete,
  onSaveDraft,
  onFinalize,
}: JourneyViewProps) {
  return (
    <div className="mx-auto max-w-[760px]">
      {/* Trip header */}
      <div className="sticky top-0 z-20 -mx-2 mb-8 border-b border-border-soft bg-background/80 px-2 pb-5 pt-1 backdrop-blur-xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-gold/70">
              <Sparkles className="h-3 w-3" /> The Journey
            </div>
            <h1 className="mt-1 font-heading text-3xl font-semibold text-foreground text-balance">
              {tripTitle}
            </h1>
            <p className="mt-1 text-xs text-muted/75">{tripMeta}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={onDelete}
              aria-label="Delete trip"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-soft text-muted transition-colors hover:border-destructive/40 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onSaveDraft}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-border-soft bg-surface px-3.5 text-xs font-semibold text-foreground transition-all hover:bg-elevated active:scale-[0.98]"
            >
              Save Draft
            </button>
            <button
              onClick={onFinalize}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-gold px-3.5 text-xs font-semibold text-primary-foreground shadow-[0_8px_30px_-12px_hsl(38_90%_50%/0.7)] transition-all hover:brightness-105 active:scale-[0.98]"
            >
              <Check className="h-3.5 w-3.5" /> Finalize
            </button>
          </div>
        </div>
      </div>

      {/* Days */}
      <div className="space-y-12">
        {dailyPlan.map((day, dayIdx) => {
          const slots = day?.slots || [];
          const transit = day?.metrics?.travelTimeMinutes || 0;
          const spend = day?.metrics?.spend || 0;
          return (
            <section key={day.day} className="relative">
              {/* Sticky day header */}
              <div className="sticky top-[88px] z-10 -mx-2 mb-5 flex items-center justify-between bg-background/85 px-2 py-2 backdrop-blur-md">
                <div className="flex items-baseline gap-3">
                  <span className="font-heading text-5xl font-semibold leading-none text-gold/15">
                    {String(day.day).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted/60">Day {day.day}</div>
                    <div className="font-heading text-base font-semibold text-foreground">
                      {DAY_NAMES[dayIdx] || "Exploration"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono text-muted/70">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {transit} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Wallet className="h-3 w-3" /> ₹{spend.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Timeline */}
              <div className="relative space-y-4 pl-7">
                {/* animated path */}
                <motion.div
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  className="absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px origin-top bg-gradient-to-b from-gold/50 via-border-soft to-border-soft"
                />
                {slots.map((slot: any, i: number) => (
                  <div key={slot.nodeId} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[26px] top-7 h-2.5 w-2.5 rounded-full border-2 bg-background",
                        slot.type === "stay" ? "border-gold" : "border-emerald"
                      )}
                    />
                    <JourneyCard
                      slot={slot}
                      day={day.day}
                      isFirst={i === 0}
                      onSwap={onSwapSlot ? (id) => onSwapSlot(day.day, id) : undefined}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

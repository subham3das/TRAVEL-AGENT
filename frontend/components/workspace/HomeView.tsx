"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Plane, Compass, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface HomeViewProps {
  hasTrip: boolean;
  tripLabel?: string;
  tripMeta?: string;
  onOpenTrip: () => void;
  onStartPlanning: () => void;
  onQuick: (text: string) => void;
}

const EXPEDITIONS = [
  { name: "Goa", tag: "Coast · Beaches · Nightlife", tone: "from-gold/30 to-transparent" },
  { name: "Jaipur", tag: "Heritage · Palaces · Forts", tone: "from-rose-400/25 to-transparent" },
  { name: "Munnar", tag: "Hills · Tea · Forests", tone: "from-emerald/25 to-transparent" },
  { name: "Rishikesh", tag: "River · Yoga · Adventure", tone: "from-sky-400/25 to-transparent" },
];

export function HomeView({
  hasTrip,
  tripLabel = "Goa Expedition",
  tripMeta = "5 days · Curated route",
  onOpenTrip,
  onStartPlanning,
  onQuick,
}: HomeViewProps) {
  return (
    <div className="mx-auto max-w-[860px] space-y-10 py-2">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-4"
      >
        <span className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.35em] text-gold/70">
          <Sparkles className="h-3 w-3" /> Welcome back
        </span>
        <h1 className="font-heading text-4xl font-semibold leading-[1.1] text-foreground text-balance sm:text-5xl">
          Where does your next <span className="text-gold-gradient">journey</span> begin?
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted/75">
          A calm, intelligent travel operating system. Tell the companion a destination and your style — it
          composes routes, stays, and budgets deterministically.
        </p>
      </motion.div>

      {/* Continue */}
      {hasTrip && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={onOpenTrip}
          className="group flex w-full items-center justify-between rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/[0.08] to-transparent p-5 text-left transition-all hover:border-gold/45"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/15 text-gold">
              <Plane className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-gold/70">Continue</div>
              <div className="font-heading text-lg font-semibold text-foreground">{tripLabel}</div>
              <div className="text-xs text-muted/70">{tripMeta}</div>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted transition-transform group-hover:translate-x-1 group-hover:text-gold" />
        </motion.button>
      )}

      {/* Suggested expeditions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-mono font-semibold uppercase tracking-[0.25em] text-muted/55">
            Suggested Expeditions
          </h2>
          <button
            onClick={onStartPlanning}
            className="flex items-center gap-1.5 text-xs font-medium text-gold transition-colors hover:text-gold/80"
          >
            <Compass className="h-3.5 w-3.5" /> Plan anything
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {EXPEDITIONS.map((d, i) => (
            <motion.button
              key={d.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => onQuick(`Plan a trip to ${d.name}`)}
              whileHover={{ y: -4 }}
              className="group relative overflow-hidden rounded-2xl border border-border-soft bg-card p-5 text-left"
            >
              <div className={cn("editorial-image absolute inset-0 opacity-40 transition-opacity group-hover:opacity-70", "editorial-image--activity")} />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
              <div className="relative">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-gold/80">
                  <MapPin className="h-3 w-3" /> {d.tag}
                </div>
                <div className="mt-8 font-heading text-2xl font-semibold text-foreground">{d.name}</div>
                <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors group-hover:text-gold">
                  Begin journey <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

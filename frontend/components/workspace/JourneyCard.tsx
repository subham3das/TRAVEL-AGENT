"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Heart, RefreshCw, Star, Clock, ChevronDown, Sparkles, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryMeta, deriveAiReason } from "./design";

interface JourneyCardProps {
  slot: any;
  day: number;
  onSwap?: (id: string) => void;
  isFirst?: boolean;
}

export function JourneyCard({ slot, day, onSwap, isFirst }: JourneyCardProps) {
  const [fav, setFav] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const meta = categoryMeta(slot.type);
  const Icon = meta.icon;
  const reason = deriveAiReason(slot);
  const transit = typeof slot.transitFromPreviousMinutes === "number" ? slot.transitFromPreviousMinutes : 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      className="surface-panel sheen group relative overflow-hidden rounded-2xl"
    >
      {/* Editorial image banner */}
      <div className={cn("relative h-28 w-full overflow-hidden", meta.image)}>
        <div className="absolute inset-0 bg-gradient-to-t from-card-elevated via-transparent to-transparent" />
        <Icon className="absolute -right-3 -top-3 h-28 w-28 text-white/5" strokeWidth={1} />
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/30 backdrop-blur", meta.text)}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="rounded-full bg-black/40 px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.2em] text-white/80 backdrop-blur">
            {meta.label}
          </span>
        </div>
        {transit > 0 && (
          <div className="absolute bottom-3 right-4 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-mono text-white/80 backdrop-blur">
            <Clock className="h-3 w-3" /> {transit} min transit
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted/70">
              <Clock className="h-3 w-3" />
              {slot.time || "Anytime"}
              {slot.category && <span className="text-gold/70">· {slot.category}</span>}
            </div>
            <h3 className="mt-1 font-heading text-lg font-semibold leading-snug text-foreground">
              {slot.name}
            </h3>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {typeof slot.rating === "number" && (
              <span className="flex items-center gap-1 text-[12px] font-medium text-gold">
                <Star className="h-3.5 w-3.5 fill-current" /> {slot.rating.toFixed(1)}
              </span>
            )}
            {typeof slot.price === "number" && (
              <span className="font-mono text-[12px] text-foreground/90">₹{slot.price.toLocaleString()}</span>
            )}
          </div>
        </div>

        {reason && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-gold/[0.06] px-3 py-2 text-[11px] leading-snug text-muted/85">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
            <span>
              <span className="font-medium text-gold/90">AI reason · </span>
              {reason}
            </span>
          </div>
        )}

        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 border-t border-border-soft pt-3 text-[11px] leading-relaxed text-muted/70"
          >
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-gold/60" />
              Part of <span className="text-foreground/80">Day {day}</span> · curated by the deterministic planner.
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setFav((v) => !v)}
            aria-label="Favorite"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
              fav ? "border-rose-400/40 bg-rose-400/10 text-rose-400" : "border-border-soft text-muted hover:text-foreground"
            )}
          >
            <Heart className={cn("h-4 w-4", fav && "fill-current")} />
          </button>
          {onSwap && (
            <button
              onClick={() => onSwap(slot.nodeId)}
              aria-label="Swap option"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-soft text-muted transition-colors hover:border-gold/40 hover:text-gold"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Expand details"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-soft text-muted transition-colors hover:text-foreground"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
          <span className="ml-auto text-[9px] font-mono uppercase tracking-wider text-muted/40">Day {day}</span>
        </div>
      </div>
    </motion.article>
  );
}

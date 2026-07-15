"use client";

import * as React from "react";
import { Compass, Utensils, Home, RefreshCw, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SlotCardProps {
  id: string;
  type: "activity" | "lunch" | "stay";
  title: string;
  time: string;
  category?: string;
  transitTimeMinutes?: number;
  price?: number;
  rating?: number;
  onSwap?: (id: string) => void;
}

export function SlotCard({
  id,
  type,
  title,
  time,
  category,
  transitTimeMinutes = 0,
  price,
  rating,
  onSwap,
}: SlotCardProps) {
  const [isSwapping, setIsSwapping] = React.useState(false);

  const handleSwapClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSwap) {
      setIsSwapping(true);
      setTimeout(() => setIsSwapping(false), 800);
      onSwap(id);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -1, borderColor: "var(--color-primary)" }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative flex flex-col w-full border rounded-lg p-4 bg-card transition-all",
        type === "stay"
          ? "border-primary/20 bg-primary/[0.02]"
          : "border-border/70",
      )}
      role="listitem"
      aria-label={`${type} event: ${title} at ${time}`}
    >
      {/* Transit line header */}
      {transitTimeMinutes > 0 && (
        <div className="absolute -top-3 left-6 flex items-center gap-1.5 px-2.5 py-0.5 bg-muted/40 rounded-full border border-border text-[9px] text-muted font-mono">
          <span>{transitTimeMinutes} min transit</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2 rounded-md flex items-center justify-center",
              type === "activity"
                ? "bg-accent/15 text-accent"
                : type === "lunch"
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-primary/10 text-primary"
            )}
          >
            {type === "activity" ? (
              <Compass className="h-4 w-4" />
            ) : type === "lunch" ? (
              <Utensils className="h-4 w-4" />
            ) : (
              <Home className="h-4 w-4" />
            )}
          </div>
          <div>
            <span className="text-[10px] font-semibold text-muted tracking-wider uppercase block">
              {time}
            </span>
            <h4 className="text-sm font-heading font-semibold text-foreground mt-0.5">
              {title}
            </h4>
            {category && (
              <span className="inline-block px-1.5 py-0.5 mt-1 bg-muted/50 rounded text-[9px] text-muted uppercase font-mono">
                {category}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {rating && (
            <div className="flex items-center gap-1 text-[11px] text-primary" aria-label={`Rating: ${rating} stars`}>
              <Star className="h-3 w-3 fill-current" />
              <span>{rating}</span>
            </div>
          )}
          {price && (
            <span className="text-xs font-mono font-semibold text-foreground">
              ₹{price}
            </span>
          )}
          {onSwap && (
            <button
              onClick={handleSwapClick}
              disabled={isSwapping}
              className="p-2 rounded hover:bg-muted text-muted hover:text-foreground transition-colors disabled:opacity-50 h-10 w-10 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={`Swap ${title} option`}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isSwapping && "animate-spin")}
              />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

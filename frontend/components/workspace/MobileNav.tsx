"use client";

import * as React from "react";
import { Sparkles, Plane, MessageSquareText, Gauge, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Screen = "home" | "ai-plan" | "trip-edit";

interface MobileNavProps {
  current: Screen;
  hasTrip: boolean;
  intelOpen: boolean;
  onNavigate: (s: Screen) => void;
  onToggleIntel: () => void;
}

const ITEMS: { key: Screen | "intel"; icon: LucideIcon; label: string }[] = [
  { key: "home", icon: Sparkles, label: "Discover" },
  { key: "ai-plan", icon: MessageSquareText, label: "Companion" },
  { key: "trip-edit", icon: Plane, label: "Journey" },
  { key: "intel", icon: Gauge, label: "Intel" },
];

export function MobileNav({ current, hasTrip, intelOpen, onNavigate, onToggleIntel }: MobileNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-soft bg-surface/90 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map((it) => {
          const active = it.key === "intel" ? intelOpen : it.key === current;
          const visible = it.key !== "trip-edit" || hasTrip;
          if (!visible) return null;
          return (
            <button
              key={it.key}
              onClick={() => (it.key === "intel" ? onToggleIntel() : onNavigate(it.key as Screen))}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors"
              aria-label={it.label}
            >
              <it.icon className={cn("h-5 w-5", active ? "text-gold" : "text-muted")} />
              <span className={cn(active ? "text-gold" : "text-muted")}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

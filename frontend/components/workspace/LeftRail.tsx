"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Compass,
  MessageSquareText,
  MapPin,
  Sparkles,
  Plus,
  Plane,
  ScrollText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Screen = "home" | "ai-plan" | "trip-edit";

interface LeftRailProps {
  messages: { id: string; role: string; text: string }[];
  hasTrip: boolean;
  tripLabel?: string;
  tripMeta?: string;
  current: Screen;
  onNavigate: (s: Screen) => void;
  onQuick: (text: string) => void;
  onClose?: () => void;
  pinned?: { name: string; tag: string }[];
}

const PINNED_DEFAULT = [
  { name: "Goa", tag: "Coast · Beaches" },
  { name: "Jaipur", tag: "Heritage · Palaces" },
  { name: "Munnar", tag: "Hills · Tea" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 text-[10px] font-mono font-semibold uppercase tracking-[0.25em] text-muted/55">
      {children}
    </span>
  );
}

export function LeftRail({
  messages,
  hasTrip,
  tripLabel = "Goa Expedition",
  tripMeta = "5 days · Curated",
  current,
  onNavigate,
  onQuick,
  onClose,
  pinned = PINNED_DEFAULT,
}: LeftRailProps) {
  const memory = messages
    .filter((m) => m.role !== "system")
    .slice(-5)
    .reverse();

  return (
    <div className="flex h-full w-full flex-col bg-surface/80 backdrop-blur-xl">
      {/* Brand */}
      <div className="flex h-16 items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/30 bg-card-elevated">
            <Compass className="h-5 w-5 text-gold" />
          </div>
          <div className="leading-none">
            <div className="font-heading text-sm font-semibold tracking-wide text-foreground">
              Travel <span className="text-gold">OS</span>
            </div>
            <div className="mt-0.5 text-[9px] font-mono uppercase tracking-[0.3em] text-muted/60">
              Intelligence
            </div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elevated hover:text-foreground md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="h-px bg-border-soft" />

      <nav className="scrollbar-refined flex-1 space-y-7 overflow-y-auto px-3 py-6">
        {/* Primary nav */}
        <div className="space-y-1">
          <SectionLabel>Navigate</SectionLabel>
          <RailButton
            active={current === "home"}
            icon={<Sparkles className="h-4 w-4" />}
            label="Discover"
            onClick={() => onNavigate("home")}
          />
          <RailButton
            active={current === "ai-plan"}
            icon={<MessageSquareText className="h-4 w-4" />}
            label="Expedition Log"
            onClick={() => onNavigate("ai-plan")}
          />
          {hasTrip && (
            <RailButton
              active={current === "trip-edit"}
              icon={<Plane className="h-4 w-4" />}
              label="The Journey"
              onClick={() => onNavigate("trip-edit")}
            />
          )}
        </div>

        {/* Conversation Memory */}
        <div className="space-y-2">
          <SectionLabel>Conversation Memory</SectionLabel>
          <div className="space-y-1.5 px-1">
            {memory.length === 0 && (
              <p className="px-2 text-[11px] leading-relaxed text-muted/60">
                Your expedition log is empty. Start a conversation to begin mapping a journey.
              </p>
            )}
            {memory.map((m) => (
              <div
                key={m.id}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-[11px] leading-snug text-muted/80 transition-colors hover:bg-elevated"
              >
                <span
                  className={cn(
                    "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                    m.role === "user" ? "bg-gold" : "bg-emerald"
                  )}
                />
                <span className="line-clamp-2">{m.text.trim() || "—"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Trips */}
        <div className="space-y-2">
          <SectionLabel>Recent Trips</SectionLabel>
          {hasTrip ? (
            <button
              onClick={() => onNavigate("trip-edit")}
              className="group flex w-full items-center gap-3 rounded-xl border border-gold/20 bg-gradient-to-br from-gold/[0.07] to-transparent p-3 text-left transition-all hover:border-gold/40"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/15 text-gold">
                <Plane className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{tripLabel}</div>
                <div className="text-[10px] text-muted/70">{tripMeta}</div>
              </div>
              <ScrollText className="h-4 w-4 text-muted/50 transition-colors group-hover:text-gold" />
            </button>
          ) : (
            <div className="rounded-xl border border-dashed border-border-soft p-3 text-[11px] text-muted/60">
              No active journey yet.
            </div>
          )}
        </div>

        {/* Pinned Destinations */}
        <div className="space-y-2">
          <SectionLabel>Pinned Destinations</SectionLabel>
          <div className="space-y-1">
            {pinned.map((d) => (
              <button
                key={d.name}
                onClick={() => onQuick(`Plan a trip to ${d.name}`)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-elevated"
              >
                <MapPin className="h-3.5 w-3.5 text-gold/70" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium text-foreground/90">{d.name}</div>
                  <div className="text-[9px] uppercase tracking-wide text-muted/55">{d.tag}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Quick Actions */}
      <div className="border-t border-border-soft p-3">
        <button
          onClick={() => onQuick("Plan a 5 day Goa trip")}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_30px_-12px_hsl(38_90%_50%/0.7)] transition-all hover:brightness-105 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          New Expedition
        </button>
      </div>
    </div>
  );
}

function RailButton({
  active,
  icon,
  label,
  onClick,
}: {
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-elevated text-foreground shadow-[inset_0_0_0_1px_hsl(38_90%_50%/0.25)]"
          : "text-muted hover:bg-elevated hover:text-foreground"
      )}
    >
      <span className={cn(active ? "text-gold" : "text-muted")}>{icon}</span>
      {label}
      {active && <motion.span layoutId="rail-active" className="ml-auto h-1.5 w-1.5 rounded-full bg-gold" />}
    </button>
  );
}

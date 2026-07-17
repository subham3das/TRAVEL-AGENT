"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  CloudSun,
  Cloud,
  CloudRain,
  Thermometer,
  Package,
  Gauge,
  Wallet,
  Sparkles,
  Award,
  Navigation,
  MapPin,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { CapacityRing } from "@/components/status/CapacityRing";
import { JourneyMap } from "./JourneyMap";
import { AlertCircle } from "lucide-react";

interface IntelCardProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  accent?: string;
}

function IntelCard({ icon: Icon, title, hint, children, className, accent = "text-gold" }: IntelCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "surface-panel rounded-2xl p-4 transition-shadow duration-300 hover:shadow-[0_30px_70px_-40px_hsl(0_0%_0%/0.95)]",
        className
      )}
    >
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", accent)} />
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">
            {title}
          </h4>
        </div>
        {hint && <span className="text-[9px] font-mono uppercase tracking-wide text-muted/45">{hint}</span>}
      </header>
      {children}
    </motion.section>
  );
}

function GapCard({ title, message }: { title: string; message: string }) {
  return (
    <IntelCard icon={AlertCircle} title={title} hint="Knowledge Gap" accent="text-amber-500/70">
      <p className="text-[11px] leading-relaxed text-muted/75">{message}</p>
    </IntelCard>
  );
}

/* ── Weather Intelligence ─────────────────────────── */
function WeatherIntel({ weather }: { weather: any }) {
  const cond = (weather?.condition as string) || "";
  const Icon = /rain/i.test(cond) ? CloudRain : /cloud/i.test(cond) ? Cloud : CloudSun;
  return (
    <IntelCard icon={Icon} title="Weather Intelligence" hint="Live">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-heading text-3xl font-semibold text-foreground">
            {weather?.temp || "—"}
          </div>
          <div className="mt-1 max-w-[12rem] text-[11px] leading-snug text-muted/80">
            {cond || "Advisory unavailable"}
          </div>
        </div>
        <Icon className="h-9 w-9 text-gold/70" />
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted/60">
        <Thermometer className="h-3 w-3" />
        <span>{weather?.precipitation || "No active precipitation"}</span>
      </div>
    </IntelCard>
  );
}

/* ── Budget Health ────────────────────────────────── */
function BudgetHealth({
  budget,
  limit,
  onLimitChange,
  onLimitCommit,
}: {
  budget: any;
  limit: number;
  onLimitChange: (n: number) => void;
  onLimitCommit?: (n: number) => void;
}) {
  const total = budget?.totalCost ?? 0;
  const b = budget?.breakdown || {};
  const pct = limit > 0 ? Math.min((total / limit) * 100, 100) : 0;
  const over = total > limit;
  const rows = [
    { k: "Stays", v: b.stays, c: "bg-gold" },
    { k: "Activities", v: b.activities, c: "bg-emerald" },
    { k: "Dining", v: b.food, c: "bg-amber-400" },
    { k: "Transit", v: b.transport, c: "bg-sky-400" },
  ];
  return (
    <IntelCard icon={Wallet} title="Budget Health" hint={over ? "Over" : "On Track"} accent={over ? "text-destructive" : "text-emerald"}>
      <div className="flex items-baseline justify-between font-mono text-xs">
        <span className="text-foreground">
          ₹{total.toLocaleString()}
        </span>
        <span className="text-muted/70">cap ₹{limit.toLocaleString()}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-elevated">
        <motion.div
          className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-gradient-to-r from-gold to-emerald")}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {rows.map((r) => (
          <div key={r.k} className="rounded-lg bg-elevated/60 p-2 text-center">
            <div className={cn("mx-auto mb-1 h-1 w-6 rounded-full", r.c)} />
            <div className="font-mono text-[11px] text-foreground">₹{(r.v ?? 0).toLocaleString()}</div>
            <div className="text-[8px] uppercase tracking-wide text-muted/55">{r.k}</div>
          </div>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="text-[9px] font-mono uppercase tracking-wide text-muted/55">Adjust budget cap</span>
        <input
          type="range"
          min={10000}
          max={150000}
          step={5000}
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          onMouseUp={(e) => onLimitCommit && onLimitCommit(Number((e.target as HTMLInputElement).value))}
          onTouchEnd={(e) => onLimitCommit && onLimitCommit(Number((e.target as HTMLInputElement).value))}
          className="mt-1 w-full accent-gold"
        />
      </label>
    </IntelCard>
  );
}

/* ── Capacity (Flighty-style, hover expands) ──────── */
function CapacityCard() {
  const { data: status, isLoading, isError } = useSystemStatus();
  if (isLoading) {
    return (
      <IntelCard icon={Gauge} title="Compute Capacity" hint="Loading...">
        <div className="h-3 w-full animate-pulse rounded bg-elevated" />
      </IntelCard>
    );
  }
  if (isError || !status) {
    return (
      <IntelCard icon={Gauge} title="Compute Capacity" hint="Offline" accent="text-destructive">
        <p className="text-[11px] leading-relaxed text-muted/75">Telemetry unavailable.</p>
      </IntelCard>
    );
  }
  const cap = status.capacity;
  const pct = cap.limit > 0 ? Math.round((cap.remaining / cap.limit) * 100) : 0;
  return (
    <IntelCard icon={Gauge} title="Compute Capacity" hint={cap.state}>
      <div className="group flex items-center gap-3">
        <CapacityRing percentage={pct} state={cap.state} size={40} strokeWidth={4} />
        <div className="flex-1">
          <div className="font-mono text-sm text-foreground">{pct}% available</div>
          <div className="max-h-0 overflow-hidden text-[10px] text-muted/70 opacity-0 transition-all duration-300 group-hover:max-h-16 group-hover:opacity-100">
            <span className="inline-flex items-center gap-1">
              <RotateCcw className="h-3 w-3" /> resets {new Date(cap.resetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </div>
    </IntelCard>
  );
}

/* ── Packing Intelligence ─────────────────────────── */
function PackingIntel({ packing }: { packing: string[] }) {
  return (
    <IntelCard icon={Package} title="Packing Intelligence" hint={`${packing.length} items`}>
      {packing.length === 0 ? (
        <p className="text-[11px] text-muted/60">No packing list generated for this journey.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5">
          {packing.slice(0, 6).map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-[11px] text-foreground/85">
              <span className="h-1.5 w-1.5 rounded-full bg-gold/70" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </IntelCard>
  );
}

/* ── Route Efficiency ─────────────────────────────── */
function RouteIntel({ dailyPlan }: { dailyPlan: any[] | null }) {
  let avgTransit = 0;
  let days = 0;
  if (dailyPlan) {
    days = dailyPlan.length;
    let sum = 0;
    for (const d of dailyPlan) sum += d?.metrics?.travelTimeMinutes || 0;
    avgTransit = days ? Math.round(sum / days) : 0;
  }
  const quality = avgTransit < 75 ? "Efficient" : avgTransit < 120 ? "Balanced" : "Dense";
  return (
    <IntelCard icon={Navigation} title="Route Efficiency" hint={days ? `${days} days` : "—"}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-2xl font-semibold text-foreground">{avgTransit}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted/60">avg min / day</div>
        </div>
        <span className="rounded-full border border-emerald/20 bg-emerald/10 px-3 py-1 text-[11px] font-medium text-emerald">
          {quality}
        </span>
      </div>
    </IntelCard>
  );
}

/* ── Travel Score ─────────────────────────────────── */
function TravelScoreCard({ travelScore }: { travelScore: any | null }) {
  if (!travelScore) return null;
  const { score, label, tone } = travelScore;
  const toneColor =
    tone === "emerald" ? "text-emerald" : tone === "gold" ? "text-gold" : "text-amber-400";
  return (
    <IntelCard icon={Award} title="Travel Score" hint="Composite">
      <div className="flex items-center gap-4">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(0 0% 16%)" strokeWidth="3" />
            <motion.circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={94.2}
              initial={{ strokeDashoffset: 94.2 }}
              animate={{ strokeDashoffset: 94.2 - (score / 100) * 94.2 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={toneColor}
            />
          </svg>
          <span className={cn("absolute font-heading text-lg font-semibold", toneColor)}>{score}</span>
        </div>
        <div>
          <div className={cn("text-sm font-semibold", toneColor)}>{label}</div>
          <div className="mt-0.5 text-[10px] leading-snug text-muted/70">
            Derived from routing, ratings & budget health.
          </div>
        </div>
      </div>
    </IntelCard>
  );
}

/* ── Journey Map card ─────────────────────────────── */
function JourneyMapCard({ dailyPlan }: { dailyPlan: any[] | null }) {
  return (
    <IntelCard icon={MapPin} title="Journey Map" hint="Schematic" className="overflow-hidden p-0">
      <div className="h-[220px]">
        <JourneyMap dailyPlan={dailyPlan} />
      </div>
    </IntelCard>
  );
}

interface IntelligencePanelProps {
  variant?: "full" | "compact";
  weather?: any;
  budget?: any;
  travelScore?: any;
  packing?: string[];
  dailyPlan?: any[] | null;
  budgetLimit?: number;
  onBudgetLimitChange?: (val: number) => void;
  onBudgetLimitCommit?: (val: number) => void;
}

export function IntelligencePanel({
  variant = "full",
  weather,
  budget,
  travelScore,
  packing,
  dailyPlan,
  budgetLimit = 50000,
  onBudgetLimitChange,
  onBudgetLimitCommit,
}: IntelligencePanelProps) {
  return (
    <div className="scrollbar-refined flex h-full flex-col gap-3 overflow-y-auto pr-0.5">
      <CapacityCard />
      <TravelScoreCard travelScore={travelScore} />

      {variant === "full" && (
        <>
          {weather ? (
            <WeatherIntel weather={weather} />
          ) : (
            <GapCard title="Weather Intelligence" message="Live weather telemetry is currently offline or unavailable for this destination." />
          )}
          
          {budget?.breakdown ? (
            <BudgetHealth 
              budget={budget} 
              limit={budgetLimit} 
              onLimitChange={onBudgetLimitChange || (() => {})} 
              onLimitCommit={onBudgetLimitCommit} 
            />
          ) : (
            <GapCard title="Budget Health" message="I don't yet have enough verified pricing information for this destination. Rather than projecting unreliable estimates, I've intentionally left this section empty." />
          )}
          {dailyPlan && dailyPlan.length > 0 ? (
            <RouteIntel dailyPlan={dailyPlan} />
          ) : (
            <GapCard title="Route Efficiency" message="I cannot calculate route efficiency until a valid itinerary has been generated." />
          )}
          
          {packing && packing.length > 0 ? (
            <PackingIntel packing={packing} />
          ) : (
            <GapCard title="Packing Intelligence" message="I don't have enough verified environmental context to generate a reliable packing list for this trip." />
          )}
          
          {dailyPlan && dailyPlan.length > 0 ? (
            <JourneyMapCard dailyPlan={dailyPlan} />
          ) : (
            <GapCard title="Journey Map" message="The map interface requires a complete itinerary with verified locations to render successfully." />
          )}
        </>
      )}

      {variant === "compact" && (
        <IntelCard icon={Sparkles} title="Companion" hint="Ready">
          <p className="text-[11px] leading-relaxed text-muted/75">
            Describe a destination and your travel style. The intelligence engine will compose a full journey.
          </p>
        </IntelCard>
      )}
    </div>
  );
}

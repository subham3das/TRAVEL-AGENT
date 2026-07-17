"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Hotel, Compass, Utensils, Navigation, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryMeta } from "./design";

interface JourneyMapProps {
  dailyPlan: any[] | null;
}

interface Node {
  id: string;
  name: string;
  type: string;
  day: number;
}

function buildNodes(dailyPlan: any[] | null): Node[] {
  if (!dailyPlan) return [];
  const nodes: Node[] = [];
  for (const day of dailyPlan) {
    for (const s of day?.slots || []) {
      nodes.push({ id: s.nodeId, name: s.name, type: s.type, day: day.day });
    }
  }
  return nodes.slice(0, 14);
}

const NODE_ICON: Record<string, typeof Compass> = {
  stay: Hotel,
  lunch: Utensils,
  meal: Utensils,
  transit: Navigation,
};

export function JourneyMap({ dailyPlan }: JourneyMapProps) {
  const nodes = React.useMemo(() => buildNodes(dailyPlan), [dailyPlan]);

  if (nodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border-soft text-muted/50">
          <MapPin className="h-4 w-4" />
        </div>
        <p className="text-[11px] leading-relaxed text-muted/60">
          Your route will map itself here once a journey is planned.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* ambient destination glow */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />

      <div className="scrollbar-refined h-full overflow-y-auto px-4 py-4">
        <div className="relative pl-7">
          {/* animated route line */}
          <svg
            className="pointer-events-none absolute left-[10px] top-2 h-[calc(100%-1rem)] w-px"
            preserveAspectRatio="none"
            viewBox="0 0 1 100"
          >
            <motion.line
              x1="0.5"
              y1="0"
              x2="0.5"
              y2="100"
              stroke="hsl(38 90% 55% / 0.5)"
              strokeWidth="1"
              strokeDasharray="2 3"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, ease: "easeInOut" }}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="space-y-3">
            {nodes.map((n, i) => {
              const meta = categoryMeta(n.type);
              const Icon = NODE_ICON[n.type] || Compass;
              const isHotel = n.type === "stay";
              const isCurrent = i === 0; // first node pulses as "current"
              return (
                <div key={n.id} className="relative flex items-center gap-3">
                  {/* node marker */}
                  <span className="absolute -left-[22px] top-1/2 -translate-y-1/2">
                    <span
                      className={cn(
                        "block h-2.5 w-2.5 rounded-full border-2",
                        isHotel ? "border-gold bg-gold" : "border-emerald bg-emerald/70"
                      )}
                      style={{ boxShadow: `0 0 10px 1px ${isHotel ? "hsl(38 90% 55% / 0.6)" : "hsl(158 64% 45% / 0.5)"}` }}
                    />
                    {isCurrent && (
                      <motion.span
                        className="absolute inset-0 -m-1 rounded-full"
                        style={{ boxShadow: "0 0 0 2px hsl(38 90% 55% / 0.4)" }}
                        animate={{ scale: [1, 1.8], opacity: [0.7, 0] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
                      />
                    )}
                  </span>

                  <div
                    className={cn(
                      "flex flex-1 items-center gap-2.5 rounded-lg border px-2.5 py-1.5 transition-colors",
                      isHotel ? "border-gold/20 bg-gold/[0.04]" : "border-border-soft bg-card/40"
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.text)} />
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/90">
                      {n.name}
                    </span>
                    <span className="shrink-0 text-[9px] font-mono uppercase tracking-wide text-muted/50">
                      D{n.day}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

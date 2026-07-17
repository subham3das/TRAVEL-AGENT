import * as React from "react";
import {
  Compass,
  Utensils,
  Hotel,
  Navigation,
  Sparkles,
  Camera,
  Mountain,
  Waves,
  type LucideIcon,
} from "lucide-react";

export type SlotKind = "activity" | "lunch" | "meal" | "stay" | "transit" | string;

interface CategoryMeta {
  icon: LucideIcon;
  label: string;
  /** tailwind text color class for accents */
  text: string;
  /** tailwind bg tint class */
  tint: string;
  /** editorial gradient class */
  image: string;
}

export function categoryMeta(type: SlotKind): CategoryMeta {
  switch (type) {
    case "stay":
      return {
        icon: Hotel,
        label: "Stay",
        text: "text-gold",
        tint: "bg-gold/10 text-gold",
        image: "editorial-image editorial-image--stay",
      };
    case "lunch":
    case "meal":
      return {
        icon: Utensils,
        label: "Dining",
        text: "text-amber-400",
        tint: "bg-amber-400/10 text-amber-300",
        image: "editorial-image editorial-image--meal",
      };
    case "transit":
      return {
        icon: Navigation,
        label: "Transit",
        text: "text-sky-300",
        tint: "bg-sky-400/10 text-sky-300",
        image: "editorial-image",
      };
    default:
      return {
        icon: Compass,
        label: "Experience",
        text: "text-emerald",
        tint: "bg-emerald/10 text-emerald",
        image: "editorial-image editorial-image--activity",
      };
  }
}

/** Build a truthful, data-derived "AI reason" from real slot metrics. */
export function deriveAiReason(slot: any): string | null {
  if (!slot) return null;
  const reasons: string[] = [];
  if (typeof slot.rating === "number" && slot.rating >= 4.5) {
    reasons.push(`Top-rated at ${slot.rating.toFixed(1)}★`);
  }
  if (typeof slot.transitFromPreviousMinutes === "number" && slot.transitFromPreviousMinutes <= 15) {
    reasons.push("minimal transit time");
  }
  if (typeof slot.price === "number" && slot.price > 0 && slot.type === "stay") {
    reasons.push("best value in its tier");
  }
  if (reasons.length === 0) return null;
  return reasons.join(" · ");
}

export interface TravelScore {
  score: number;
  label: string;
  tone: "emerald" | "gold" | "amber";
}



export const SCENE_ICONS = { Camera, Mountain, Waves, Compass, Sparkles };

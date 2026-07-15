"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
  variant?: "slot" | "card" | "text" | "circle";
}

export function SkeletonCard({
  className,
  variant = "slot",
}: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-muted/30 rounded-lg",
        variant === "slot" && "h-16 w-full border border-border/40",
        variant === "card" && "h-48 w-full border border-border/40",
        variant === "text" && "h-4 w-3/4",
        variant === "circle" && "h-10 w-10 rounded-full",
        className
      )}
    />
  );
}

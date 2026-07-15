"use client";

import * as React from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface BudgetSummaryProps {
  totalCost: number;
  budgetLimit: number;
  breakdown: {
    stays: number;
    activities: number;
    food: number;
    transport: number;
  };
  onLimitChange?: (newLimit: number) => void;
}

export function BudgetSummary({
  totalCost,
  budgetLimit,
  breakdown,
  onLimitChange,
}: BudgetSummaryProps) {
  const isOverBudget = totalCost > budgetLimit;

  return (
    <div
      className="border border-border rounded-lg p-5 bg-card space-y-4"
      role="region"
      aria-label="Budget summary details"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-heading font-semibold text-foreground">
          Budget Progression
        </h4>
        {isOverBudget ? (
          <div className="flex items-center gap-1 text-xs font-mono font-semibold text-destructive animate-pulse" role="status">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Over Budget</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs font-mono font-semibold text-emerald-500" role="status">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Optimal Allocations</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-mono">
          <span className="text-muted">Total Cost: ₹{totalCost}</span>
          <span className="text-foreground font-semibold">Limit: ₹{budgetLimit}</span>
        </div>
        <div className="h-2.5 w-full bg-muted/40 rounded-full overflow-hidden" aria-hidden="true">
          <div
            className={cn(
              "h-full transition-all duration-500",
              isOverBudget ? "bg-destructive" : "bg-primary"
            )}
            style={{ width: `${Math.min((totalCost / budgetLimit) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Slider */}
      {onLimitChange && (
        <div className="space-y-1.5 pt-2">
          <label className="text-[11px] text-muted font-mono block" htmlFor="budget-limit-slider">
            Adjust Budget Cap:
          </label>
          <input
            id="budget-limit-slider"
            type="range"
            min={10000}
            max={100000}
            step={5000}
            value={budgetLimit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="w-full h-2 bg-muted accent-primary rounded-lg cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          />
        </div>
      )}

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/80 text-xs font-mono">
        <div>
          <span className="text-muted block">Stays</span>
          <span className="text-foreground font-semibold">₹{breakdown.stays}</span>
        </div>
        <div>
          <span className="text-muted block">Activities</span>
          <span className="text-foreground font-semibold">₹{breakdown.activities}</span>
        </div>
        <div>
          <span className="text-muted block">Dining & Food</span>
          <span className="text-foreground font-semibold">₹{breakdown.food}</span>
        </div>
        <div>
          <span className="text-muted block">Transport</span>
          <span className="text-foreground font-semibold">₹{breakdown.transport}</span>
        </div>
      </div>
    </div>
  );
}

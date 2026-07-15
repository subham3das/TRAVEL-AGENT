"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-heading font-semibold tracking-tight text-primary">
            Welcome to Travel OS
          </h1>
          <p className="text-sm text-muted">
            Configure your base preferences to begin your journey.
          </p>
        </div>

        <div className="p-6 border border-border bg-card rounded-lg space-y-4">
          <div className="text-left space-y-1">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Step 1 of 3
            </span>
            <h2 className="text-lg font-medium text-foreground">
              What is your primary travel style?
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {["Budget", "Mid-Range", "Luxury"].map((style) => (
              <button
                key={style}
                className="py-3 px-2 text-sm font-medium border border-border hover:border-primary rounded-md bg-muted/20 hover:bg-muted/50 transition-all"
              >
                {style}
              </button>
            ))}
          </div>

          <button
            onClick={() => router.push("/workspace")}
            className="w-full py-2.5 px-4 text-sm font-semibold rounded-md bg-primary text-white hover:bg-primary/90 transition-all"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

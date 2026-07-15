"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { CapacityRing } from "./CapacityRing";
import { StatusDetailsPanel } from "./StatusDetailsPanel";
import { X } from "lucide-react";

export function SystemStatusWidget() {
  const { data: status, error, isLoading } = useSystemStatus();
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close when user clicks outside the panel
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);

  if (isLoading || error || !status) {
    return (
      <div className="flex items-center gap-1 opacity-50 select-none text-[10px] font-mono">
        <div className="w-2.5 h-2.5 rounded-full bg-border animate-pulse" />
        <span>SYS OFF</span>
      </div>
    );
  }

  const { percentage, state } = status.capacity;

  return (
    <div className="relative" ref={containerRef}>
      {/* Compact Interactive Widget Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1.5 rounded-full hover:bg-muted/40 transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`AI System Status: ${percentage}% capacity remaining. Click to expand telemetry metrics.`}
      >
        <CapacityRing percentage={percentage} state={state} size={28} />
        <span className="text-[11px] font-mono font-semibold tracking-wide text-foreground leading-none min-w-[24px]">
          {percentage}%
        </span>
      </button>

      {/* AnimatePresence for transitions */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Desktop Popover Overlay */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className="absolute right-0 mt-2 z-50 hidden md:block"
            >
              <StatusDetailsPanel status={status} />
            </motion.div>

            {/* Mobile Bottom Sheet Overlay (Backdrop + Sheet) */}
            <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />

              {/* Bottom Sheet Card */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className="relative bg-card border-t border-border rounded-t-2xl p-4 w-full flex flex-col items-center shadow-2xl max-h-[85vh] overflow-y-auto"
                role="dialog"
                aria-modal="true"
                aria-label="System status telemetry parameters"
              >
                {/* Drag handle */}
                <div className="w-12 h-1.5 rounded-full bg-muted/60 mb-4" />

                {/* Close button for reachability */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted text-muted"
                  aria-label="Close sheet"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Content Panel */}
                <div className="w-full flex justify-center pb-6">
                  <StatusDetailsPanel status={status} />
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

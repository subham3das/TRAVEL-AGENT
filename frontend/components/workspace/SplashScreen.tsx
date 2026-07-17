"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Compass } from "lucide-react";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_40%,hsl(38_90%_40%/0.12),transparent_70%)]" />
      <div className="relative flex flex-col items-center gap-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-gold/30 bg-card-elevated shadow-[0_0_60px_-12px_hsl(38_90%_50%/0.5)]"
        >
          <Compass className="h-9 w-9 text-gold" />
          <motion.span
            className="absolute inset-0 rounded-3xl border border-gold/40"
            animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        <div className="text-center">
          <motion.h1
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-2xl font-heading font-semibold tracking-[0.2em] text-gold-gradient uppercase"
          >
            Travel OS
          </motion.h1>
          <motion.p
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.8 }}
            className="mt-2 text-[10px] font-mono uppercase tracking-[0.45em] text-muted/70"
          >
            Intelligence Engine
          </motion.p>
        </div>

        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 140 }}
          transition={{ delay: 0.7, duration: 1.1, ease: "easeInOut" }}
          className="h-px overflow-hidden bg-gradient-to-r from-transparent via-gold/70 to-transparent"
        />
      </div>
    </motion.div>
  );
}

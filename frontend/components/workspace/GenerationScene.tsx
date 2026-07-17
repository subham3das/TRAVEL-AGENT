"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface GenerationSceneProps {
  isGenerating: boolean;
  stage: string;
}

export function GenerationScene({ isGenerating, stage }: GenerationSceneProps) {
  return (
    <AnimatePresence>
      {isGenerating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center space-y-6">
            {/* Sleek, modern 2D loading indicator */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-gold/15 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
              <div className="w-2 h-2 bg-gold rounded-full animate-ping"></div>
            </div>

            <div className="flex flex-col items-center text-center space-y-2">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.6 }}
                className="text-gold font-mono uppercase tracking-[0.25em] text-xs font-semibold"
              >
                Building Journey
              </motion.div>
              
              <AnimatePresence mode="wait">
                <motion.div
                  key={stage}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="text-white text-base md:text-lg font-light tracking-wide max-w-md px-4 min-h-[2.5rem] flex items-center justify-center"
                >
                  {stage || "Analyzing Travel Context..."}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

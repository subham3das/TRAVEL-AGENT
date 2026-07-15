"use client";

import * as React from "react";
import { Message } from "@/store/chatStore";
import { Terminal, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
// Let's define the local transitions since referencing markdown is not possible:
const smoothTransition = { type: "spring" as const, stiffness: 260, damping: 26 };

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  currentTokens?: string;
  onSelectOption?: (option: string) => void;
  showClarification?: boolean;
}

export function MessageList({
  messages,
  isStreaming,
  currentTokens = "",
  onSelectOption,
  showClarification = false,
}: MessageListProps) {
  const listEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentTokens, showClarification]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-[720px] mx-auto w-full">
      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={smoothTransition}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-lg text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-card text-foreground border border-border"
                  : msg.role === "system"
                  ? "text-primary font-mono text-xs"
                  : "text-foreground font-heading"
              }`}
            >
              {msg.text}
            </div>
            <span className="text-[10px] text-muted opacity-40 mt-1 px-1">
              {new Date(msg.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </motion.div>
        ))}

        {/* Streaming tokens panel */}
        {isStreaming && currentTokens && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-start"
          >
            <div className="max-w-[85%] px-4 py-2.5 rounded-lg text-sm leading-relaxed text-foreground font-heading border-l-2 border-primary bg-card/30">
              {currentTokens}
              <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5" />
            </div>
          </motion.div>
        )}

        {/* Collapsible System Logs */}
        {isStreaming && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="w-full bg-card/40 border border-border rounded-lg p-3 font-mono text-xs text-muted/80 space-y-1.5"
          >
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Terminal className="h-3.5 w-3.5" />
              <span>System Intercept Log</span>
            </div>
            <div className="space-y-1 pl-5">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span>Execution Engine initialized</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
                <span>Planner calculating route matrices...</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Inline Clarification Pills */}
        {showClarification && onSelectOption && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full border border-border bg-card p-4 rounded-lg space-y-3"
          >
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Clarification Required
            </span>
            <div className="text-sm font-medium text-foreground">
              Please specify your travel group size to structure hotel rates:
            </div>
            <div className="flex gap-2">
              {["Solo", "Couple", "Family"].map((opt) => (
                <button
                  key={opt}
                  onClick={() => onSelectOption(opt)}
                  className="py-1.5 px-3 text-xs font-medium border border-border hover:border-primary hover:bg-muted/50 rounded-full transition-all"
                >
                  {opt}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div ref={listEndRef} />
    </div>
  );
}

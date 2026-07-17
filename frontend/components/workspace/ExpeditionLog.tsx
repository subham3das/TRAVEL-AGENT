"use client";

import * as React from "react";
import { Compass } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { ConversationalInput } from "@/components/workspace/ConversationalInput";

interface ExpeditionLogProps {
  messages: any[];
  isStreaming: boolean;
  showClarification: boolean;
  clarificationTarget?: string;
  clarificationConfig?: any;
  onSend: (text: string) => void;
  onSelectOption?: (opt: string) => void;
}

export function ExpeditionLog({
  messages,
  isStreaming,
  showClarification,
  clarificationTarget,
  clarificationConfig,
  onSend,
  onSelectOption,
}: ExpeditionLogProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-soft px-1 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/30 bg-card-elevated text-gold">
            <Compass className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted/60">Companion</div>
            <div className="font-heading text-sm font-semibold text-foreground">Expedition Log</div>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide text-muted/55">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
          </span>
          {isStreaming ? "Composing" : "Active"}
        </span>
      </div>

      <div className="scrollbar-refined flex-1 overflow-y-auto py-5">
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          showClarification={false}
          clarificationTarget={clarificationTarget}
          onSelectOption={onSelectOption}
        />
      </div>

      <div className="sticky bottom-0 border-t border-border-soft bg-background/80 backdrop-blur-xl">
        <AnimatePresence mode="wait">
          {showClarification && clarificationTarget ? (
            <motion.div
              key={`input-${clarificationTarget}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="px-4 py-4"
            >
              <ConversationalInput
                target={clarificationTarget}
                config={clarificationConfig}
                onSelect={(value) => onSelectOption?.(value)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="chat-input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="px-1 pb-1 pt-3"
            >
              <ChatInput
                onSend={onSend}
                disabled={isStreaming}
                placeholder="Describe a destination, dates, and your travel style..."
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

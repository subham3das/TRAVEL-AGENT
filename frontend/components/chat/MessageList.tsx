"use client";

import * as React from "react";
import { Message } from "@/store/chatStore";
import { motion, AnimatePresence } from "framer-motion";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { useItineraryStore } from "@/store/itineraryStore";
import { ConversationalInput } from "../workspace/ConversationalInput";

const smoothTransition = { type: "spring" as const, stiffness: 260, damping: 26 };

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  onSelectOption?: (option: string) => void;
  showClarification?: boolean;
  clarificationTarget?: string;
}

function renderMarkdown(text: string) {
  if (!text) return null;

  const rawLines = text.split("\n");
  const processedLines: string[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      processedLines.push("");
      continue;
    }

    const parts = trimmed.split(/(?=\b\d+\.\s+\*\*)/g);
    for (const part of parts) {
      if (part.trim()) {
        processedLines.push(part.trim());
      }
    }
  }

  return (
    <div className="space-y-2 font-sans text-[13px] md:text-sm">
      {processedLines.map((line, idx) => {
        if (!line) return <div key={idx} className="h-1.5" />;

        const listMatch = line.match(/^([-*]|\d+\.)\s+(.*)$/);
        const isListItem = !!listMatch;
        const listIndicator = isListItem ? listMatch[1] : null;
        let contentText = isListItem ? listMatch[2] : line;

        const boldParts = contentText.split("**");
        const renderedContent = boldParts.map((part, index) => {
          if (index % 2 === 1) {
            return (
              <strong key={index} className="font-bold text-foreground">
                {part}
              </strong>
            );
          }
          return part;
        });

        if (isListItem) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-4 py-0.5">
              <span className="text-foreground/80 font-semibold select-none">{listIndicator}</span>
              <span className="flex-1 text-foreground/90">{renderedContent}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="text-foreground/90 leading-relaxed">
            {renderedContent}
          </p>
        );
      })}
    </div>
  );
}

export function MessageList({
  messages,
  isStreaming,
  onSelectOption,
  showClarification = false,
  clarificationTarget,
}: MessageListProps) {
  const listEndRef = React.useRef<HTMLDivElement>(null);
  const activeContext = useItineraryStore((s) => s.activeContext);

  React.useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showClarification, clarificationTarget]);

  return (
    <div
      className="flex-1 overflow-y-auto p-4 space-y-4 max-w-[720px] mx-auto w-full"
      role="log"
      aria-label="Conversation Feed"
    >
      <AnimatePresence initial={false}>
        {messages.map((msg) => {
          if (msg.status === "streaming" && !msg.text) {
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-2 w-full max-w-[85%]"
              >
                <div className="text-[10px] font-mono text-muted uppercase animate-pulse">
                  Orchestrator calculating itinerary parameters...
                </div>
                <SkeletonCard variant="text" />
                <SkeletonCard variant="slot" className="h-10" />
              </motion.div>
            );
          }

          return (
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
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-gold/10 text-foreground border border-gold/20"
                    : msg.role === "system"
                    ? "text-gold/80 font-mono text-xs"
                    : "text-foreground border border-border-soft bg-card-elevated/60"
                }`}
              >
                {renderMarkdown(msg.text)}
                {msg.status === "streaming" && (
                  <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5" />
                )}
              </div>
              <span className="text-[10px] text-muted opacity-40 mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </motion.div>
          );
        })}

        {showClarification && clarificationTarget && onSelectOption && (
          <motion.div
            key="conversational-clarification"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full border border-border-soft bg-card-elevated/45 backdrop-blur-md p-5 rounded-2xl space-y-4 shadow-xl max-w-[85%] mt-2 ml-1"
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-gold animate-pulse" />
              <span className="text-[10px] font-semibold text-gold uppercase tracking-[0.2em]">
                Clarification Required
              </span>
            </div>
            <ConversationalInput
              target={clarificationTarget}
              config={activeContext?.state?.conversationState?.clarificationConfig}
              onSelect={onSelectOption}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <div ref={listEndRef} />
    </div>
  );
}

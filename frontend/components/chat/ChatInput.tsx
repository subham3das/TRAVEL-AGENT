"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  placeholder = "Where would you like to travel next?",
  disabled = false,
}: ChatInputProps) {
  const [query, setQuery] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !disabled) {
      onSend(query.trim());
      setQuery("");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex items-center w-full max-w-[760px] mx-auto border border-border-soft bg-surface/70 rounded-full p-1.5 pl-4 focus-within:border-gold/50 focus-within:ring-2 focus-within:ring-gold/15 transition-all backdrop-blur-md"
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted/70 focus:outline-none disabled:opacity-50 h-11"
        aria-label="Ask Travel Assistant"
      />
      <motion.button
        whileTap={{ scale: 0.94 }}
        type="submit"
        disabled={disabled || !query.trim()}
        className={cn(
          "p-2.5 rounded-full transition-all text-primary-foreground bg-gold hover:brightness-105 disabled:bg-elevated disabled:text-muted disabled:cursor-not-allowed flex items-center justify-center h-10 w-10 focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <Send className="h-4 w-4" />
      </motion.button>
    </form>
  );
}

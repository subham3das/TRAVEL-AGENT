"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

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
      className="relative flex items-center w-full max-w-[720px] mx-auto bg-card border border-border rounded-lg p-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all"
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none disabled:opacity-50 h-10 md:h-8"
        aria-label="Ask Travel Assistant"
      />
      <button
        type="submit"
        disabled={disabled || !query.trim()}
        className={cn(
          "p-2 rounded-md transition-colors text-white bg-primary hover:bg-primary/95 disabled:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center h-10 w-10 md:h-8 md:w-8",
        )}
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  );
}

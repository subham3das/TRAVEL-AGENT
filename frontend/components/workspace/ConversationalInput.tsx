"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { MapPin, Users, Calendar, Clock, Wallet, Sparkles } from "lucide-react";
import { SelectionCard } from "./SelectionCard";

interface ConversationalInputProps {
  target: string;
  config?: {
    prompt?: string;
    options?: string[];
    allowText?: boolean;
  };
  onSelect: (value: string) => void;
}

const slideUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { type: "spring" as const, stiffness: 300, damping: 28 },
};

function DestinationInput({ config, onSelect }: { config: ConversationalInputProps["config"]; onSelect: (v: string) => void }) {
  const [text, setText] = React.useState("");
  const destinations = config?.options || ["Goa", "Manali", "Jaipur", "Kerala", "Ladakh", "Udaipur"];

  return (
    <motion.div {...slideUp} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {destinations.map((d) => (
          <button
            key={d}
            onClick={() => onSelect(d)}
            className="flex items-center gap-1.5 rounded-full border border-border-soft bg-card-elevated/60 px-3.5 py-2 text-xs font-medium text-foreground transition-all hover:border-gold/40 hover:bg-gold/5 hover:text-gold"
          >
            <MapPin className="h-3 w-3 text-gold/60" />
            {d}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onSelect(text.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Or type a destination..."
          className="flex-1 rounded-full border border-border-soft bg-card-elevated/40 px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 transition-all focus:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/20"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded-full bg-gold/10 px-4 py-2.5 text-xs font-medium text-gold transition-all hover:bg-gold/20 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Go
        </button>
      </form>
    </motion.div>
  );
}

function TravelersInput({ config, onSelect }: { config: ConversationalInputProps["config"]; onSelect: (v: string) => void }) {
  const options = config?.options || ["Solo", "Couple", "Family", "Friends"];
  const icons: Record<string, React.ReactNode> = {
    Solo: <Users className="h-4 w-4" />,
    Couple: <Users className="h-4 w-4" />,
    Family: <Users className="h-4 w-4" />,
    Friends: <Users className="h-4 w-4" />,
  };

  return (
    <motion.div {...slideUp} className="grid grid-cols-2 gap-2.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className="flex items-center gap-2.5 rounded-xl border border-border-soft bg-card-elevated/60 px-4 py-3.5 text-sm font-medium text-foreground transition-all hover:border-gold/40 hover:bg-gold/5 hover:text-gold"
        >
          <span className="text-gold/60">{icons[opt] || <Users className="h-4 w-4" />}</span>
          {opt}
        </button>
      ))}
    </motion.div>
  );
}

function DatesInput({ config, onSelect }: { config: ConversationalInputProps["config"]; onSelect: (v: string) => void }) {
  const options = config?.options || ["This month", "Next month", "In December", "Flexible"];

  return (
    <motion.div {...slideUp} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className="flex items-center gap-1.5 rounded-full border border-border-soft bg-card-elevated/60 px-3.5 py-2 text-xs font-medium text-foreground transition-all hover:border-gold/40 hover:bg-gold/5 hover:text-gold"
          >
            <Calendar className="h-3 w-3 text-gold/60" />
            {opt}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function DurationInput({ config, onSelect }: { config: ConversationalInputProps["config"]; onSelect: (v: string) => void }) {
  const options = config?.options || ["3 days", "5 days", "7 days", "10 days"];

  return (
    <motion.div {...slideUp} className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className="flex items-center gap-1.5 rounded-full border border-border-soft bg-card-elevated/60 px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:border-gold/40 hover:bg-gold/5 hover:text-gold"
        >
          <Clock className="h-3.5 w-3.5 text-gold/60" />
          {opt}
        </button>
      ))}
    </motion.div>
  );
}

function BudgetInput({ config, onSelect }: { config: ConversationalInputProps["config"]; onSelect: (v: string) => void }) {
  const [amount, setAmount] = React.useState("");
  const presets = ["15000", "25000", "50000", "100000"];
  const labels: Record<string, string> = {
    "15000": "15K",
    "25000": "25K",
    "50000": "50K",
    "100000": "1L+",
  };

  return (
    <motion.div {...slideUp} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => onSelect(`₹${labels[p]}`)}
            className="flex items-center gap-1 rounded-full border border-border-soft bg-card-elevated/60 px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:border-gold/40 hover:bg-gold/5 hover:text-gold"
          >
            <Wallet className="h-3.5 w-3.5 text-gold/60" />
            ₹{labels[p]}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (amount.trim()) onSelect(`₹${amount.trim()}`);
        }}
        className="flex gap-2"
      >
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Or enter custom amount..."
          className="flex-1 rounded-full border border-border-soft bg-card-elevated/40 px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 transition-all focus:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/20"
        />
        <button
          type="submit"
          disabled={!amount.trim()}
          className="rounded-full bg-gold/10 px-4 py-2.5 text-xs font-medium text-gold transition-all hover:bg-gold/20 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Set
        </button>
      </form>
    </motion.div>
  );
}

function StyleInput({ config, onSelect }: { config: ConversationalInputProps["config"]; onSelect: (v: string) => void }) {
  const options = config?.options || ["Budget", "Mid", "Luxury"];
  const styles: Record<string, { icon: React.ReactNode; color: string }> = {
    Budget: { icon: <Sparkles className="h-4 w-4" />, color: "text-emerald" },
    Mid: { icon: <Sparkles className="h-4 w-4" />, color: "text-gold" },
    Luxury: { icon: <Sparkles className="h-4 w-4" />, color: "text-amber" },
  };

  return (
    <motion.div {...slideUp} className="grid grid-cols-3 gap-2.5">
      {options.map((opt) => {
        const s = styles[opt] || { icon: <Sparkles className="h-4 w-4" />, color: "text-foreground" };
        return (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className="flex flex-col items-center gap-2 rounded-xl border border-border-soft bg-card-elevated/60 px-4 py-4 text-sm font-medium text-foreground transition-all hover:border-gold/40 hover:bg-gold/5 hover:text-gold"
          >
            <span className={s.color}>{s.icon}</span>
            {opt}
          </button>
        );
      })}
    </motion.div>
  );
}

function TextInput({ config, onSelect }: { config: ConversationalInputProps["config"]; onSelect: (v: string) => void }) {
  const [text, setText] = React.useState("");

  return (
    <motion.div {...slideUp}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onSelect(text.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={config?.prompt || "Type your answer..."}
          className="flex-1 rounded-full border border-border-soft bg-card-elevated/40 px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 transition-all focus:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/20"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded-full bg-gold/10 px-4 py-2.5 text-xs font-medium text-gold transition-all hover:bg-gold/20 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </motion.div>
  );
}

function PlacesInput({ config, onSelect }: { config: any; onSelect: (v: string) => void }) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const candidates: any[] = config?.candidates || [];

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedNames = candidates
      .filter((c) => selectedIds.has(c.id))
      .map((c) => c.name);
    if (selectedNames.length > 0) {
      onSelect(selectedNames.join(", "));
    }
  };

  return (
    <motion.div {...slideUp} className="space-y-4 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1 scrollbar-refined">
        {candidates.map((c) => (
          <SelectionCard
            key={c.id}
            candidate={c}
            isSelected={selectedIds.has(c.id)}
            onToggle={toggle}
            type="experience"
          />
        ))}
      </div>
      <div className="flex justify-end pt-2">
        <button
          onClick={handleConfirm}
          disabled={selectedIds.size === 0}
          className="rounded-full bg-gold px-5 py-2.5 text-xs font-semibold text-black transition-all hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
        >
          Confirm Selection ({selectedIds.size})
        </button>
      </div>
    </motion.div>
  );
}

function HotelInput({ config, onSelect }: { config: any; onSelect: (v: string) => void }) {
  const candidates: any[] = config?.candidates || [];

  return (
    <motion.div {...slideUp} className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-h-[320px] overflow-y-auto pr-1 scrollbar-refined">
      {candidates.map((c) => (
        <SelectionCard
          key={c.id}
          candidate={c}
          isSelected={false}
          onToggle={() => onSelect(c.name)}
          type="hotel"
        />
      ))}
    </motion.div>
  );
}

function FlightInput({ config, onSelect }: { config: any; onSelect: (v: string) => void }) {
  const candidates: any[] = config?.candidates || [];

  return (
    <motion.div {...slideUp} className="flex flex-col gap-2.5 w-full max-h-[320px] overflow-y-auto pr-1 scrollbar-refined">
      {candidates.map((c) => (
        <SelectionCard
          key={c.id}
          candidate={c}
          isSelected={false}
          onToggle={() => onSelect(c.name)}
          type="flight"
        />
      ))}
    </motion.div>
  );
}

function BudgetEstimateInput({ config, onSelect }: { config: any; onSelect: (v: string) => void }) {
  const candidates: any[] = config?.candidates || [];

  return (
    <motion.div {...slideUp} className="flex flex-col gap-2 w-full">
      {candidates.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.name)}
          className="w-full text-left rounded-xl border border-border-soft bg-card-elevated/60 px-4 py-3 text-xs md:text-sm font-medium text-foreground transition-all hover:border-gold/40 hover:bg-gold/5 hover:text-gold"
        >
          {c.name}
        </button>
      ))}
    </motion.div>
  );
}

export function ConversationalInput({ target, config, onSelect }: ConversationalInputProps) {
  switch (target) {
    case "destination":
      return <DestinationInput config={config} onSelect={onSelect} />;
    case "travelersType":
      return <TravelersInput config={config} onSelect={onSelect} />;
    case "travelDates":
      return <DatesInput config={config} onSelect={onSelect} />;
    case "durationDays":
      return <DurationInput config={config} onSelect={onSelect} />;
    case "budget":
      return <BudgetInput config={config} onSelect={onSelect} />;
    case "travelStyle":
      return <StyleInput config={config} onSelect={onSelect} />;
    case "selectedPlaces":
      return <PlacesInput config={config} onSelect={onSelect} />;
    case "selectedHotel":
      return <HotelInput config={config} onSelect={onSelect} />;
    case "selectedFlight":
      return <FlightInput config={config} onSelect={onSelect} />;
    case "budgetEstimateResponse":
      return <BudgetEstimateInput config={config} onSelect={onSelect} />;
    default:
      return <TextInput config={config} onSelect={onSelect} />;
  }
}

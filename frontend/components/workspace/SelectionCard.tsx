"use client";

import React from "react";
import { motion } from "framer-motion";
import { Check, Clock, MapPin, Users, Award, ExternalLink } from "lucide-react";

export interface Candidate {
  id: string;
  name: string;
  image: string;
  description: string;
  price?: string;
  duration?: string;
  stops?: string;
  departure?: string;
  distance?: string;
  crowd?: string;
  confidence?: string;
  rating?: string;
  amenities?: string[];
  explanation?: string;
  badges?: string[];
}

interface SelectionCardProps {
  candidate: Candidate;
  isSelected: boolean;
  onToggle: (id: string) => void;
  type?: "experience" | "hotel" | "flight" | "generic";
}

export function SelectionCard({ candidate, isSelected, onToggle, type = "generic" }: SelectionCardProps) {
  return (
    <motion.div
      layout
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onToggle(candidate.id)}
      className={`relative cursor-pointer overflow-hidden rounded-xl border ${
        isSelected ? "border-primary ring-1 ring-primary shadow-md" : "border-border hover:border-primary/50 shadow-sm"
      } bg-card text-card-foreground transition-all flex flex-col`}
    >
      {/* Checkbox indicator */}
      <div className="absolute top-3 left-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-sm">
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex h-full w-full items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Check className="h-4 w-4" />
          </motion.div>
        )}
      </div>

      {/* Hero Image */}
      <div className="relative h-32 w-full overflow-hidden bg-muted">
        {(candidate.image || (candidate as any).images?.[0]) && (
          <img
            src={candidate.image || (candidate as any).images?.[0]}
            alt={candidate.name}
            className={`h-full w-full object-cover transition-transform duration-500 ${isSelected ? "scale-105" : ""}`}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Title and Rating/Price positioned over image bottom */}
        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end text-white">
          <div className="font-semibold leading-tight drop-shadow-md text-xs md:text-sm">
            {candidate.name}
          </div>
          {candidate.rating && (
            <div className="text-xs font-medium bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded text-yellow-400 drop-shadow">
              {candidate.rating}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col gap-3 text-xs md:text-sm">
        {/* AI Explanation / Short Desc */}
        {(candidate.explanation || candidate.description) && (
          <div className="text-muted-foreground text-xs leading-relaxed">
            {candidate.explanation ? (
              <span className="text-primary font-medium mr-1">AI Pick:</span>
            ) : null}
            {candidate.explanation || candidate.description}
          </div>
        )}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 mt-auto">
          {(candidate.price || (candidate as any).priceLabel) && (
            <div className="flex items-center gap-1.5 text-[11px] md:text-xs font-medium">
              <span className="text-muted-foreground">Price:</span> {candidate.price || (candidate as any).priceLabel}
            </div>
          )}
          {candidate.duration && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {candidate.duration}
            </div>
          )}
          {candidate.distance && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {candidate.distance}
            </div>
          )}
          {candidate.crowd && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {candidate.crowd}
            </div>
          )}
          {candidate.departure && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Departs {candidate.departure}
            </div>
          )}
          {candidate.stops && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ExternalLink className="h-3.5 w-3.5" />
              {candidate.stops}
            </div>
          )}
        </div>

        {/* Confidence & Amenities Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border mt-1">
          {candidate.confidence && (
            <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-green-600 dark:text-green-500">
              <Award className="h-3.5 w-3.5" />
              {candidate.confidence}
            </div>
          )}
          
          <button 
            className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            onClick={(e) => { e.stopPropagation(); /* View details logic here */ }}
          >
            Details <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

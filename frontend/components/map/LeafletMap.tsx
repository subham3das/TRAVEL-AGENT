"use client";

import * as React from "react";
import { Compass, ZoomIn, ZoomOut } from "lucide-react";
import { motion } from "framer-motion";

interface Marker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: "activity" | "lunch" | "stay";
}

interface LeafletMapProps {
  markers?: Marker[];
}

export function LeafletMap({
  markers = [
    { id: "1", name: "Baga Beach", lat: 30, lng: 40, type: "activity" },
    { id: "2", name: "Britannia Beach Shack", lat: 50, lng: 60, type: "lunch" },
    { id: "3", name: "Basilica of Bom Jesus", lat: 70, lng: 50, type: "activity" },
    { id: "4", name: "Goa BUDGET Hotel 1", lat: 45, lng: 35, type: "stay" }
  ],
}: LeafletMapProps) {
  const [zoom, setZoom] = React.useState(1);

  return (
    <div className="relative w-full h-full bg-card border border-border rounded-lg overflow-hidden flex flex-col justify-between min-h-[300px]">
      {/* Map header */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-background/80 backdrop-blur-md rounded border border-border text-[11px] font-mono text-foreground font-semibold">
        <Compass className="h-3.5 w-3.5 text-primary animate-spin" style={{ animationDuration: "10s" }} />
        <span>Vector Route Map</span>
      </div>

      {/* Map controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.2, 2))}
          className="p-1.5 bg-background/80 hover:bg-muted border border-border text-foreground rounded flex items-center justify-center transition-colors"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.2, 0.6))}
          className="p-1.5 bg-background/80 hover:bg-muted border border-border text-foreground rounded flex items-center justify-center transition-colors"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* SVG Canvas Map Grid */}
      <div className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center">
        <svg
          className="w-full h-full min-h-[250px] transition-transform duration-300"
          style={{ transform: `scale(${zoom})` }}
          viewBox="0 0 100 100"
        >
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="hsl(240, 5%, 12%)" strokeWidth="0.1" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" />

          {/* Route path lines */}
          {markers.length > 1 && (
            <motion.path
              d={`M ${markers.map((m) => `${m.lng} ${m.lat}`).join(" L ")}`}
              fill="none"
              stroke="hsl(38, 92%, 50%)"
              strokeWidth="0.4"
              strokeDasharray="1.5, 1.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
          )}

          {/* Markers */}
          {markers.map((m) => (
            <g key={m.id}>
              {/* Glow circle */}
              <circle
                cx={m.lng}
                cy={m.lat}
                r="2"
                fill={
                  m.type === "activity"
                    ? "hsl(198, 80%, 45%)"
                    : m.type === "lunch"
                    ? "hsl(142, 70%, 45%)"
                    : "hsl(38, 92%, 50%)"
                }
                opacity="0.3"
                className="animate-ping"
                style={{ animationDuration: "3s" }}
              />
              {/* Center dot */}
              <circle
                cx={m.lng}
                cy={m.lat}
                r="1"
                fill={
                  m.type === "activity"
                    ? "hsl(198, 80%, 45%)"
                    : m.type === "lunch"
                    ? "hsl(142, 70%, 45%)"
                    : "hsl(38, 92%, 50%)"
                }
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Map footer coordinates display */}
      <div className="p-2 border-t border-border bg-muted/20 text-[9px] font-mono text-muted flex justify-between">
        <span>LAT: 15.2993° N</span>
        <span>LNG: 74.1240° E</span>
      </div>
    </div>
  );
}

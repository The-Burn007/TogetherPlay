"use client";

import React, { useState, useEffect } from "react";
import type { HomePresetKey } from "@/lib/firebase/services/home";
import { SlidersHorizontal, X } from "lucide-react";

export interface HomeStateSelectorProps {
  currentPreset: HomePresetKey;
  onSelectPreset: (preset: HomePresetKey) => void;
  coupleId?: string;
  forceVisible?: boolean;
}

const PRESET_OPTIONS: { id: HomePresetKey; label: string }[] = [
  { id: "live", label: "Live Connection" },
  { id: "partner_online", label: "Partner Online" },
  { id: "partner_in_game", label: "In Game" },
  { id: "partner_in_call", label: "In Call" },
  { id: "partner_away", label: "Away" },
  { id: "partner_offline", label: "Offline" },
  { id: "no_previous_games", label: "New Archive" },
  { id: "no_memories", label: "No Memories" },
  { id: "new_couple", label: "Pending Link" },
];

export const HomeStateSelector: React.FC<HomeStateSelectorProps> = ({
  currentPreset,
  onSelectPreset,
  coupleId,
  forceVisible = false,
}) => {
  // In production builds, development controls are strictly disabled and never rendered.
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const [isDebugActive, setIsDebugActive] = useState(forceVisible);

  useEffect(() => {
    if (forceVisible) {
      setIsDebugActive(true);
      return;
    }
    // Only show in development if explicitly requested via query parameter (?debug=true or ?dev=true)
    if (typeof window !== "undefined") {
      const search = window.location.search;
      if (search.includes("debug=true") || search.includes("dev=true")) {
        setIsDebugActive(true);
      }
    }
  }, [forceVisible]);

  // NEVER show development tooling in normal consumer view
  if (!isDebugActive) {
    return null;
  }

  return (
    <div
      id="dev-state-selector"
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 py-2 rounded-xl bg-surface-charcoal border border-border-strong text-xs font-mono select-none"
    >
      <div className="flex items-center gap-2 text-soft-stone">
        <span className="w-1.5 h-1.5 rounded-full bg-brand" />
        <span className="uppercase tracking-widest font-semibold text-warm-cream">
          Developer Diagnostics
        </span>
        <span className="text-soft-sage" aria-hidden="true">·</span>
        <span className="text-soft-sage truncate">
          {coupleId ? `Room ${coupleId.slice(-6).toUpperCase()}` : "Private Room"}
        </span>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none bg-surface/80 border border-border rounded-lg p-1 text-[11px]">
        <div className="flex items-center gap-1 shrink-0 px-1 text-soft-sage">
          <SlidersHorizontal className="w-3 h-3" />
          <span className="hidden md:inline">State:</span>
        </div>
        {PRESET_OPTIONS.map((opt) => {
          const isActive = currentPreset === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onSelectPreset(opt.id)}
              className={`px-2 py-0.5 rounded whitespace-nowrap transition-all font-medium cursor-pointer ${
                isActive
                  ? "bg-brand text-text-on-mint font-semibold shadow-sm"
                  : "text-soft-stone hover:text-warm-cream hover:bg-surface-secondary"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
        <button
          onClick={() => setIsDebugActive(false)}
          className="p-1 rounded text-soft-sage hover:text-warm-cream hover:bg-surface-secondary ml-1 cursor-pointer"
          title="Dismiss developer toolbar"
          aria-label="Dismiss developer toolbar"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

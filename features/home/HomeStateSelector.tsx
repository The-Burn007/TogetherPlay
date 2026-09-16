"use client";

import React from "react";
import type { HomePresetKey } from "@/lib/firebase/services/home";
import { SlidersHorizontal } from "lucide-react";

export interface HomeStateSelectorProps {
  currentPreset: HomePresetKey;
  onSelectPreset: (preset: HomePresetKey) => void;
  coupleId?: string;
}

const PRESET_OPTIONS: { id: HomePresetKey; label: string }[] = [
  { id: "live", label: "Live Firebase" },
  { id: "partner_online", label: "Partner Online" },
  { id: "partner_in_game", label: "Partner in Game" },
  { id: "partner_in_call", label: "Partner in Call" },
  { id: "partner_away", label: "Partner Away" },
  { id: "partner_offline", label: "Partner Offline" },
  { id: "no_previous_games", label: "No Previous Games" },
  { id: "no_memories", label: "No Memories" },
  { id: "new_couple", label: "New Couple" },
];

export const HomeStateSelector: React.FC<HomeStateSelectorProps> = ({
  currentPreset,
  onSelectPreset,
  coupleId,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1 py-1">
      <div className="flex items-center gap-2 text-[10px] font-mono text-on-surface-variant">
        <span className="w-1.5 h-1.5 rounded-full bg-player-two-sage animate-pulse" />
        <span className="uppercase tracking-widest font-semibold text-on-surface">
          Sanctuary State
        </span>
        <span className="opacity-40">|</span>
        <span className="truncate">{coupleId ? `ROOM #${coupleId.slice(-6).toUpperCase()}` : "PRIVATE SPACE"}</span>
      </div>

      {/* Horizontal Scrollable State Switcher Pill Strip */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none bg-surface-raised border border-subtle-border rounded-full p-1 text-[10px] font-mono">
        <div className="flex items-center gap-1 shrink-0 px-1 text-on-surface-variant/70">
          <SlidersHorizontal className="w-3 h-3" />
          <span className="hidden md:inline">Preset:</span>
        </div>
        {PRESET_OPTIONS.map((opt) => {
          const isActive = currentPreset === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onSelectPreset(opt.id)}
              className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-all font-medium cursor-pointer ${
                isActive
                  ? "bg-surface-overlay text-shared-amber font-bold shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-overlay/50"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

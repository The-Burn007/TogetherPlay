"use client";

import React from "react";
import Link from "next/link";
import { DoorOpen } from "lucide-react";

export interface LobbyBarProps {
  selectedGameTitle?: string;
  partnerStatus?: string;
}

export const LobbyBar: React.FC<LobbyBarProps> = ({
  selectedGameTitle = "Speed Duel",
  partnerStatus = "Idle in lobby · Waiting on you",
}) => {
  return (
    <aside className="sticky bottom-20 z-30 w-full rounded-2xl bg-surface/95 backdrop-blur-xl border border-border p-3.5 shadow-elevation-lg flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <div className="relative w-9 h-9 rounded-full bg-surface-raised border border-border flex items-center justify-center shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-brand" />
          <span className="absolute inset-0 rounded-full bg-brand/20 animate-ping" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-text-primary font-semibold truncate font-mono">
            Partner Pick: <span className="text-brand">{selectedGameTitle}</span>
          </span>
          <span className="text-[11px] text-text-muted truncate">
            {partnerStatus}
          </span>
        </div>
      </div>
      <Link
        href="/play/lobby"
        className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand text-text-on-mint font-semibold text-xs tracking-tight active:scale-95 transition-all shadow-sm hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-brand"
      >
        <DoorOpen className="w-4 h-4" />
        <span>Enter Lobby</span>
      </Link>
    </aside>
  );
};

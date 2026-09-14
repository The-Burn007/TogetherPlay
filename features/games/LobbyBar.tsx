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
    <aside className="sticky bottom-20 z-30 w-full rounded-xl bg-surface-overlay/95 backdrop-blur-md border border-subtle-border p-3 shadow-2xl flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <div className="relative w-9 h-9 rounded-full bg-player-two-sage/20 border border-player-two-sage/40 flex items-center justify-center shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-player-two-sage" />
          <span className="absolute inset-0 rounded-full bg-player-two-sage/20 animate-ping" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-shared-amber font-semibold truncate font-mono">
            Sam&apos;s Pick: {selectedGameTitle}
          </span>
          <span className="text-[11px] text-on-surface-variant truncate">
            {partnerStatus}
          </span>
        </div>
      </div>
      <Link
        href="/play/lobby"
        className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-shared-amber text-surface-deep font-semibold text-xs font-mono tracking-wide active:scale-95 transition-all shadow-md hover:bg-[#e6a847]"
      >
        <DoorOpen className="w-4 h-4" />
        <span>Enter Lobby</span>
      </Link>
    </aside>
  );
};

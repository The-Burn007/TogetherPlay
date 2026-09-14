"use client";

import React from "react";
import { ShieldCheck, Heart, Radio, MapPin } from "lucide-react";

export interface HomeSecondaryInfoProps {
  daysTogether: number;
  distanceKm: number;
  encryptionSeal: string;
  isNewCouple?: boolean;
}

export const HomeSecondaryInfo: React.FC<HomeSecondaryInfoProps> = ({
  daysTogether,
  distanceKm,
  encryptionSeal,
  isNewCouple = false,
}) => {
  return (
    <footer className="pt-2 pb-6 border-t border-subtle-border/60 flex flex-col items-center gap-3 text-center">
      {/* Intimate Milestone Pill */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono text-on-surface-variant">
        <div className="flex items-center gap-1 text-player-two-sage">
          <Heart className="w-3.5 h-3.5 fill-current" />
          <span>{isNewCouple ? "Day 1 of your journey" : `Day ${daysTogether} together`}</span>
        </div>
        <span>·</span>
        <div className="flex items-center gap-1 text-on-surface">
          <MapPin className="w-3.5 h-3.5 text-shared-amber" />
          <span>{isNewCouple ? "Awaiting partner location" : `${distanceKm.toLocaleString()} km bridged`}</span>
        </div>
        <span>·</span>
        <div className="flex items-center gap-1 text-on-surface-variant">
          <Radio className="w-3.5 h-3.5 text-player-two-sage" />
          <span>Low-latency peer sync</span>
        </div>
      </div>

      {/* Sanctuary Privacy Guarantee */}
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-on-surface-variant/70">
        <ShieldCheck className="w-3.5 h-3.5 text-shared-amber/80" />
        <span>{encryptionSeal} · Zero public trackers</span>
      </div>
    </footer>
  );
};

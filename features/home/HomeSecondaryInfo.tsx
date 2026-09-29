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
    <footer className="pt-6 pb-12 border-t border-border/60 flex flex-col items-center gap-3 text-center select-none">
      {/* Intimate Relationship Milestone */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-soft-stone">
        <div className="flex items-center gap-1.5 text-warm-cream">
          <Heart className="w-3.5 h-3.5 text-player-one-ember fill-player-one-ember/20" />
          <span className="font-tabular font-medium">{isNewCouple ? "Day 1 of your journey" : `Day ${daysTogether} together`}</span>
        </div>
        <span className="text-soft-sage" aria-hidden="true">·</span>
        <div className="flex items-center gap-1.5 text-soft-stone">
          <MapPin className="w-3.5 h-3.5 text-soft-stone" />
          <span className="font-tabular">{isNewCouple ? "Awaiting partner location" : `${distanceKm.toLocaleString()} km bridged`}</span>
        </div>
        <span className="text-soft-sage" aria-hidden="true">·</span>
        <div className="flex items-center gap-1.5 text-soft-sage">
          <Radio className="w-3.5 h-3.5 text-soft-sage" />
          <span>Private sync</span>
        </div>
      </div>

      {/* Sanctuary Privacy Guarantee */}
      <div className="flex items-center gap-1.5 text-[11px] font-mono text-soft-sage">
        <ShieldCheck className="w-3.5 h-3.5 text-soft-stone" />
        <span>{encryptionSeal} · Private sanctuary for two</span>
      </div>
    </footer>
  );
};

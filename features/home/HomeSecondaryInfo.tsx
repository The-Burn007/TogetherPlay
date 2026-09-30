"use client";

import React from "react";
import { ShieldCheck, Heart, Radio, MapPin } from "lucide-react";

export interface HomeSecondaryInfoProps {
  daysTogether: number;
  distanceKm?: number;
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
    <footer className="pt-4 pb-8 border-t border-border flex flex-col items-center gap-3 text-center">
      {/* Quiet Telemetry Readout */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-soft-stone">
        <div className="flex items-center gap-1.5 text-warm-cream">
          <Heart className="w-3.5 h-3.5 text-soft-stone fill-soft-stone/20" />
          <span className="font-tabular font-medium">
            {isNewCouple ? "Day 1 of your journey" : `Day ${daysTogether} together`}
          </span>
        </div>

        {distanceKm !== undefined && distanceKm > 0 ? (
          <>
            <span className="text-soft-sage" aria-hidden="true">·</span>
            <div className="flex items-center gap-1.5 text-soft-stone">
              <MapPin className="w-3.5 h-3.5 text-soft-sage" />
              <span className="font-tabular">{`${distanceKm.toLocaleString()} km bridged`}</span>
            </div>
          </>
        ) : null}

        <span className="text-soft-sage" aria-hidden="true">·</span>
        <div className="flex items-center gap-1.5 text-soft-sage">
          <Radio className="w-3.5 h-3.5 text-soft-sage" />
          <span>Encrypted peer sync</span>
        </div>
      </div>

      {/* Sanctuary Privacy Guarantee */}
      <div className="flex items-center gap-1.5 text-[11px] font-mono text-soft-sage/80">
        <ShieldCheck className="w-3.5 h-3.5 text-soft-sage" />
        <span>{encryptionSeal} · Zero public trackers</span>
      </div>
    </footer>
  );
};

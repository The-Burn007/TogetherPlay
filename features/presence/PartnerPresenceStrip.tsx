"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { Smartphone } from "lucide-react";

export interface PartnerPresenceStripProps {
  partnerName?: string;
  partnerCity?: string;
  partnerTime?: string;
  statusText?: string;
}

export const PartnerPresenceStrip: React.FC<PartnerPresenceStripProps> = ({
  partnerName = "Sam",
  partnerCity = "Tokyo",
  partnerTime = "23:42",
  statusText = "Looking at the Game Lobby right now",
}) => {
  const { showToast } = useToast();
  const [isPinging, setIsPinging] = useState(false);

  const handlePing = () => {
    setIsPinging(true);
    showToast(`Heartbeat tap delivered to ${partnerName} in ${partnerCity}`);
    setTimeout(() => setIsPinging(false), 800);
  };

  return (
    <section className="w-full bg-surface-raised border border-subtle-border rounded-xl p-4 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-full bg-surface-container-high">
            <span className="w-3 h-3 rounded-full bg-player-two-sage animate-pulse" />
            <div className="absolute -inset-1 rounded-full bg-player-two-sage/10 pointer-events-none" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm text-on-surface font-semibold">
                {partnerName} is online
              </span>
              <Badge variant="sage" size="sm">
                {partnerCity} · {partnerTime}
              </Badge>
            </div>
            <span className="text-xs text-on-surface-variant">
              {statusText}
            </span>
          </div>
        </div>

        <button
          onClick={handlePing}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-overlay border border-accent-border text-shared-amber hover:bg-surface-container-highest transition-all active:scale-95 text-xs font-mono font-medium ${
            isPinging ? "scale-95 bg-shared-amber/20" : ""
          }`}
          aria-label="Send partner nudge ping"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="uppercase tracking-wider">Ping</span>
        </button>
      </div>
    </section>
  );
};

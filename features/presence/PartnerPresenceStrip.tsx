"use client";

import React, { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { Heart } from "lucide-react";
import { PresenceIndicator } from "@/components/ui/PresenceIndicator";
import { usePresence } from "@/lib/presence/usePresence";
import { type PresenceState, type ConnectionStatus } from "@/lib/presence/types";

export interface PartnerPresenceStripProps {
  partnerName?: string;
  partnerCity?: string;
  partnerTime?: string;
  statusText?: string;
  state?: PresenceState;
  connectionStatus?: ConnectionStatus;
  useLiveHook?: boolean;
}

export const PartnerPresenceStrip: React.FC<PartnerPresenceStripProps> = ({
  partnerName: propName,
  partnerCity: propCity,
  partnerTime: propTime = "23:42",
  statusText: propStatus,
  state: propState,
  connectionStatus: propConnection,
  useLiveHook = true,
}) => {
  const { showToast } = useToast();
  const livePresence = usePresence();
  const [isPinging, setIsPinging] = useState(false);

  const effectiveName = propName || (useLiveHook ? livePresence.partnerDisplayName : "Sam");
  const effectiveCity = propCity || (useLiveHook ? livePresence.partnerCity : "Tokyo");
  const effectiveState: PresenceState =
    propState || (useLiveHook ? livePresence.partnerState : "ONLINE");
  const effectiveConnection: ConnectionStatus =
    propConnection || (useLiveHook ? livePresence.partnerConnection : "online");

  const effectiveStatusText =
    propStatus ||
    (useLiveHook && livePresence.partnerActivity
      ? livePresence.partnerActivity
      : effectiveState === "IN_GAME"
      ? "Playing a game in sanctuary"
      : effectiveState === "IN_CALL"
      ? "Live voice call active"
      : effectiveState === "AWAY"
      ? "Away from screen"
      : effectiveState === "OFFLINE"
      ? "Last active earlier today"
      : "Browsing the collection with you right now");

  const handlePing = () => {
    setIsPinging(true);
    livePresence.sendHeartbeatNudge();
    showToast({
      message: `Heartbeat tap delivered to ${effectiveName} in ${effectiveCity}`,
      variant: "nudge",
    });
    setTimeout(() => setIsPinging(false), 800);
  };

  return (
    <section className="w-full bg-surface border border-border/80 rounded-2xl p-4 shadow-elevation-sm transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-surface-charcoal border border-border shrink-0">
            <PresenceIndicator state={effectiveState} connectionStatus={effectiveConnection} size="md" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-semibold text-warm-cream truncate">
                {effectiveName}
              </span>
              <span className="text-soft-sage font-mono" aria-hidden="true">·</span>
              <span className="text-soft-stone font-mono">
                {effectiveCity}
              </span>
              <span className="text-soft-sage font-mono" aria-hidden="true">·</span>
              <span className={`font-mono font-medium ${effectiveState === "ONLINE" ? "text-brand" : "text-soft-sage"}`}>
                {effectiveConnection === "reconnecting" ? "Reconnecting" : effectiveState.toLowerCase()}
              </span>
            </div>
            <span className="text-xs text-soft-sage truncate mt-0.5">
              {effectiveStatusText}
            </span>
          </div>
        </div>

        <button
          onClick={handlePing}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-secondary hover:bg-surface-interactive border border-border text-warm-cream hover:border-border-strong transition-all active:scale-95 text-xs font-mono font-medium shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-brand ${
            isPinging ? "scale-95 border-brand bg-brand/10 shadow-mint-glow text-brand" : ""
          }`}
          aria-label={`Send partner nudge to ${effectiveName}`}
        >
          <Heart className="w-3.5 h-3.5 text-player-one-ember fill-player-one-ember/20" />
          <span className="hidden sm:inline">Tap Pulse</span>
        </button>
      </div>
    </section>
  );
};

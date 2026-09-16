"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { Smartphone, Gamepad2, PhoneCall, Moon, WifiOff } from "lucide-react";
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
      ? "Playing a game together"
      : effectiveState === "IN_CALL"
      ? "In couple audio/video call"
      : effectiveState === "AWAY"
      ? "Resting away from screen"
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

  const getBadgeVariant = () => {
    if (effectiveConnection === "reconnecting") return "amber";
    switch (effectiveState) {
      case "ONLINE":
        return "sage";
      case "IN_GAME":
        return "amber";
      case "IN_CALL":
        return "ember";
      case "AWAY":
      case "OFFLINE":
      default:
        return "neutral";
    }
  };

  const getStateTitle = () => {
    if (effectiveConnection === "reconnecting") return `${effectiveName} is reconnecting`;
    switch (effectiveState) {
      case "ONLINE":
        return `${effectiveName} is online`;
      case "IN_GAME":
        return `${effectiveName} is playing`;
      case "IN_CALL":
        return `${effectiveName} is in call`;
      case "AWAY":
        return `${effectiveName} is away`;
      case "OFFLINE":
      default:
        return `${effectiveName} is offline`;
    }
  };

  return (
    <section className="w-full bg-surface-raised border border-subtle-border rounded-xl p-4 shadow-sm transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-full bg-surface-deep border border-subtle-border shrink-0">
            <PresenceIndicator
              state={effectiveState}
              connectionStatus={effectiveConnection}
              size="md"
            />
            {effectiveState === "IN_GAME" && (
              <Gamepad2 className="absolute -bottom-1 -right-1 w-3.5 h-3.5 text-shared-amber bg-surface-deep rounded-full p-0.5 border border-subtle-border" />
            )}
            {effectiveState === "IN_CALL" && (
              <PhoneCall className="absolute -bottom-1 -right-1 w-3.5 h-3.5 text-player-one-ember bg-surface-deep rounded-full p-0.5 border border-subtle-border" />
            )}
            {effectiveState === "AWAY" && (
              <Moon className="absolute -bottom-1 -right-1 w-3.5 h-3.5 text-amber-400 bg-surface-deep rounded-full p-0.5 border border-subtle-border" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-on-surface font-semibold truncate">
                {getStateTitle()}
              </span>
              <Badge variant={getBadgeVariant()} size="sm">
                {effectiveCity} · {propTime}
              </Badge>
              {effectiveConnection === "reconnecting" && (
                <span className="text-[10px] font-mono text-shared-amber bg-shared-amber/10 px-1.5 py-0.5 rounded">
                  Reconnecting...
                </span>
              )}
            </div>
            <span className="text-xs text-on-surface-variant truncate">
              {effectiveStatusText}
            </span>
          </div>
        </div>

        <button
          onClick={handlePing}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-overlay border border-subtle-border text-shared-amber hover:bg-surface-deep transition-all active:scale-95 text-xs font-mono font-medium shrink-0 cursor-pointer ${
            isPinging ? "scale-95 bg-shared-amber/20" : ""
          }`}
          aria-label={`Send partner nudge to ${effectiveName}`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="uppercase tracking-wider">Ping</span>
        </button>
      </div>
    </section>
  );
};

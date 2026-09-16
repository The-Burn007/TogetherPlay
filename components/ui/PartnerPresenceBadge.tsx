"use client";

import React, { useState } from "react";
import { Heart, Smartphone, Gamepad2, PhoneCall, Moon, WifiOff, RefreshCw } from "lucide-react";
import { PresenceIndicator } from "./PresenceIndicator";
import { useToast } from "@/components/ui/Toast";
import { type PresenceState, type ConnectionStatus } from "@/lib/presence/types";

export interface PartnerPresenceBadgeProps {
  partnerName?: string;
  partnerCity?: string;
  state?: PresenceState;
  connectionStatus?: ConnectionStatus;
  activity?: string;
  variant?: "pill" | "card" | "compact" | "banner";
  onNudge?: () => void;
  className?: string;
}

export const PartnerPresenceBadge: React.FC<PartnerPresenceBadgeProps> = ({
  partnerName = "Sam",
  partnerCity = "Tokyo",
  state = "ONLINE",
  connectionStatus = "online",
  activity,
  variant = "pill",
  onNudge,
  className = "",
}) => {
  const { showToast } = useToast();
  const [isNudging, setIsNudging] = useState(false);

  const handleNudge = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsNudging(true);
    if (onNudge) {
      onNudge();
    } else {
      showToast({
        message: `Heartbeat resonance delivered to ${partnerName} in ${partnerCity}`,
        variant: "nudge",
      });
    }
    setTimeout(() => setIsNudging(false), 800);
  };

  const getStateDescription = () => {
    if (connectionStatus === "reconnecting") return "Reconnecting...";
    if (connectionStatus === "offline" || state === "OFFLINE") return "Offline";
    if (activity) return activity;
    switch (state) {
      case "IN_GAME":
        return "Playing a game";
      case "IN_CALL":
        return "In sanctuary video call";
      case "AWAY":
        return "Away from screen";
      case "ONLINE":
      default:
        return "Online in sanctuary";
    }
  };

  // 1. Compact Variant (For headers, bars, and dense rows)
  if (variant === "compact") {
    return (
      <button
        onClick={handleNudge}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-raised hover:bg-surface-overlay border border-subtle-border hover:border-border-sage/40 transition-all text-xs select-none cursor-pointer ${
          isNudging ? "scale-95 border-shared-amber" : ""
        } ${className}`}
        title={`${partnerName} is ${getStateDescription()} in ${partnerCity} · Click to nudge`}
        aria-label={`${partnerName} presence: ${state}`}
      >
        <PresenceIndicator state={state} connectionStatus={connectionStatus} size="sm" />
        <span className="text-[11px] font-medium text-on-surface">
          {partnerName}
        </span>
        <span className="text-[10px] text-on-surface-variant font-mono hidden sm:inline">
          · {connectionStatus === "reconnecting" ? "Reconnecting" : state.toLowerCase()}
        </span>
        <Heart className="w-3 h-3 text-player-one-ember/70 fill-player-one-ember/20 hover:fill-player-one-ember ml-0.5" />
      </button>
    );
  }

  // 2. Banner Variant (e.g., for Game Library top strip or Room Header)
  if (variant === "banner") {
    return (
      <section
        className={`w-full bg-surface-raised border border-subtle-border rounded-xl p-4 shadow-sm transition-all ${className}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-surface-deep border border-subtle-border shrink-0">
              <PresenceIndicator state={state} connectionStatus={connectionStatus} size="md" />
              {state === "IN_GAME" && (
                <Gamepad2 className="absolute -bottom-1 -right-1 w-3.5 h-3.5 text-shared-amber bg-surface-deep rounded-full p-0.5 border border-subtle-border" />
              )}
              {state === "IN_CALL" && (
                <PhoneCall className="absolute -bottom-1 -right-1 w-3.5 h-3.5 text-player-one-ember bg-surface-deep rounded-full p-0.5 border border-subtle-border" />
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-on-surface font-semibold truncate">
                  {partnerName}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-deep border border-subtle-border text-on-surface-variant">
                  {partnerCity}
                  <span className="opacity-40">·</span>
                  <span
                    className={
                      state === "ONLINE"
                        ? "text-player-two-sage font-medium"
                        : state === "IN_GAME"
                        ? "text-shared-amber font-medium"
                        : state === "IN_CALL"
                        ? "text-player-one-ember font-medium"
                        : "text-on-surface-variant"
                    }
                  >
                    {connectionStatus === "reconnecting" ? "Reconnecting..." : state}
                  </span>
                </span>
              </div>
              <span className="text-xs text-on-surface-variant truncate">
                {getStateDescription()}
              </span>
            </div>
          </div>

          <button
            onClick={handleNudge}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-overlay border border-subtle-border text-shared-amber hover:bg-surface-deep transition-all active:scale-95 text-xs font-mono font-medium shrink-0 cursor-pointer ${
              isNudging ? "scale-95 bg-shared-amber/20" : ""
            }`}
            aria-label={`Send partner nudge to ${partnerName}`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="uppercase tracking-wider">Ping</span>
          </button>
        </div>
      </section>
    );
  }

  // 3. Card Variant (e.g., for Profile or Lobby)
  if (variant === "card") {
    return (
      <div
        className={`p-4 rounded-xl bg-surface-deep border border-subtle-border flex items-center justify-between gap-3 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <PresenceIndicator state={state} connectionStatus={connectionStatus} size="lg" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-on-surface">{partnerName}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-raised border border-subtle-border text-on-surface-variant">
                {partnerCity}
              </span>
            </div>
            <span className="text-xs text-on-surface-variant">{getStateDescription()}</span>
          </div>
        </div>

        <button
          onClick={handleNudge}
          className="p-2 rounded-lg bg-surface-raised hover:bg-surface-overlay border border-subtle-border text-player-one-ember transition-all cursor-pointer"
          title={`Send nudge to ${partnerName}`}
        >
          <Heart className="w-4 h-4 fill-current" />
        </button>
      </div>
    );
  }

  // Default: Pill Variant
  return (
    <div
      onClick={handleNudge}
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-raised border border-subtle-border hover:border-border-sage/40 transition-all text-xs cursor-pointer ${
        isNudging ? "border-shared-amber" : ""
      } ${className}`}
    >
      <PresenceIndicator state={state} connectionStatus={connectionStatus} size="xs" />
      <span className="text-on-surface font-medium">{partnerName}</span>
      <span className="text-on-surface-variant font-mono text-[10px]">
        {connectionStatus === "reconnecting" ? "Reconnecting" : state.toLowerCase()}
      </span>
      <Heart className="w-3 h-3 text-player-one-ember fill-player-one-ember/40 ml-0.5" />
    </div>
  );
};

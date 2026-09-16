"use client";

import React from "react";
import { type PresenceState, type ConnectionStatus } from "@/lib/presence/types";
import { Gamepad2, PhoneCall, Moon, WifiOff, RefreshCw } from "lucide-react";

export interface PresenceIndicatorProps {
  state?: PresenceState | string;
  connectionStatus?: ConnectionStatus;
  size?: "xs" | "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
  label?: string;
  subLabel?: string;
  colorRole?: "ember" | "sage" | "amber";
  latencyMs?: number;
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  state = "ONLINE",
  connectionStatus = "online",
  size = "sm",
  showLabel = false,
  className = "",
  label,
  subLabel,
  colorRole,
  latencyMs,
}) => {
  const normalizedState = (state || "ONLINE").toUpperCase();

  // If connection is reconnecting, highlight reconnecting status
  const isReconnecting = connectionStatus === "reconnecting";
  const isDisconnected = connectionStatus === "offline" || normalizedState === "OFFLINE";

  const sizeDimensions = {
    xs: "w-2 h-2",
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  }[size];

  const getStatusColor = () => {
    if (isReconnecting) return "bg-shared-amber";
    if (isDisconnected) return "bg-neutral-500";
    if (colorRole === "sage") return "bg-player-two-sage";
    if (colorRole === "ember") return "bg-player-one-ember";
    if (colorRole === "amber") return "bg-shared-amber";

    switch (normalizedState) {
      case "ONLINE":
        return "bg-player-two-sage";
      case "IN_GAME":
        return "bg-shared-amber";
      case "IN_CALL":
        return "bg-player-one-ember";
      case "AWAY":
        return "bg-amber-400/80";
      case "OFFLINE":
      default:
        return "bg-neutral-500";
    }
  };

  const getPingColor = () => {
    if (isReconnecting) return "bg-shared-amber";
    if (colorRole === "sage") return "bg-player-two-sage";
    if (colorRole === "ember") return "bg-player-one-ember";
    if (colorRole === "amber") return "bg-shared-amber";

    switch (normalizedState) {
      case "ONLINE":
        return "bg-player-two-sage";
      case "IN_GAME":
        return "bg-shared-amber";
      case "IN_CALL":
        return "bg-player-one-ember";
      case "AWAY":
        return "bg-amber-400/50";
      default:
        return "bg-transparent";
    }
  };

  const getLabel = () => {
    if (label) return label;
    if (isReconnecting) return "Reconnecting...";
    if (connectionStatus === "unknown") return "Unknown";
    switch (normalizedState) {
      case "ONLINE":
        return "Online";
      case "IN_GAME":
        return "In Game";
      case "IN_CALL":
        return "In Call";
      case "AWAY":
        return "Away";
      case "OFFLINE":
      default:
        return "Offline";
    }
  };

  const statusColor = getStatusColor();
  const pingColor = getPingColor();
  const shouldAnimate = !isDisconnected && normalizedState !== "OFFLINE";

  const displayLabel = label || (showLabel ? getLabel() : null);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`relative flex ${sizeDimensions} shrink-0`}>
        {/* Subtle Breathing Ping for active states */}
        {shouldAnimate && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-65 ${pingColor}`}
          />
        )}
        {/* Main Indicator Dot */}
        <span
          className={`relative inline-flex rounded-full ${sizeDimensions} ${statusColor} transition-colors duration-500 shadow-sm`}
        />
        {/* Sub-glyph if reconnecting */}
        {isReconnecting && (
          <RefreshCw className="absolute -top-1 -right-1 w-2.5 h-2.5 text-shared-amber animate-spin" />
        )}
      </span>

      {displayLabel && (
        <div className="flex flex-col text-left">
          <span className="text-[11px] font-medium tracking-tight text-on-surface leading-tight">
            {displayLabel}
          </span>
          {(subLabel || latencyMs !== undefined) && (
            <span className="text-[10px] font-mono text-on-surface-variant leading-tight">
              {subLabel}
              {subLabel && latencyMs !== undefined ? " · " : ""}
              {latencyMs !== undefined ? `${latencyMs}ms` : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import type { PlayerColor } from "@/types/domain";

export type PresenceState = "online" | "in_game" | "in_call" | "idle" | "offline";

export interface PresenceIndicatorProps {
  state?: PresenceState;
  colorRole?: PlayerColor | "amber";
  size?: "sm" | "md" | "lg";
  label?: string;
  subLabel?: string;
  latencyMs?: number;
  className?: string;
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  state = "online",
  colorRole = "sage",
  size = "md",
  label,
  subLabel,
  latencyMs,
  className,
}) => {
  const colorMap = {
    ember: {
      dot: "bg-player-one-ember",
      ring: "border-player-one-ember/40",
      glow: "bg-player-one-ember/20",
    },
    sage: {
      dot: "bg-player-two-sage",
      ring: "border-player-two-sage/40",
      glow: "bg-player-two-sage/20",
    },
    amber: {
      dot: "bg-shared-amber",
      ring: "border-shared-amber/40",
      glow: "bg-shared-amber/20",
    },
  }[colorRole];

  const dotSizes = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  }[size];

  const isLive = state === "online" || state === "in_game" || state === "in_call";

  return (
    <div className={cn("inline-flex items-center gap-2 select-none", className)}>
      <div className="relative flex items-center justify-center">
        {isLive ? (
          <motion.span
            animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className={cn("absolute inset-0 rounded-full", colorMap.glow)}
          />
        ) : null}

        <span
          className={cn(
            "rounded-full transition-colors",
            dotSizes,
            state === "offline" ? "bg-on-surface-subtle" : colorMap.dot
          )}
        />
      </div>

      {label ? (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="text-xs font-semibold text-on-surface truncate">
              {label}
            </span>
            {latencyMs !== undefined ? (
              <span className="text-[10px] font-mono text-on-surface-variant">
                · {latencyMs}ms
              </span>
            ) : null}
          </div>
          {subLabel ? (
            <span className="text-[10px] font-mono text-on-surface-variant truncate mt-0.5">
              {subLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

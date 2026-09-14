"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import type { PlayerColor } from "@/types/domain";

export interface PlayerBadgeProps {
  name: string;
  colorRole: PlayerColor | "amber";
  roleLabel?: string;
  isCurrentTurn?: boolean;
  score?: number;
  className?: string;
}

export const PlayerBadge: React.FC<PlayerBadgeProps> = ({
  name,
  colorRole,
  roleLabel,
  isCurrentTurn = false,
  score,
  className,
}) => {
  const styles = {
    ember: {
      bg: "bg-player-one-ember/15 border-player-one-ember/35 text-player-one-ember-text",
      dot: "bg-player-one-ember",
      glow: "shadow-[0_0_12px_rgba(224,86,56,0.35)]",
    },
    sage: {
      bg: "bg-player-two-sage/15 border-player-two-sage/35 text-player-two-sage-text",
      dot: "bg-player-two-sage",
      glow: "shadow-[0_0_12px_rgba(78,124,105,0.35)]",
    },
    amber: {
      bg: "bg-shared-amber/15 border-shared-amber/35 text-shared-amber-text",
      dot: "bg-shared-amber",
      glow: "shadow-[0_0_12px_rgba(217,155,56,0.35)]",
    },
  }[colorRole];

  return (
    <motion.div
      animate={isCurrentTurn ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      className={cn(
        "inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-mono select-none",
        styles.bg,
        isCurrentTurn ? styles.glow : "",
        className
      )}
    >
      <span className={cn("w-2 h-2 rounded-full shrink-0", styles.dot)} />

      <span className="font-semibold text-on-surface">{name}</span>

      {roleLabel ? (
        <span className="text-[10px] uppercase tracking-wider opacity-80">
          · {roleLabel}
        </span>
      ) : null}

      {score !== undefined ? (
        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-deep/80 text-on-surface border border-subtle-border">
          {score}
        </span>
      ) : null}
    </motion.div>
  );
};

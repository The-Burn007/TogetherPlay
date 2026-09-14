"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  label = "Connecting shared space...",
  className,
}) => {
  const sizeMap = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-16 h-16",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3.5 p-6 select-none", className)}>
      <div className={cn("relative flex items-center justify-center", sizeMap[size])}>
        {/* Ember Ring (Player 1) */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border-2 border-player-one-ember/30 border-t-player-one-ember"
        />

        {/* Sage Ring (Player 2) */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-1.5 rounded-full border-2 border-player-two-sage/30 border-b-player-two-sage"
        />

        {/* Amber Shared Core (Resonance) */}
        <motion.div
          animate={{ scale: [0.8, 1.3, 0.8], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="w-2 h-2 rounded-full bg-shared-amber shadow-[0_0_10px_rgba(217,155,56,0.6)]"
        />
      </div>

      {label ? (
        <span className="text-[11px] tracking-widest uppercase font-mono text-on-surface-variant animate-pulse">
          {label}
        </span>
      ) : null}
    </div>
  );
};

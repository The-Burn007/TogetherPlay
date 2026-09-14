"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

export interface TimerProps {
  remainingSeconds: number;
  totalSeconds?: number;
  size?: "sm" | "md" | "lg";
  label?: string;
  isUrgentThreshold?: number;
  className?: string;
}

export const Timer: React.FC<TimerProps> = ({
  remainingSeconds,
  totalSeconds = 60,
  size = "md",
  label = "REMAIN",
  isUrgentThreshold = 10,
  className,
}) => {
  const isUrgent = remainingSeconds <= isUrgentThreshold;

  const sizeMap = {
    sm: { dimension: 48, radius: 18, stroke: 2.5, text: "text-xs", label: "text-[8px]" },
    md: { dimension: 64, radius: 26, stroke: 3, text: "text-sm", label: "text-[9px]" },
    lg: { dimension: 80, radius: 34, stroke: 3.5, text: "text-base", label: "text-[10px]" },
  }[size];

  const circumference = 2 * Math.PI * sizeMap.radius;
  const progress = Math.max(0, Math.min(1, remainingSeconds / totalSeconds));
  const strokeDashoffset = circumference - progress * circumference;

  const mins = Math.floor(remainingSeconds / 60);
  const secs = Math.floor(remainingSeconds % 60);
  const formatted = `${mins > 0 ? `${mins}:` : ""}${secs.toString().padStart(2, "0")}`;

  return (
    <div className={cn("relative inline-flex items-center justify-center select-none", className)}>
      <svg
        width={sizeMap.dimension}
        height={sizeMap.dimension}
        className="transform -rotate-90"
      >
        {/* Track */}
        <circle
          cx={sizeMap.dimension / 2}
          cy={sizeMap.dimension / 2}
          r={sizeMap.radius}
          fill="transparent"
          stroke="rgba(251, 249, 245, 0.08)"
          strokeWidth={sizeMap.stroke}
        />
        {/* Kinetic Progress */}
        <motion.circle
          cx={sizeMap.dimension / 2}
          cy={sizeMap.dimension / 2}
          r={sizeMap.radius}
          fill="transparent"
          stroke={isUrgent ? "var(--color-player-one-ember)" : "var(--color-shared-amber)"}
          strokeWidth={sizeMap.stroke + 0.5}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transition={{ duration: 0.3, ease: "easeInOut" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "font-mono font-bold tabular-nums leading-none tracking-tight",
            sizeMap.text,
            isUrgent ? "text-player-one-ember animate-pulse" : "text-shared-amber"
          )}
        >
          {formatted}
        </span>
        {label ? (
          <span
            className={cn(
              "font-mono tracking-wider uppercase text-on-surface-subtle leading-none mt-0.5",
              sizeMap.label
            )}
          >
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
};

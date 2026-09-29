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
        {/* Primary Sanctuary Outer Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border-2 border-brand/20 border-t-brand"
        />

        {/* Secondary Inner Ring */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-1.5 rounded-full border-2 border-border-strong border-b-brand/70"
        />

        {/* Acid Mint Shared Core */}
        <motion.div
          animate={{ scale: [0.8, 1.25, 0.8], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="w-2 h-2 rounded-full bg-brand shadow-mint-glow"
        />
      </div>

      {label ? (
        <span className="text-[11px] tracking-widest uppercase font-mono text-text-muted animate-pulse">
          {label}
        </span>
      ) : null}
    </div>
  );
};

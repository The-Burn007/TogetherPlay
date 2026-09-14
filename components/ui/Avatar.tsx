"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import type { PlayerColor } from "@/types/domain";

export interface AvatarProps {
  name: string;
  colorRole?: PlayerColor;
  imageUrl?: string;
  size?: "sm" | "md" | "lg" | "xl";
  isOnline?: boolean;
  city?: string;
  time?: string;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  colorRole = "ember",
  imageUrl,
  size = "md",
  isOnline = true,
  city,
  time,
  className,
}) => {
  const sizeMap = {
    sm: "w-8 h-8 text-xs",
    md: "w-11 h-11 text-sm",
    lg: "w-14 h-14 text-base",
    xl: "w-16 h-16 text-lg",
  };

  const initial = name.charAt(0).toUpperCase();

  const borderColor =
    colorRole === "ember"
      ? "border-player-one-ember/60"
      : "border-player-two-sage/60";
  const statusColor =
    colorRole === "ember" ? "bg-player-one-ember" : "bg-player-two-sage";

  return (
    <div className={cn("inline-flex flex-col items-center gap-1", className)}>
      <div className="relative inline-block shrink-0">
        <div
          className={cn(
            "rounded-full overflow-hidden flex items-center justify-center font-bold font-mono border-2 shadow-md bg-surface-container-high transition-transform",
            sizeMap[size],
            borderColor
          )}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-on-surface">{initial}</span>
          )}
        </div>
        {isOnline ? (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-deep shadow-sm",
              statusColor
            )}
          >
            <motion.span
              animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className={cn("absolute inset-0 rounded-full", statusColor)}
            />
          </span>
        ) : null}
      </div>

      {city || time ? (
        <div className="flex flex-col items-center text-center leading-tight">
          <span className="text-xs font-semibold text-on-surface">{name}</span>
          <span className="text-[10px] font-mono text-on-surface-variant">
            {[city, time].filter(Boolean).join(" · ")}
          </span>
        </div>
      ) : null}
    </div>
  );
};

export const DualPartnerPill: React.FC<{
  partnerOneName?: string;
  partnerTwoName?: string;
  locationLabel?: string;
  className?: string;
}> = ({
  partnerOneName = "Alex",
  partnerTwoName = "Sam",
  locationLabel = "London & Tokyo",
  className,
}) => {
  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-raised border border-subtle-border shadow-sm">
        <span className="w-2 h-2 rounded-full bg-player-one-ember shrink-0" />
        <span className="w-4 h-[1.5px] bg-shared-amber/60 relative overflow-hidden rounded-full">
          <motion.span
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-shared-amber"
          />
        </span>
        <span className="w-2 h-2 rounded-full bg-player-two-sage shrink-0" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="font-semibold text-xs text-on-surface truncate">
          {partnerOneName} &amp; {partnerTwoName}
        </span>
        <span className="text-[10px] font-mono text-on-surface-variant tracking-wider uppercase truncate">
          Synced · {locationLabel}
        </span>
      </div>
    </div>
  );
};

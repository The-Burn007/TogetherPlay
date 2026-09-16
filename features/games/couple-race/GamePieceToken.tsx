"use client";

import React from "react";
import { motion } from "motion/react";
import { Shield, Sparkles, Navigation, Compass } from "lucide-react";
import { PLAYER_METAS } from "./types";
import type { CoupleRacePlayerState } from "@/types/domain";

interface GamePieceTokenProps {
  playerId: string;
  playerState?: CoupleRacePlayerState;
  isCurrentTurn: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const GamePieceToken: React.FC<GamePieceTokenProps> = ({
  playerId,
  playerState,
  isCurrentTurn,
  size = "md",
  className = "",
}) => {
  const meta = PLAYER_METAS[playerId] || {
    id: playerId,
    name: playerId === "user_sam" ? "Sam" : "Alex",
    city: playerId === "user_sam" ? "Tokyo" : "London",
    roleTitle: "Navigator",
    pieceName: "Carved Token",
    pieceTheme: {
      primary: playerId === "user_sam" ? "#059669" : "#d97706",
      secondary: playerId === "user_sam" ? "#d1fae5" : "#fef3c7",
      glow: playerId === "user_sam" ? "rgba(16, 185, 129, 0.4)" : "rgba(245, 158, 11, 0.4)",
      ring: playerId === "user_sam" ? "border-emerald-400" : "border-amber-400",
      border: playerId === "user_sam" ? "#047857" : "#b45309",
    },
  };

  const isAlex = playerId === "user_alex";
  const sizeClasses = {
    sm: "w-7 h-7 text-[10px]",
    md: "w-9 h-9 text-xs",
    lg: "w-12 h-12 text-sm",
  }[size];

  const laps = playerState?.lapsCompleted ?? 0;
  const isShielded = Boolean(playerState?.shieldActive);
  const isDisconnected = playerState?.connectionStatus === "disconnected";

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      {/* Tabletop contact cast shadow */}
      <div
        className="absolute -bottom-1.5 w-4/5 h-2 rounded-full bg-black/60 blur-[3px] pointer-events-none"
        style={{ transform: "scaleY(0.6)" }}
      />

      {/* Active turn pulse ring */}
      {isCurrentTurn && (
        <motion.div
          animate={{ scale: [1, 1.22, 1], opacity: [0.6, 0.15, 0.6] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-[-4px] rounded-full pointer-events-none"
          style={{
            border: `2px solid ${meta.pieceTheme.primary}`,
            boxShadow: `0 0 12px ${meta.pieceTheme.glow}`,
          }}
        />
      )}

      {/* Shield of Harmony Aura */}
      {isShielded && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[-6px] rounded-full border border-sky-400/60 border-dashed pointer-events-none"
        />
      )}

      {/* 3D Physical Token Cylinder Body */}
      <div
        className={`relative ${sizeClasses} rounded-full flex items-center justify-center font-serif font-bold transition-transform duration-300 ${
          isDisconnected ? "opacity-40 grayscale" : ""
        }`}
        style={{
          background: isAlex
            ? "radial-gradient(circle at 35% 30%, #fef3c7 0%, #d97706 55%, #78350f 100%)"
            : "radial-gradient(circle at 35% 30%, #d1fae5 0%, #059669 55%, #064e3b 100%)",
          boxShadow: `
            inset 0 1px 1px rgba(255,255,255,0.7),
            inset 0 -2px 3px rgba(0,0,0,0.6),
            0 4px 8px rgba(0,0,0,0.5)
          `,
          border: `1.5px solid ${isAlex ? "#b45309" : "#047857"}`,
        }}
      >
        {/* Token Inscribed Emblem */}
        <div className="text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] flex items-center justify-center">
          {isAlex ? (
            <Compass className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
          ) : (
            <Navigation className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
          )}
        </div>

        {/* Lap Marker Badge */}
        {laps > 0 && (
          <div
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-stone-900 border border-amber-300/80 text-amber-200 text-[9px] font-mono flex items-center justify-center font-semibold shadow-sm"
            title={`Completed Laps: ${laps}`}
          >
            {laps}
          </div>
        )}

        {/* Shield Icon Badge */}
        {isShielded && (
          <div
            className="absolute -bottom-1 -left-1 w-3.5 h-3.5 rounded-full bg-sky-900 border border-sky-300 text-sky-200 flex items-center justify-center"
            title="Shield Active"
          >
            <Shield className="w-2 h-2" />
          </div>
        )}
      </div>

      {/* Disconnect indicator */}
      {isDisconnected && (
        <span className="absolute -top-2 text-[9px] bg-red-950 text-red-300 px-1 rounded border border-red-800 font-mono">
          offline
        </span>
      )}
    </div>
  );
};

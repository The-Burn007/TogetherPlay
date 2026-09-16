"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Zap, AlertTriangle, CheckCircle2, Lock, Flame } from "lucide-react";
import type { SpeedDuelStage } from "@/types/domain";

interface SpeedDuelCentralTargetProps {
  stage: SpeedDuelStage;
  targetActive: boolean;
  roundWinnerId: string | null;
  roundWinnerReactionMs?: number | null;
  winnerPlayerName?: string | null;
  isFalseStart?: boolean;
  falseStartPlayerName?: string | null;
  activePlayerId: string;
  hasReacted: boolean;
  onTargetClick: () => void;
  disabled?: boolean;
}

export const SpeedDuelCentralTarget: React.FC<SpeedDuelCentralTargetProps> = ({
  stage,
  targetActive,
  roundWinnerId,
  roundWinnerReactionMs,
  winnerPlayerName,
  isFalseStart,
  falseStartPlayerName,
  activePlayerId,
  hasReacted,
  onTargetClick,
  disabled = false,
}) => {
  const isWinner = roundWinnerId === activePlayerId;
  const isOpponentWinner = roundWinnerId && roundWinnerId !== activePlayerId;

  // Determine appearance theme based on authoritative reaction state
  let ringBorderClass = "border-neutral-800";
  let centerGlowClass = "bg-neutral-900/50 text-neutral-400";
  let stateLabel = "WAITING";
  let stateSubLabel = "Ready for synchrony";

  if (stage === "ready") {
    ringBorderClass = "border-neutral-800 hover:border-neutral-700";
    centerGlowClass = "bg-neutral-900/60 text-neutral-300";
    stateLabel = "ARMED";
    stateSubLabel = "Waiting for match launch";
  } else if (stage === "countdown") {
    ringBorderClass = "border-amber-600/70 shadow-[0_0_30px_rgba(217,119,6,0.2)]";
    centerGlowClass = "bg-amber-950/30 text-amber-300";
    stateLabel = "PREPARE";
    stateSubLabel = "Hold your finger steady";
  } else if (stage === "tension") {
    ringBorderClass = "border-amber-500/50 shadow-[0_0_40px_rgba(245,158,11,0.25)]";
    centerGlowClass = "bg-[#141210] text-amber-400";
    stateLabel = "HOLD";
    stateSubLabel = "Do not strike early";
  } else if (stage === "active" || targetActive) {
    ringBorderClass = "border-amber-400 shadow-[0_0_60px_rgba(251,191,36,0.6)] animate-pulse";
    centerGlowClass = "bg-amber-500 text-neutral-950 font-black cursor-pointer shadow-2xl";
    stateLabel = "STRIKE NOW!";
    stateSubLabel = "First valid touch wins";
  } else if (stage === "round_result" || stage === "game_end") {
    if (isFalseStart) {
      ringBorderClass = "border-rose-600 shadow-[0_0_40px_rgba(225,29,72,0.3)]";
      centerGlowClass = "bg-rose-950/50 text-rose-300";
      stateLabel = "FALSE START";
      stateSubLabel = `${falseStartPlayerName || "A partner"} struck early`;
    } else if (isWinner) {
      ringBorderClass = "border-amber-400 shadow-[0_0_60px_rgba(245,158,11,0.5)]";
      centerGlowClass = "bg-amber-950/60 text-amber-300";
      stateLabel = "ROUND CLAIMED";
      stateSubLabel = `${roundWinnerReactionMs || 0}ms · Server verified`;
    } else if (isOpponentWinner) {
      ringBorderClass = "border-emerald-600/70 shadow-[0_0_40px_rgba(16,185,129,0.2)]";
      centerGlowClass = "bg-emerald-950/40 text-emerald-300";
      stateLabel = `${winnerPlayerName || "Opponent"} Won`;
      stateSubLabel = `${roundWinnerReactionMs || 0}ms · Next round imminent`;
    }
  }

  const isClickable = !disabled && (stage === "tension" || stage === "active" || targetActive);

  return (
    <div
      id="speed-duel-target-container"
      className="relative flex flex-col items-center justify-center select-none py-6"
    >
      {/* Subtle outer tension resonance waves (active during tension and trigger) */}
      <AnimatePresence>
        {stage === "tension" && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0.2 }}
            animate={{
              scale: [1, 1.08, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute w-72 h-72 sm:w-88 sm:h-88 rounded-full border border-amber-500/30 pointer-events-none"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(stage === "active" || targetActive) && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{
              scale: [1, 1.25, 1.1],
              opacity: [0.8, 0, 0.4],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              ease: "easeOut",
            }}
            className="absolute w-80 h-80 sm:w-96 sm:h-96 rounded-full border-2 border-amber-400/80 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Main Central Target Circle */}
      <motion.button
        id="speed-duel-main-target-btn"
        type="button"
        disabled={!isClickable}
        onClick={onTargetClick}
        whileHover={isClickable ? { scale: 1.02 } : {}}
        whileTap={isClickable ? { scale: 0.96 } : {}}
        className={`relative w-64 h-64 sm:w-80 sm:h-80 rounded-full border-2 sm:border-4 flex flex-col items-center justify-center p-6 transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-amber-500/40 ${ringBorderClass} ${centerGlowClass} ${
          isClickable ? "cursor-pointer active:scale-95" : "cursor-default"
        }`}
      >
        {/* Subtle geometric crosshairs & meridian markers */}
        <div className="absolute inset-0 rounded-full pointer-events-none flex items-center justify-center">
          <div className="absolute w-full h-[1px] bg-neutral-700/20" />
          <div className="absolute h-full w-[1px] bg-neutral-700/20" />
          <div className="w-52 h-52 sm:w-64 sm:h-64 rounded-full border border-neutral-700/30" />
          <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full border border-neutral-700/20" />
        </div>

        {/* Central Core Icon / Graphic */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-2">
          {stage === "tension" && (
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center"
            >
              <Lock className="w-6 h-6 animate-pulse" />
            </motion.div>
          )}

          {(stage === "active" || targetActive) && (
            <motion.div
              initial={{ scale: 0.5, rotate: -45 }}
              animate={{ scale: 1.15, rotate: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className="w-16 h-16 rounded-full bg-neutral-950 text-amber-400 flex items-center justify-center shadow-lg"
            >
              <Zap className="w-9 h-9 fill-current" />
            </motion.div>
          )}

          {isFalseStart && (
            <div className="w-12 h-12 rounded-full bg-rose-900/40 border border-rose-500 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
          )}

          {stage === "round_result" && !isFalseStart && (
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isWinner
                  ? "bg-amber-500/20 border border-amber-400 text-amber-300"
                  : "bg-emerald-500/20 border border-emerald-400 text-emerald-300"
              }`}
            >
              <CheckCircle2 className="w-6 h-6" />
            </div>
          )}

          {stage === "ready" && (
            <div className="w-12 h-12 rounded-full bg-neutral-800/80 border border-neutral-700 text-neutral-400 flex items-center justify-center">
              <Flame className="w-6 h-6" />
            </div>
          )}

          {/* Primary Action / Status Label */}
          <div className="space-y-0.5">
            <div
              className={`font-mono font-bold tracking-wider uppercase transition-all ${
                stage === "active" || targetActive
                  ? "text-2xl sm:text-3xl text-neutral-950"
                  : "text-lg sm:text-xl"
              }`}
            >
              {stateLabel}
            </div>
            <div
              className={`text-[11px] sm:text-xs font-mono tracking-tight ${
                stage === "active" || targetActive
                  ? "text-neutral-900 font-medium"
                  : "text-neutral-400"
              }`}
            >
              {stateSubLabel}
            </div>
          </div>

          {/* User Feedback (E.g. tapped confirmation) */}
          {hasReacted && stage === "active" && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900/80 text-amber-300">
              Reaction Dispatched...
            </span>
          )}
        </div>
      </motion.button>
    </div>
  );
};

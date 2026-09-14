"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Timer } from "./Timer";

export interface ScoreBoardProps {
  roundLabel?: string;
  distanceLabel?: string;
  playerOneName?: string;
  playerOneScore?: number;
  playerOneStreak?: string;
  playerTwoName?: string;
  playerTwoScore?: number;
  playerTwoLead?: boolean;
  remainingSeconds?: number;
  targetPrompt?: string;
  className?: string;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  roundLabel = "Round 3 of 5 · Sudden Death",
  distanceLabel = "9,560 KM · LONDON ⇄ TOKYO",
  playerOneName = "Alex",
  playerOneScore = 12,
  playerOneStreak = "+2 Streak",
  playerTwoName = "Sam",
  playerTwoScore = 14,
  playerTwoLead = true,
  remainingSeconds = 8.4,
  targetPrompt,
  className,
}) => {
  return (
    <div
      className={cn(
        "relative w-full bg-surface-raised border border-subtle-border rounded-xl p-4 shadow-xl flex flex-col gap-3 overflow-hidden",
        className
      )}
    >
      {/* Glow bleed between scores */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-20 bg-shared-amber/10 blur-2xl pointer-events-none rounded-full" />

      {/* Top Meta row */}
      <div className="flex items-center justify-between relative z-10 text-[10px] font-mono">
        <span className="text-shared-amber tracking-wider uppercase flex items-center gap-1.5 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-shared-amber animate-ping" />
          {roundLabel}
        </span>
        <div className="flex items-center gap-1.5 text-on-surface-variant">
          <span className="opacity-60">DISTANCE</span>
          <span className="text-on-surface font-semibold">{distanceLabel}</span>
        </div>
      </div>

      {/* Center Dynamic Telemetry Board */}
      <div className="flex items-center justify-between relative z-10 px-2 py-1">
        {/* Player 1 (Alex) */}
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-player-one-ember" />
            <span className="text-xs font-semibold text-on-surface">
              {playerOneName}
            </span>
          </div>
          <span className="text-3xl font-bold font-mono tracking-tight text-on-surface mt-0.5">
            {playerOneScore}
          </span>
          {playerOneStreak ? (
            <span className="text-[10px] font-mono text-player-one-ember font-medium">
              {playerOneStreak}
            </span>
          ) : null}
        </div>

        {/* Center Kinetic Timer */}
        <div className="relative flex items-center justify-center">
          <Timer remainingSeconds={remainingSeconds} totalSeconds={30} size="md" />
        </div>

        {/* Player 2 (Sam) */}
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-on-surface">
              {playerTwoName}
            </span>
            <span className="w-2 h-2 rounded-full bg-player-two-sage" />
          </div>
          <span className="text-3xl font-bold font-mono tracking-tight text-on-surface mt-0.5">
            {playerTwoScore}
          </span>
          {playerTwoLead ? (
            <span className="text-[10px] font-mono text-player-two-sage font-semibold">
              Leading
            </span>
          ) : null}
        </div>
      </div>

      {/* Optional Target Prompt Banner */}
      {targetPrompt ? (
        <div className="relative z-10 w-full bg-surface-deep border border-subtle-border rounded-lg p-2.5 flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-shared-amber animate-pulse shrink-0" />
          <p className="text-xs text-on-surface font-medium truncate">
            {targetPrompt}
          </p>
        </div>
      ) : null}
    </div>
  );
};

"use client";

import React, { useEffect, useState } from "react";
import type { SpeedDuelStage } from "@/types/domain";

interface SpeedDuelTimerProps {
  stage: SpeedDuelStage;
  targetAppearedAtServer: number;
  lockedReactionMs?: number | null;
  countdownNumber?: number;
}

export const SpeedDuelTimer: React.FC<SpeedDuelTimerProps> = ({
  stage,
  targetAppearedAtServer,
  lockedReactionMs,
  countdownNumber = 3,
}) => {
  const [elapsedMs, setElapsedMs] = useState(0);

  // Live millisecond counter during active reaction phase
  useEffect(() => {
    if (stage !== "active") {
      setElapsedMs(0);
      return;
    }

    const startTime = targetAppearedAtServer > 0 ? targetAppearedAtServer : Date.now();
    const interval = setInterval(() => {
      const delta = Math.max(0, Date.now() - startTime);
      setElapsedMs(delta);
    }, 16); // ~60fps millisecond tick

    return () => clearInterval(interval);
  }, [stage, targetAppearedAtServer]);

  return (
    <div id="speed-duel-timer-block" className="flex flex-col items-center justify-center space-y-1">
      <div className="text-[10px] sm:text-xs font-mono tracking-widest text-neutral-400 uppercase">
        {stage === "countdown"
          ? "CADENCE"
          : stage === "tension"
          ? "TENSION FREQUENCY"
          : stage === "active"
          ? "REACTION CLOCK"
          : stage === "round_result"
          ? "VERIFIED SERVER TIMING"
          : "MERIDIAN CHRONO"}
      </div>

      <div className="flex items-baseline gap-1 font-mono tracking-tighter">
        {stage === "countdown" && (
          <span className="text-4xl sm:text-6xl font-black text-amber-400 animate-pulse">
            0{countdownNumber}
          </span>
        )}

        {stage === "tension" && (
          <span className="text-3xl sm:text-5xl font-black text-neutral-400 tracking-widest">
            ·· : ··
          </span>
        )}

        {stage === "active" && (
          <div className="flex items-baseline">
            <span className="text-4xl sm:text-6xl font-black text-amber-300">
              +{elapsedMs.toString().padStart(3, "0")}
            </span>
            <span className="text-xs sm:text-sm text-amber-400 font-mono ml-1 font-bold">
              ms
            </span>
          </div>
        )}

        {(stage === "round_result" || stage === "game_end") && (
          <div className="flex items-baseline">
            <span className="text-4xl sm:text-6xl font-black text-on-surface">
              {lockedReactionMs != null ? lockedReactionMs : "---"}
            </span>
            <span className="text-xs sm:text-sm text-neutral-400 font-mono ml-1">
              ms
            </span>
          </div>
        )}

        {stage === "ready" && (
          <span className="text-3xl sm:text-5xl font-black text-neutral-400">
            00:00
          </span>
        )}
      </div>
    </div>
  );
};

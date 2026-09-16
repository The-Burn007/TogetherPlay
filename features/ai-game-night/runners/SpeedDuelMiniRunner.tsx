"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Zap, Clock, ShieldAlert, Award } from "lucide-react";
import type { GameNightActivity, GameNightActivityResult } from "@/lib/ai/gameNightTypes";
import { gameNightAudio } from "@/lib/ai/gameNightAudio";

interface SpeedDuelMiniRunnerProps {
  activity: GameNightActivity;
  partnerNames: { p1: string; p2: string };
  partnerCities: { p1: string; p2: string };
  onRoundComplete: (result: GameNightActivityResult) => void;
}

export const SpeedDuelMiniRunner: React.FC<SpeedDuelMiniRunnerProps> = ({
  activity,
  partnerNames,
  onRoundComplete,
}) => {
  const p1Name = partnerNames.p1 || "Alex";
  const p2Name = partnerNames.p2 || "Sam";

  const [stage, setStage] = useState<"waiting" | "primed" | "triggered" | "completed">("waiting");
  const [triggerTime, setTriggerTime] = useState<number | null>(null);
  const [p1ReactMs, setP1ReactMs] = useState<number | null>(null);
  const [p2ReactMs, setP2ReactMs] = useState<number | null>(null);
  const [earlyFoul, setEarlyFoul] = useState<string | null>(null);
  const triggerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Start priming stage after 1 second
    const primeTimer = setTimeout(() => {
      setStage("primed");

      // Random trigger delay between 2200ms and 4500ms
      const delay = 2200 + Math.floor(Math.random() * 2300);
      triggerTimeoutRef.current = setTimeout(() => {
        setStage("triggered");
        setTriggerTime(Date.now());
        gameNightAudio.playRoundTransition();
      }, delay);
    }, 1000);

    return () => {
      clearTimeout(primeTimer);
      if (triggerTimeoutRef.current) clearTimeout(triggerTimeoutRef.current);
    };
  }, []);

  const handlePlayerTap = (player: "p1" | "p2") => {
    if (stage === "completed") return;

    if (stage === "primed") {
      // False start foul!
      const foulerName = player === "p1" ? p1Name : p2Name;
      const winnerId = player === "p1" ? "user_sam" : "user_alex";
      const winnerName = player === "p1" ? p2Name : p1Name;

      setEarlyFoul(`${foulerName} jumped before the signal!`);
      setStage("completed");
      if (triggerTimeoutRef.current) clearTimeout(triggerTimeoutRef.current);

      setTimeout(() => {
        onRoundComplete({
          completedAt: new Date().toISOString(),
          winnerId,
          winnerName,
          scores: {
            p1: player === "p1" ? 0 : 100,
            p2: player === "p2" ? 0 : 100,
          },
          summary: `False start by ${foulerName}. ${winnerName} claimed Round 4!`,
          funMoment: "Trigger finger was too eager under the high tension!",
        });
      }, 2000);
      return;
    }

    if (stage === "triggered" && triggerTime) {
      const reaction = Date.now() - triggerTime;
      gameNightAudio.playTap();

      if (player === "p1" && p1ReactMs === null) {
        setP1ReactMs(reaction);
        // Simulate P2's reaction within 220-380ms
        const p2Reaction = Math.floor(240 + Math.random() * 160);
        setP2ReactMs(p2Reaction);
        resolveDuel(reaction, p2Reaction);
      }
    }
  };

  const resolveDuel = (t1: number, t2: number) => {
    setStage("completed");
    gameNightAudio.playSynchronyLock();

    const winnerIsP1 = t1 < t2;
    const winnerId = winnerIsP1 ? "user_alex" : "user_sam";
    const winnerName = winnerIsP1 ? p1Name : p2Name;
    const diff = Math.abs(t1 - t2);

    setTimeout(() => {
      onRoundComplete({
        completedAt: new Date().toISOString(),
        winnerId,
        winnerName,
        scores: {
          p1: winnerIsP1 ? 100 : 0,
          p2: winnerIsP1 ? 0 : 100,
        },
        summary: `${winnerName} reacted in ${winnerIsP1 ? t1 : t2}ms (won by ${diff}ms)!`,
        funMoment: `Millimeter reaction contest: ${t1}ms vs ${t2}ms.`,
      });
    }, 2200);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Instructions Card */}
      <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-center space-y-1">
        <span className="text-[10px] uppercase font-mono tracking-widest text-amber-500">
          Reflex Tension Round
        </span>
        <h3 className="text-base font-serif text-neutral-100">
          {activity.title}
        </h3>
        <p className="text-xs text-neutral-400">
          Hover your finger. Tap the instant the central orb erupts into crimson!
        </p>
      </div>

      {/* Central Arena Target */}
      <div className="flex flex-col items-center justify-center p-8 rounded-3xl bg-[#11100f] border border-neutral-800 relative overflow-hidden min-h-[260px]">
        <button
          onClick={() => handlePlayerTap("p1")}
          disabled={stage === "waiting" || stage === "completed"}
          className={`w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all transform duration-100 ${
            stage === "triggered"
              ? "bg-rose-500 text-white scale-110 shadow-[0_0_50px_rgba(244,63,94,0.7)] animate-pulse"
              : stage === "primed"
              ? "bg-neutral-900 border-2 border-amber-500/50 text-amber-400 hover:border-amber-400"
              : "bg-neutral-900/60 border border-neutral-800 text-neutral-500"
          }`}
        >
          <Zap
            className={`w-10 h-10 ${
              stage === "triggered" ? "animate-bounce" : "text-neutral-400"
            }`}
          />
          <span className="text-xs font-mono font-bold mt-1 uppercase tracking-wider">
            {stage === "triggered"
              ? "TAP NOW!"
              : stage === "primed"
              ? "STAY READY"
              : "PRIMING..."}
          </span>
        </button>

        {earlyFoul && (
          <div className="mt-4 text-xs font-mono text-rose-400 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            <span>{earlyFoul}</span>
          </div>
        )}

        {p1ReactMs !== null && p2ReactMs !== null && (
          <div className="mt-4 flex items-center gap-6 font-mono text-xs">
            <span className={p1ReactMs < p2ReactMs ? "text-amber-400 font-bold" : "text-neutral-400"}>
              {p1Name}: {p1ReactMs}ms
            </span>
            <span className="text-neutral-600">vs</span>
            <span className={p2ReactMs < p1ReactMs ? "text-amber-400 font-bold" : "text-neutral-400"}>
              {p2Name}: {p2ReactMs}ms
            </span>
          </div>
        )}
      </div>

      {/* Manual Dual Simulation Taps */}
      {stage !== "completed" && (
        <div className="flex items-center justify-center gap-4 text-xs text-neutral-500">
          <span>Tap pad directly above or:</span>
          <button
            onClick={() => handlePlayerTap("p1")}
            className="hover:text-amber-400 underline font-mono"
          >
            {p1Name} reaction
          </button>
        </div>
      )}
    </div>
  );
};

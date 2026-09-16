"use client";

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Trophy,
  ArrowRight,
  Sparkles,
  Clock,
  Heart,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import type {
  GameNightActivity,
  GameNightActivityResult,
  GameNightLineup,
} from "@/lib/ai/gameNightTypes";
import { gameNightAudio } from "@/lib/ai/gameNightAudio";

interface ActivityIntermissionProps {
  completedActivity: GameNightActivity;
  nextActivity?: GameNightActivity;
  result: GameNightActivityResult;
  lineup: GameNightLineup;
  roundIndex: number;
  totalRounds: number;
  scores: { p1: number; p2: number };
  onContinue: () => void;
}

export const ActivityIntermission: React.FC<ActivityIntermissionProps> = ({
  completedActivity,
  nextActivity,
  result,
  lineup,
  roundIndex,
  totalRounds,
  scores,
  onContinue,
}) => {
  const [countdown, setCountdown] = useState(6);
  const p1Name = lineup.partnerNames.p1 || "Alex";
  const p2Name = lineup.partnerNames.p2 || "Sam";

  useEffect(() => {
    gameNightAudio.playRoundTransition();
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onContinue();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onContinue]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto space-y-6 py-6"
    >
      {/* Intermission Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-mono">
          <ShieldCheck className="w-3.5 h-3.5" />
          Round {roundIndex + 1} of {totalRounds} Concluded
        </div>
        <h2 className="text-2xl sm:text-3xl font-serif text-neutral-100">
          {result.winnerName ? `${result.winnerName} Claims Round ${roundIndex + 1}` : "Shared Meridian Synchrony"}
        </h2>
        <p className="text-sm text-neutral-400 max-w-lg mx-auto">
          {result.summary}
        </p>
      </div>

      {/* Fun Moment Highlight Card */}
      <div className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 text-center space-y-1">
        <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
          Highlight Moment
        </span>
        <p className="text-xs sm:text-sm font-serif italic text-amber-200">
          &ldquo;{result.funMoment}&rdquo;
        </p>
      </div>

      {/* Live Score Tally Card */}
      <div className="p-5 rounded-2xl bg-[#11100f] border border-neutral-800 flex items-center justify-around text-center">
        <div className="space-y-1">
          <span className="text-xs font-mono text-neutral-400">{p1Name}</span>
          <div className="text-2xl sm:text-3xl font-serif text-neutral-100">
            {scores.p1}
          </div>
          <span className="text-[10px] font-mono text-emerald-400">
            +{result.scores.p1} pts
          </span>
        </div>

        <div className="text-neutral-700 font-serif text-2xl">•</div>

        <div className="space-y-1">
          <span className="text-xs font-mono text-neutral-400">{p2Name}</span>
          <div className="text-2xl sm:text-3xl font-serif text-neutral-100">
            {scores.p2}
          </div>
          <span className="text-[10px] font-mono text-emerald-400">
            +{result.scores.p2} pts
          </span>
        </div>
      </div>

      {/* Up Next Activity Preview */}
      {nextActivity && (
        <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/80 flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-amber-500/80">
              Up Next: Round {roundIndex + 2}
            </div>
            <div className="text-sm font-semibold text-neutral-200 mt-0.5">
              {nextActivity.title}
            </div>
            <div className="text-xs text-neutral-400 mt-0.5">
              {nextActivity.subtitle}
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs font-mono text-neutral-500">
              ~{nextActivity.estimatedMinutes} mins
            </span>
          </div>
        </div>
      )}

      {/* Continue CTA with Countdown */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="text-xs font-mono text-neutral-500 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-neutral-400" />
          <span>Auto-advancing in {countdown}s...</span>
        </div>

        <button
          onClick={onContinue}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] flex items-center justify-center gap-2 group"
        >
          <span>
            {nextActivity
              ? `Proceed to Round ${roundIndex + 2}`
              : "View Tonight's Final Results"}
          </span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </motion.div>
  );
};

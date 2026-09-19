"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Crown, Sparkles, Check, Lock, Compass, Heart } from "lucide-react";
import type { GameNightActivity, GameNightActivityResult } from "@/lib/ai/gameNightTypes";
import { gameNightAudio } from "@/lib/ai/gameNightAudio";
import { secureRandomInt } from "@/lib/utils/crypto";

interface FinalChallengeRunnerProps {
  activity: GameNightActivity;
  partnerNames: { p1: string; p2: string };
  partnerCities: { p1: string; p2: string };
  onRoundComplete: (result: GameNightActivityResult) => void;
}

export const FinalChallengeRunner: React.FC<FinalChallengeRunnerProps> = ({
  activity,
  partnerNames,
  onRoundComplete,
}) => {
  const p1Name = partnerNames.p1 || "Alex";
  const p2Name = partnerNames.p2 || "Sam";

  const options = activity.promptData.options || [
    "A full 2-hour uninterrupted virtual date with candles",
    "Watch a long film together in real-time sync",
    "Send each other a physical postcard or small surprise parcel",
    "Plan our next travel itinerary step by step",
  ];

  const [p1Choice, setP1Choice] = useState<number | null>(null);
  const [p2Choice, setP2Choice] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  const handleSelect = (idx: number) => {
    if (p1Choice !== null) return;
    setP1Choice(idx);
    gameNightAudio.playTap();

    setTimeout(() => {
      // 80% chance of synchrony on the grand finale
      const companionChoice = secureRandomInt(1, 100) > 20 ? idx : (idx + 1) % options.length;
      setP2Choice(companionChoice);
      triggerFinalReveal(idx, companionChoice);
    }, 1400);
  };

  const triggerFinalReveal = (c1: number, c2: number) => {
    gameNightAudio.playFinaleFanfare();
    setIsRevealed(true);

    const isMatch = c1 === c2;
    const scores = isMatch
      ? { p1: 150, p2: 150 }
      : { p1: 75, p2: 75 };

    setTimeout(() => {
      onRoundComplete({
        completedAt: new Date().toISOString(),
        winnerId: null,
        winnerName: null,
        scores,
        summary: isMatch
          ? `Grand Synchrony! Both sealed: "${options[c1]}"`
          : `Dual Visions: "${options[c1]}" & "${options[c2]}"`,
        funMoment: isMatch
          ? "Unanimous final pledge sealed across London & Tokyo."
          : "Two lovely paths to combine for the weekend.",
      });
    }, 2800);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Finale Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-b from-amber-950/30 to-neutral-900 border border-amber-500/30 text-center space-y-3 relative overflow-hidden">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono">
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          Round 5 • Grand Meridian Climax
        </div>

        <h3 className="text-xl sm:text-2xl font-serif text-neutral-100 leading-snug">
          &ldquo;{activity.promptData.prompt}&rdquo;
        </h3>

        <p className="text-xs text-neutral-400 max-w-md mx-auto">
          {activity.promptData.guidance ||
            "Seal tonight's private game night. Choose your shared weekend pact."}
        </p>
      </div>

      {/* Lock status */}
      <div className="flex items-center justify-center gap-6 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-neutral-400">{p1Name}:</span>
          {p1Choice !== null ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Sealed
            </span>
          ) : (
            <span className="text-amber-400">Locking in...</span>
          )}
        </div>

        <span className="text-neutral-600">|</span>

        <div className="flex items-center gap-2">
          <span className="text-neutral-400">{p2Name}:</span>
          {p2Choice !== null ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Sealed
            </span>
          ) : (
            <span className="text-amber-400">Locking in...</span>
          )}
        </div>
      </div>

      {/* 4 Finale Option Cards */}
      <div className="space-y-3">
        {options.map((opt, idx) => {
          const isP1 = p1Choice === idx;
          const isP2 = p2Choice === idx;
          const isMatch = isRevealed && isP1 && isP2;

          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              disabled={p1Choice !== null}
              className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                isMatch
                  ? "bg-amber-950/40 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] text-amber-100"
                  : isRevealed && (isP1 || isP2)
                  ? "bg-neutral-800/80 border-neutral-700 text-neutral-200"
                  : isP1
                  ? "bg-amber-500/10 border-amber-500 text-amber-200"
                  : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 text-neutral-300"
              }`}
            >
              <span className="text-sm font-medium">{opt}</span>

              {/* Badges on reveal */}
              {isRevealed ? (
                <div className="flex items-center gap-2 text-xs font-mono">
                  {isP1 && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {p1Name}
                    </span>
                  )}
                  {isP2 && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {p2Name}
                    </span>
                  )}
                </div>
              ) : isP1 ? (
                <span className="text-xs font-mono text-amber-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Chosen
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Synchrony Climax Note */}
      <AnimatePresence>
        {isRevealed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-center space-y-1"
          >
            <div className="font-serif text-lg font-medium text-amber-200">
              {p1Choice === p2Choice
                ? "✨ Grand Meridian Alignment Achieved (+150 pts each)!"
                : "🌙 Shared Resonance Unlocked (+75 pts each)!"}
            </div>
            <p className="text-xs text-neutral-400">
              Calculating tonight&apos;s overall results and memorable highlights...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

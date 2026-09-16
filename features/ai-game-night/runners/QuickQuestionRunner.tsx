"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Check, Eye, HelpCircle, Heart, Lock } from "lucide-react";
import type { GameNightActivity, GameNightActivityResult } from "@/lib/ai/gameNightTypes";
import { gameNightAudio } from "@/lib/ai/gameNightAudio";

interface QuickQuestionRunnerProps {
  activity: GameNightActivity;
  partnerNames: { p1: string; p2: string };
  partnerCities: { p1: string; p2: string };
  onRoundComplete: (result: GameNightActivityResult) => void;
}

export const QuickQuestionRunner: React.FC<QuickQuestionRunnerProps> = ({
  activity,
  partnerNames,
  onRoundComplete,
}) => {
  const p1Name = partnerNames.p1 || "Alex";
  const p2Name = partnerNames.p2 || "Sam";

  const options = activity.promptData.options || [
    "Late-night ramen spot",
    "Quiet walk under streetlights",
    "Lazy Sunday coffee & music",
    "Airport arrivals reunion hug",
  ];

  const [p1Choice, setP1Choice] = useState<number | null>(null);
  const [p2Choice, setP2Choice] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  const handleSelectP1 = (index: number) => {
    if (p1Choice !== null) return;
    setP1Choice(index);
    gameNightAudio.playTap();

    // If P2 hasn't chosen yet, simulate or allow P2 choice
    if (p2Choice === null) {
      setTimeout(() => {
        // Deterministic companion choice (either match or complementary)
        const simChoice = Math.random() > 0.35 ? index : (index + 1) % options.length;
        setP2Choice(simChoice);
        triggerReveal(index, simChoice);
      }, 1200);
    } else {
      triggerReveal(index, p2Choice);
    }
  };

  const triggerReveal = (choice1: number, choice2: number) => {
    gameNightAudio.playSynchronyLock();
    setIsRevealed(true);

    const isMatch = choice1 === choice2;
    const scores = isMatch
      ? { p1: 100, p2: 100 }
      : { p1: 50, p2: 50 };

    setTimeout(() => {
      onRoundComplete({
        completedAt: new Date().toISOString(),
        winnerId: null, // Shared synchrony round
        winnerName: null,
        scores,
        summary: isMatch
          ? `Perfect Synchrony! Both picked: "${options[choice1]}"`
          : `Different perspectives: "${options[choice1]}" & "${options[choice2]}"`,
        funMoment: isMatch
          ? "Unanimous mental wavelength with zero hesitation."
          : "Different paths, equal affection.",
      });
    }, 2400);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Question Card */}
      <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-center space-y-3">
        <span className="text-[10px] uppercase font-mono tracking-widest text-rose-400">
          Double-Blind Synchrony Question
        </span>

        <h3 className="text-lg sm:text-xl font-serif text-neutral-100 leading-snug">
          &ldquo;{activity.promptData.prompt}&rdquo;
        </h3>

        <p className="text-xs text-neutral-400">
          {activity.promptData.guidance || "Select independently in secret. Revealed simultaneously."}
        </p>
      </div>

      {/* Lock Status indicator */}
      <div className="flex items-center justify-center gap-6 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-neutral-400">{p1Name}:</span>
          {p1Choice !== null ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Locked
            </span>
          ) : (
            <span className="text-amber-400">Choosing...</span>
          )}
        </div>

        <span className="text-neutral-600">|</span>

        <div className="flex items-center gap-2">
          <span className="text-neutral-400">{p2Name}:</span>
          {p2Choice !== null ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Locked
            </span>
          ) : (
            <span className="text-amber-400">Choosing...</span>
          )}
        </div>
      </div>

      {/* 4 Option Buttons */}
      <div className="space-y-2.5">
        {options.map((option, idx) => {
          const isP1 = p1Choice === idx;
          const isP2 = p2Choice === idx;
          const isMatch = isRevealed && isP1 && isP2;

          return (
            <button
              key={idx}
              onClick={() => handleSelectP1(idx)}
              disabled={p1Choice !== null}
              className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                isMatch
                  ? "bg-rose-950/30 border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)] text-rose-100"
                  : isRevealed && (isP1 || isP2)
                  ? "bg-neutral-800/80 border-amber-500/50 text-neutral-100"
                  : isP1
                  ? "bg-amber-500/10 border-amber-500 text-amber-200"
                  : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 text-neutral-300"
              }`}
            >
              <span className="text-sm font-medium">{option}</span>

              {/* Reveal Badges */}
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
                  <Check className="w-3.5 h-3.5" /> Selected
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Reveal Result Banner */}
      <AnimatePresence>
        {isRevealed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl border text-center ${
              p1Choice === p2Choice
                ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                : "bg-neutral-900/90 border-neutral-800 text-neutral-300"
            }`}
          >
            <div className="font-serif text-base font-medium">
              {p1Choice === p2Choice
                ? "✨ Harmonized Wavelength (+100 pts each)"
                : "🌙 Shared Perspective (+50 pts each)"}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Saving round memory to tonight&apos;s summary...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

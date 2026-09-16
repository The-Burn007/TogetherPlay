"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Trophy,
  RotateCcw,
  RefreshCw,
  Heart,
  Bookmark,
  Share2,
  CheckCircle2,
  MapPin,
  Clock,
  ArrowRight,
  Shield,
  Medal,
} from "lucide-react";
import type {
  GameNightLineup,
  GameNightOverallResult,
} from "@/lib/ai/gameNightTypes";
import { gameNightAudio } from "@/lib/ai/gameNightAudio";

interface GameNightFinalResultProps {
  lineup: GameNightLineup;
  overallResult: GameNightOverallResult;
  onRematch: () => void;
  onPlayAgain: () => void;
  onExit: () => void;
}

export const GameNightFinalResult: React.FC<GameNightFinalResultProps> = ({
  lineup,
  overallResult,
  onRematch,
  onPlayAgain,
  onExit,
}) => {
  const [isSaved, setIsSaved] = useState(false);
  const p1Name = lineup.partnerNames.p1 || "Alex";
  const p2Name = lineup.partnerNames.p2 || "Sam";
  const p1City = lineup.partnerCities.p1 || "London";
  const p2City = lineup.partnerCities.p2 || "Tokyo";

  const handleSaveMemory = () => {
    setIsSaved(true);
    gameNightAudio.playTap();
    if (typeof window !== "undefined") {
      try {
        const existing = JSON.parse(
          localStorage.getItem("togetherplay_game_night_memories") || "[]"
        );
        existing.push({
          theme: lineup.theme,
          date: new Date().toISOString(),
          p1Score: overallResult.totalScore.p1,
          p2Score: overallResult.totalScore.p2,
          synchrony: overallResult.meridianSynchronyPercentage,
          winner: overallResult.overallWinnerName || "Tie",
        });
        localStorage.setItem(
          "togetherplay_game_night_memories",
          JSON.stringify(existing)
        );
      } catch {
        // ignore
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-3xl mx-auto space-y-8 py-8 px-4"
    >
      {/* Grand Header & Shared Result */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono">
          <Medal className="w-3.5 h-3.5 text-amber-400" />
          Game Night Complete
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-light text-neutral-100 tracking-tight">
          {overallResult.isTie
            ? "Harmonized Meridian Tie"
            : `${overallResult.overallWinnerName} Takes Tonight's Crown`}
        </h1>

        <p className="text-sm sm:text-base text-neutral-400 max-w-xl mx-auto leading-relaxed">
          {overallResult.isTie
            ? `An astonishing evening of equal reflex and mutual intuition across 9,560 km.`
            : `After 5 rigorous rounds of reflex, memory, and camera synchrony, ${overallResult.overallWinnerName} emerged with the higher tally.`}
        </p>

        {/* Meridian Synchrony Meter */}
        <div className="inline-flex items-center gap-3 p-3 px-5 rounded-2xl bg-neutral-900/80 border border-neutral-800">
          <span className="text-xs font-mono text-neutral-400">
            Shared Synchrony:
          </span>
          <span className="text-xl font-serif font-medium text-amber-300">
            {overallResult.meridianSynchronyPercentage}%
          </span>
          <span className="text-[11px] text-neutral-500 font-mono">
            (High Wavelength)
          </span>
        </div>
      </div>

      {/* Final Scoreboard Card */}
      <div className="p-6 rounded-3xl bg-[#121110] border border-neutral-800 space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4">
          <span className="text-xs uppercase font-mono tracking-wider text-neutral-400">
            Final Score Breakdown
          </span>
          <span className="text-xs font-mono text-neutral-400">
            5 Rounds Played
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Player 1 Card */}
          <div
            className={`p-4 rounded-2xl border text-center space-y-1 ${
              overallResult.overallWinnerId === "user_alex"
                ? "bg-amber-500/10 border-amber-500/40 shadow-[0_0_20px_rgba(251,191,36,0.15)]"
                : "bg-neutral-900/60 border-neutral-800/80"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-400 font-mono">
              <MapPin className="w-3 h-3 text-neutral-500" />
              {p1Name} ({p1City})
            </div>
            <div className="text-4xl font-serif text-neutral-100">
              {overallResult.totalScore.p1}
            </div>
            <div className="text-[11px] font-mono text-neutral-400">
              {overallResult.roundWins.p1} round win
              {overallResult.roundWins.p1 !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Player 2 Card */}
          <div
            className={`p-4 rounded-2xl border text-center space-y-1 ${
              overallResult.overallWinnerId === "user_sam"
                ? "bg-amber-500/10 border-amber-500/40 shadow-[0_0_20px_rgba(251,191,36,0.15)]"
                : "bg-neutral-900/60 border-neutral-800/80"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-400 font-mono">
              <MapPin className="w-3 h-3 text-neutral-500" />
              {p2Name} ({p2City})
            </div>
            <div className="text-4xl font-serif text-neutral-100">
              {overallResult.totalScore.p2}
            </div>
            <div className="text-[11px] font-mono text-neutral-400">
              {overallResult.roundWins.p2} round win
              {overallResult.roundWins.p2 !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Fun Moments Reel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs uppercase font-mono tracking-wider text-neutral-400">
            Fun Moments &amp; Evening Highlights
          </h2>
          <span className="text-xs font-mono text-amber-500/80">
            Saved to Lore
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {overallResult.funMoments.map((moment, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/90 space-y-1.5"
            >
              <span className="text-[10px] font-mono uppercase text-amber-500/80">
                Moment {idx + 1}
              </span>
              <p className="text-xs text-neutral-300 leading-relaxed font-serif">
                &ldquo;{moment}&rdquo;
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons: Rematch, Play Again, Save, Return */}
      <div className="pt-4 border-t border-neutral-800/80 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Rematch Button (New AI Lineup) */}
          <button
            onClick={onRematch}
            className="p-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] flex items-center justify-center gap-2 group"
          >
            <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
            <span>Rematch (Curate New Lineup)</span>
          </button>

          {/* Play Again Button (Replay This Lineup) */}
          <button
            onClick={onPlayAgain}
            className="p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 hover:border-neutral-700 font-semibold text-xs transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
            <span>Play Again (Replay Tonight)</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {/* Save to Memories */}
          <button
            onClick={handleSaveMemory}
            disabled={isSaved}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-300 flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            {isSaved ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>{isSaved ? "Saved to Couple Lore" : "Save to Couple Memories"}</span>
          </button>

          {/* Exit / Return */}
          <button
            onClick={onExit}
            className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs text-neutral-500 hover:text-neutral-300 transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Return to Sanctuary Home</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

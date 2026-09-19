"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Eye, Clock, Trophy, Sparkles } from "lucide-react";
import type { GameNightActivity, GameNightActivityResult } from "@/lib/ai/gameNightTypes";
import { gameNightAudio } from "@/lib/ai/gameNightAudio";
import { secureFisherYatesShuffle } from "@/lib/utils/crypto";

interface FindItFirstMiniRunnerProps {
  activity: GameNightActivity;
  partnerNames: { p1: string; p2: string };
  partnerCities: { p1: string; p2: string };
  onRoundComplete: (result: GameNightActivityResult) => void;
}

const GRID_ITEMS = [
  { id: "key", label: "Vintage Key", emoji: "🗝️" },
  { id: "compass", label: "Brass Compass", emoji: "🧭" },
  { id: "tea", label: "London Teacup", emoji: "☕" },
  { id: "token", label: "Tokyo Metro Token", emoji: "🎫" },
  { id: "vinyl", label: "Old Vinyl", emoji: "🎵" },
  { id: "camera", label: "Polaroid Camera", emoji: "📷" },
  { id: "letter", label: "Airmail Letter", emoji: "✉️" },
  { id: "lantern", label: "Night Lantern", emoji: "🏮" },
  { id: "book", label: "Leather Journal", emoji: "📖" },
  { id: "candle", label: "Candle Flame", emoji: "🕯️" },
  { id: "watch", label: "Pocket Watch", emoji: "⏱️" },
  { id: "postcard", label: "Stamp Postcard", emoji: "🏷️" },
  { id: "flower", label: "Cherry Blossom", emoji: "🌸" },
  { id: "rain", label: "London Umbrella", emoji: "☂️" },
  { id: "gem", label: "Meridian Quartz", emoji: "💎" },
  { id: "bell", label: "Silver Bell", emoji: "🔔" },
];

export const FindItFirstMiniRunner: React.FC<FindItFirstMiniRunnerProps> = ({
  activity,
  partnerNames,
  onRoundComplete,
}) => {
  const p1Name = partnerNames.p1 || "Alex";
  const p2Name = partnerNames.p2 || "Sam";

  // Target item selected deterministically
  const [targetItem] = useState(() => GRID_ITEMS[1]); // Compass
  const [shuffledItems] = useState(() => secureFisherYatesShuffle(GRID_ITEMS));
  const [timeLeft, setTimeLeft] = useState(15);
  const [claimedBy, setClaimedBy] = useState<string | null>(null);
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const [startTime] = useState(() => Date.now());

  // Timer loop
  useEffect(() => {
    if (claimedBy) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [claimedBy]);

  const handleTimeout = useCallback(() => {
    setClaimedBy("tie");
    setTimeout(() => {
      onRoundComplete({
        completedAt: new Date().toISOString(),
        winnerId: null,
        winnerName: null,
        scores: { p1: 50, p2: 50 },
        summary: "Sensory scan timed out — both earned 50 intuition points.",
        funMoment: "Item remained shrouded in the London-Tokyo twilight.",
      });
    }, 1800);
  }, [onRoundComplete]);

  const handleCellTap = (item: (typeof GRID_ITEMS)[0], player: "p1" | "p2") => {
    if (claimedBy) return;
    gameNightAudio.playTap();

    if (item.id === targetItem.id) {
      const elapsed = Date.now() - startTime;
      const winnerId = player === "p1" ? "user_alex" : "user_sam";
      const winnerName = player === "p1" ? p1Name : p2Name;

      setClaimedBy(winnerId);
      setReactionMs(elapsed);
      gameNightAudio.playSynchronyLock();

      setTimeout(() => {
        onRoundComplete({
          completedAt: new Date().toISOString(),
          winnerId,
          winnerName,
          scores: {
            p1: player === "p1" ? 100 : 0,
            p2: player === "p2" ? 100 : 0,
          },
          summary: `${winnerName} locked the target in ${(elapsed / 1000).toFixed(2)}s!`,
          funMoment: `Instant target acquisition on the ${targetItem.label}.`,
        });
      }, 1800);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Target item indicator */}
      <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-center space-y-2">
        <span className="text-[10px] uppercase font-mono tracking-widest text-amber-500">
          Target Relic to Locate
        </span>
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl">{targetItem.emoji}</span>
          <div className="text-left">
            <div className="text-lg font-serif font-medium text-neutral-100">
              {targetItem.label}
            </div>
            <div className="text-xs text-neutral-400">
              First to tap the coordinate wins Round 1
            </div>
          </div>
        </div>

        {/* Timer Bar */}
        <div className="flex items-center justify-center gap-2 pt-2 text-xs font-mono text-neutral-400">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>Sensory Window: {timeLeft}s</span>
        </div>
      </div>

      {/* 4x4 Grid Board */}
      <div className="grid grid-cols-4 gap-2.5 p-3 rounded-2xl bg-[#11100f] border border-neutral-800">
        {shuffledItems.map((item) => {
          const isTarget = item.id === targetItem.id;
          const isSelected = claimedBy && isTarget;

          return (
            <button
              key={item.id}
              onClick={() => handleCellTap(item, "p1")}
              disabled={Boolean(claimedBy)}
              className={`h-20 sm:h-24 rounded-xl flex flex-col items-center justify-center p-2 border transition-all ${
                isSelected
                  ? "bg-amber-500/20 border-amber-400 scale-105 shadow-[0_0_15px_rgba(251,191,36,0.3)] text-amber-200"
                  : "bg-neutral-900/60 border-neutral-800/80 hover:border-neutral-700 text-neutral-300 hover:scale-[1.02]"
              }`}
            >
              <span className="text-2xl sm:text-3xl">{item.emoji}</span>
              <span className="text-[10px] font-mono text-neutral-400 mt-1 truncate max-w-[80px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Result feedback note */}
      {claimedBy && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center text-xs text-amber-300 font-mono"
        >
          {claimedBy === "tie"
            ? "Time elapsed! Resolving round..."
            : `Coordinate Locked! ${(reactionMs! / 1000).toFixed(2)}s reaction time.`}
        </motion.div>
      )}

      {/* Subtle dual-play simulation button for testing both perspectives */}
      {!claimedBy && (
        <div className="flex items-center justify-center gap-4 text-xs text-neutral-500">
          <span>Testing perspectives:</span>
          <button
            onClick={() => handleCellTap(targetItem, "p1")}
            className="hover:text-amber-400 underline font-mono"
          >
            {p1Name} taps target
          </button>
          <span>•</span>
          <button
            onClick={() => handleCellTap(targetItem, "p2")}
            className="hover:text-amber-400 underline font-mono"
          >
            {p2Name} taps target
          </button>
        </div>
      )}
    </div>
  );
};

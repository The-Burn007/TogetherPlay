"use client";

import React from "react";
import {
  ListOrdered,
  Volume2,
  VolumeX,
  X,
  ArrowRight,
  Trophy,
} from "lucide-react";
import type { GameNightActivity, GameNightLineup } from "@/lib/ai/gameNightTypes";

interface AIGameNightHUDProps {
  lineup: GameNightLineup;
  currentActivity: GameNightActivity;
  nextActivity?: GameNightActivity;
  currentRoundIndex: number;
  totalRounds: number;
  scores: { p1: number; p2: number };
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenLineupDrawer: () => void;
  onExit: () => void;
}

export const AIGameNightHUD: React.FC<AIGameNightHUDProps> = ({
  lineup,
  currentActivity,
  nextActivity,
  currentRoundIndex,
  totalRounds,
  scores,
  isMuted,
  onToggleMute,
  onOpenLineupDrawer,
  onExit,
}) => {
  const p1Name = lineup.partnerNames.p1 || "Alex";
  const p2Name = lineup.partnerNames.p2 || "Sam";

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0c0b0a]/90 backdrop-blur-md border-b border-neutral-800/80 px-4 py-2.5">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Lineup toggle & Round badge */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenLineupDrawer}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 text-neutral-300 hover:text-amber-400 text-xs font-medium transition-all group"
            title="View Tonight's Lineup"
          >
            <ListOrdered className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Tonight&apos;s Lineup</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {currentRoundIndex + 1}/{totalRounds}
            </span>
          </button>

          {/* Current Activity Title */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-200 truncate max-w-[140px] sm:max-w-[220px]">
              {currentActivity.title}
            </span>
          </div>
        </div>

        {/* Center: 5-Segment Progress Bar */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900/80 border border-neutral-800">
          {lineup.activities.map((act, idx) => {
            const isCompleted = idx < currentRoundIndex;
            const isCurrent = idx === currentRoundIndex;
            return (
              <div
                key={act.id}
                className="flex items-center gap-1.5"
                title={`Round ${idx + 1}: ${act.title}`}
              >
                <div
                  className={`w-5 h-1.5 rounded-full transition-all duration-300 ${
                    isCompleted
                      ? "bg-emerald-500"
                      : isCurrent
                      ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                      : "bg-neutral-800"
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Right: Score tally, Next teaser, Sound & Exit */}
        <div className="flex items-center gap-2.5">
          {/* Live Score Tally */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-xs font-mono">
            <Trophy className="w-3 h-3 text-amber-400" />
            <span className={scores.p1 > scores.p2 ? "text-amber-400 font-bold" : "text-neutral-300"}>
              {p1Name}: {scores.p1}
            </span>
            <span className="text-neutral-600">•</span>
            <span className={scores.p2 > scores.p1 ? "text-amber-400 font-bold" : "text-neutral-300"}>
              {p2Name}: {scores.p2}
            </span>
          </div>

          {/* Next Activity Teaser */}
          {nextActivity && (
            <div className="hidden lg:flex items-center gap-1 text-[11px] text-neutral-400 font-medium px-2 py-1 rounded bg-neutral-900/60 border border-neutral-800/60">
              <span className="text-neutral-500">Up Next:</span>
              <span className="text-neutral-300 truncate max-w-[120px]">
                {nextActivity.title.split(":")[0]}
              </span>
              <ArrowRight className="w-2.5 h-2.5 text-neutral-500" />
            </div>
          )}

          {/* Sound Mute Toggle */}
          <button
            onClick={onToggleMute}
            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
            title={isMuted ? "Unmute Sound" : "Mute Sound"}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Exit Button */}
          <button
            onClick={onExit}
            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Leave Game Night"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};

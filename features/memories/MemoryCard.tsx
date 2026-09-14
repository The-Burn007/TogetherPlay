"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Play, Pause, Zap } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export interface MemoryCardProps {
  dateLabel: string;
  tag: string;
  tagVariant?: "ember" | "amber" | "sage";
  title: string;
  description: string;
  playerOnePhotoUrl?: string;
  playerOneTimeLabel?: string;
  playerOneCity?: string;
  playerTwoPhotoUrl?: string;
  playerTwoTimeLabel?: string;
  playerTwoCity?: string;
  highlightStat?: string;
  pts?: string;
  audioNote?: {
    title: string;
    duration: string;
    author: string;
  };
  quote?: {
    text: string;
    author: string;
  };
}

export const MemoryCard: React.FC<MemoryCardProps> = ({
  dateLabel,
  tag,
  tagVariant = "amber",
  title,
  description,
  playerOnePhotoUrl,
  playerOneTimeLabel,
  playerOneCity,
  playerTwoPhotoUrl,
  playerTwoTimeLabel,
  playerTwoCity,
  highlightStat,
  pts,
  audioNote,
  quote,
}) => {
  const { showToast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    showToast(isPlaying ? "Audio note paused" : `Playing: ${audioNote?.title}`);
  };

  return (
    <article className="relative flex flex-col space-y-3 pl-7 sm:pl-8 group">
      {/* Timeline Node Point */}
      <div className="absolute left-1 top-1.5 w-4 h-4 rounded-full bg-surface-deep border border-subtle-border flex items-center justify-center -z-0">
        <div
          className={`w-2 h-2 rounded-full ${
            tagVariant === "ember"
              ? "bg-player-one-ember"
              : tagVariant === "sage"
              ? "bg-player-two-sage"
              : "bg-shared-amber"
          }`}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">
          {dateLabel}
        </span>
        <Badge variant={tagVariant} size="sm">
          {tag}
        </Badge>
      </div>

      <div className="bg-surface-raised border border-subtle-border rounded-xl p-4 sm:p-5 shadow-md flex flex-col space-y-3">
        <div className="flex flex-col space-y-1">
          <h3 className="text-base font-semibold text-on-surface leading-snug">
            {title}
          </h3>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {description}
          </p>
        </div>

        {/* Dual Photo Comparison */}
        {playerOnePhotoUrl && playerTwoPhotoUrl ? (
          <div className="grid grid-cols-2 gap-2 bg-surface-deep p-2 rounded-lg border border-subtle-border">
            {/* Alex */}
            <div className="relative flex flex-col space-y-1.5">
              <div className="relative h-36 sm:h-40 rounded-lg overflow-hidden bg-surface-container shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={playerOnePhotoUrl}
                  alt="Alex reaction"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 bg-player-one-ember/90 backdrop-blur-md px-1.5 py-0.5 rounded font-mono text-[8px] uppercase tracking-widest text-canvas-cream font-bold">
                  Alex
                </div>
              </div>
              <div className="flex items-center justify-between px-1 text-[10px] font-mono">
                <span className="text-on-surface-variant">{playerOneTimeLabel}</span>
                <span className="text-player-one-ember font-medium">{playerOneCity}</span>
              </div>
            </div>

            {/* Sam */}
            <div className="relative flex flex-col space-y-1.5">
              <div className="relative h-36 sm:h-40 rounded-lg overflow-hidden bg-surface-container shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={playerTwoPhotoUrl}
                  alt="Sam reaction"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 bg-player-two-sage/90 backdrop-blur-md px-1.5 py-0.5 rounded font-mono text-[8px] uppercase tracking-widest text-canvas-cream font-bold">
                  Sam
                </div>
              </div>
              <div className="flex items-center justify-between px-1 text-[10px] font-mono">
                <span className="text-player-two-sage font-medium">{playerTwoTimeLabel}</span>
                <span className="text-player-two-sage font-medium">{playerTwoCity}</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Highlight Stat Row */}
        {highlightStat ? (
          <div className="flex items-center justify-between bg-surface-deep border border-subtle-border px-3 py-2 rounded-lg text-xs font-mono">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-player-two-sage" />
              <span className="text-on-surface">{highlightStat}</span>
            </div>
            {pts ? (
              <span className="text-[10px] text-shared-amber bg-surface-raised px-2 py-0.5 rounded border border-subtle-border font-bold">
                {pts}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Audio Note Pill */}
        {audioNote ? (
          <div
            onClick={togglePlay}
            className="flex items-center justify-between bg-surface-overlay border border-subtle-border px-3 py-2 rounded-lg cursor-pointer hover:bg-surface-container transition-colors"
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="w-7 h-7 rounded-full bg-player-one-ember text-canvas-cream flex items-center justify-center shadow-sm"
                aria-label="Play voice note"
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5 ml-0.5" />
                )}
              </button>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-on-surface">
                  {audioNote.title}
                </span>
                <span className="text-[10px] font-mono text-on-surface-variant">
                  Voice note by {audioNote.author} · {audioNote.duration}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1 h-3 bg-shared-amber/60 rounded-full animate-pulse" />
              <span className="w-1 h-5 bg-shared-amber rounded-full" />
              <span className="w-1 h-2 bg-shared-amber/40 rounded-full" />
              <span className="w-1 h-4 bg-shared-amber/80 rounded-full" />
            </div>
          </div>
        ) : null}

        {/* Quote Block */}
        {quote ? (
          <div className="bg-surface-deep border border-subtle-border p-3 rounded-lg flex flex-col gap-1">
            <p className="text-xs text-on-surface italic leading-relaxed">
              &ldquo;{quote.text}&rdquo;
            </p>
            <span className="text-[9px] font-mono text-player-two-sage uppercase tracking-widest text-right">
              — {quote.author}
            </span>
          </div>
        ) : null}
      </div>
    </article>
  );
};

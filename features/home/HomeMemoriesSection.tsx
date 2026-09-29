"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Bookmark, ArrowRight, Play, Pause, Mic } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { HomeRecentMemoryData } from "@/lib/firebase/services/home";

export interface HomeMemoriesSectionProps {
  recentMemory: HomeRecentMemoryData | null;
}

export const HomeMemoriesSection: React.FC<HomeMemoriesSectionProps> = ({ recentMemory }) => {
  const { showToast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    showToast({
      message: isPlaying
        ? "Audio whisper paused"
        : `Playing: ${recentMemory?.audioNote?.title || "Shared Audio Note"}`,
      variant: "info",
    });
  };

  return (
    <section className="flex flex-col w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-soft-stone" />
          <h3 className="text-sm font-semibold text-warm-cream tracking-tight">
            Our Little History
          </h3>
        </div>
        <Link
          href="/memories"
          className="text-xs font-mono text-soft-stone hover:text-warm-cream flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-brand transition-colors"
        >
          <span>Private Archive</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {recentMemory ? (
        /* Archival Memory Card */
        <div className="p-5 sm:p-6 rounded-3xl bg-surface border border-border/80 shadow-elevation-md flex flex-col gap-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-soft-stone font-medium">
              Archived Moment
            </span>
            <span className="text-soft-sage">
              {recentMemory.dateLabel}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {recentMemory.imageUrl && (
              <div className="w-full sm:w-48 h-32 rounded-2xl overflow-hidden relative bg-surface-charcoal shrink-0 border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={recentMemory.imageUrl}
                  alt=""
                  className="w-full h-full object-cover filter brightness-95"
                />
                <span className="absolute bottom-2 left-2 text-[10px] font-mono text-warm-cream bg-surface-charcoal/90 backdrop-blur-md px-2 py-0.5 rounded-lg border border-border">
                  {recentMemory.tag}
                </span>
              </div>
            )}

            <div className="flex flex-col justify-between flex-1 gap-2 min-w-0">
              <div>
                <h4 className="font-display text-base sm:text-lg text-warm-cream">
                  {recentMemory.title}
                </h4>
                <p className="text-xs text-soft-stone mt-1 leading-relaxed">
                  {recentMemory.description}
                </p>
              </div>

              {recentMemory.highlightStat && (
                <div className="text-xs font-mono text-warm-cream pt-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                  <span>Highlight: {recentMemory.highlightStat}</span>
                </div>
              )}
            </div>
          </div>

          {/* Archival Audio Note Whisper Player */}
          {recentMemory.audioNote && (
            <div className="pt-2 border-t border-border/60 flex items-center justify-between bg-surface-charcoal p-3.5 rounded-2xl border border-border/70">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-brand text-text-on-mint flex items-center justify-center hover:bg-brand-hover active:scale-95 transition-all focus-visible:outline-2 focus-visible:outline-brand cursor-pointer shrink-0 shadow-sm"
                  aria-label={isPlaying ? "Pause memory audio" : "Play memory audio"}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-warm-cream flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-soft-stone" />
                    <span>{recentMemory.audioNote.title}</span>
                  </span>
                  <span className="text-[10px] font-mono text-soft-sage">
                    Audio Note · <span className="font-tabular">{recentMemory.audioNote.duration}</span>
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-mono text-soft-stone">
                {isPlaying ? "Playing..." : "Tap to listen"}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* Meaningful State: Brand New Archive */
        <div className="p-7 sm:p-8 rounded-3xl bg-surface/70 border border-dashed border-border text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-surface-charcoal border border-border flex items-center justify-center text-soft-stone">
            <Bookmark className="w-5 h-5 opacity-80" />
          </div>
          <div>
            <h4 className="font-display text-base text-warm-cream">
              Your shared archive is quiet
            </h4>
            <p className="text-xs text-soft-stone max-w-sm mt-1 leading-relaxed">
              Moments from your games, reciprocal photo duels, and voice whispers will automatically be preserved here.
            </p>
          </div>
          <Link
            href="/play"
            className="mt-1 px-5 py-2.5 rounded-xl bg-brand text-text-on-mint font-semibold text-xs transition-all hover:bg-brand-hover active:scale-95 shadow-sm"
          >
            Start First Moment
          </Link>
        </div>
      )}
    </section>
  );
};

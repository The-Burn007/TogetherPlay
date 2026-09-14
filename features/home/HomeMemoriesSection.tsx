"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Play, Pause, Bookmark } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
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
          <Bookmark className="w-4 h-4 text-player-two-sage" />
          <h3 className="text-sm font-semibold text-on-surface">Memories</h3>
        </div>
        <Link
          href="/memories"
          className="text-xs font-mono text-shared-amber hover:underline tracking-wider flex items-center gap-1"
        >
          <span>All Memories</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {recentMemory ? (
        /* Recent Memory Card */
        <div className="p-4 sm:p-5 rounded-2xl bg-surface-raised border border-subtle-border shadow-md flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-player-two-sage font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-player-two-sage" />
              Recent Memory
            </span>
            <span className="text-[11px] font-mono text-on-surface-variant">
              {recentMemory.dateLabel}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {recentMemory.imageUrl && (
              <div className="w-full sm:w-44 h-28 rounded-xl overflow-hidden relative bg-surface-deep shrink-0 border border-subtle-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={recentMemory.imageUrl}
                  alt={recentMemory.title}
                  className="w-full h-full object-cover"
                />
                <Badge
                  variant={recentMemory.tagVariant}
                  size="sm"
                  className="absolute bottom-2 left-2"
                >
                  {recentMemory.tag}
                </Badge>
              </div>
            )}

            <div className="flex flex-col justify-between flex-1 gap-2">
              <div>
                <h4 className="text-base font-semibold text-on-surface">
                  {recentMemory.title}
                </h4>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  {recentMemory.description}
                </p>
              </div>

              {recentMemory.highlightStat && (
                <div className="flex items-center gap-2 text-[11px] font-mono text-player-two-sage">
                  <span className="w-1 h-1 rounded-full bg-player-two-sage" />
                  <span>Highlight: {recentMemory.highlightStat}</span>
                </div>
              )}
            </div>
          </div>

          {recentMemory.audioNote && (
            <div className="pt-3 border-t border-subtle-border flex items-center justify-between bg-surface-deep/40 p-2.5 rounded-xl">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={togglePlay}
                  className="w-8 h-8 rounded-full bg-player-two-sage/20 text-player-two-sage flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                  aria-label="Play memory audio"
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  )}
                </button>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-on-surface">
                    {recentMemory.audioNote.title}
                  </span>
                  <span className="text-[10px] font-mono text-on-surface-variant">
                    Audio Note · {recentMemory.audioNote.duration}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-player-two-sage">
                {isPlaying ? "Playing..." : "Tap to listen"}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* Meaningful State: No Memories */
        <div className="p-5 sm:p-6 rounded-2xl bg-surface-raised/60 border border-dashed border-subtle-border text-center flex flex-col items-center justify-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-surface-overlay flex items-center justify-center text-on-surface-variant">
            <Bookmark className="w-5 h-5 opacity-70" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-on-surface">
              No memories captured yet
            </h4>
            <p className="text-xs text-on-surface-variant max-w-sm mt-0.5">
              Your shared archive is brand new. Moments from your first game, photo duel, or voice whisper will be preserved here automatically.
            </p>
          </div>
          <Link
            href="/memories"
            className="mt-1 px-4 py-2 rounded-xl bg-surface-overlay hover:bg-surface-container border border-subtle-border text-on-surface font-semibold text-xs transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-shared-amber" />
            <span>Open Memory Vault</span>
          </Link>
        </div>
      )}
    </section>
  );
};

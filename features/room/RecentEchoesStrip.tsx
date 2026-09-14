"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Play, Pause } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export const RecentEchoesStrip: React.FC = () => {
  const { showToast } = useToast();
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const toggleAudio = () => {
    setIsPlayingAudio(!isPlayingAudio);
    showToast(isPlayingAudio ? "Audio note paused" : "Playing Sam's audio note from Yoyogi Park");
  };

  return (
    <section className="flex flex-col w-full space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-on-surface">Recent Echoes</h3>
        <Link
          href="/memories"
          className="text-[10px] font-mono text-shared-amber uppercase tracking-wider hover:underline"
        >
          All Memories
        </Link>
      </div>

      {/* Horizontal Swipe Container */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none snap-x snap-mandatory">
        {/* Card 1: Yesterday's Photo Duel */}
        <div className="min-w-[220px] snap-start flex flex-col rounded-xl bg-surface-raised border border-subtle-border p-3 shadow-md">
          <div className="w-full h-28 rounded-lg overflow-hidden relative bg-surface-deep">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://picsum.photos/seed/togetherplay-snap-finish/400/250"
              alt="Speed Duel finished"
              className="w-full h-full object-cover"
            />
            <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-surface-deep/90 backdrop-blur font-mono text-[9px] text-canvas-cream font-medium">
              Yesterday
            </span>
          </div>
          <div className="mt-2.5 flex flex-col">
            <span className="text-xs font-semibold text-on-surface truncate">
              Speed Duel: Tokyo Win
            </span>
            <span className="text-[10px] font-mono text-player-two-sage mt-0.5">
              Sam finished in 0.12s lead
            </span>
          </div>
        </div>

        {/* Card 2: Shared Ambient Audio Note */}
        <div className="min-w-[220px] snap-start flex flex-col rounded-xl bg-surface-raised border border-subtle-border p-3 shadow-md">
          <div className="w-full h-28 rounded-lg bg-surface-deep border border-subtle-border flex flex-col items-center justify-center p-3 relative overflow-hidden">
            <button
              onClick={toggleAudio}
              className="w-10 h-10 rounded-full bg-player-two-sage/25 border border-player-two-sage/40 flex items-center justify-center text-player-two-sage mb-1 cursor-pointer hover:scale-105 transition-transform"
              aria-label="Play audio note"
            >
              {isPlayingAudio ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            {/* Simulated audio waveform */}
            <div className="flex items-center gap-1 h-5 mt-1">
              {[8, 14, 6, 18, 12, 20, 10, 16, 7, 13, 9].map((height, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full ${
                    isPlayingAudio ? "bg-player-two-sage animate-pulse" : "bg-player-two-sage/50"
                  }`}
                  style={{ height: `${height}px` }}
                />
              ))}
            </div>
            <span className="absolute bottom-1.5 right-2 font-mono text-[9px] text-on-surface-variant">
              0:42
            </span>
          </div>
          <div className="mt-2.5 flex flex-col">
            <span className="text-xs font-semibold text-on-surface truncate">
              Tokyo Morning Walk
            </span>
            <span className="text-[10px] font-mono text-on-surface-variant mt-0.5">
              Shared 4h ago · Yoyogi Park
            </span>
          </div>
        </div>

        {/* Card 3: Camera Flash Snap */}
        <div className="min-w-[220px] snap-start flex flex-col rounded-xl bg-surface-raised border border-subtle-border p-3 shadow-md">
          <div className="w-full h-28 rounded-lg overflow-hidden relative bg-surface-deep">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://picsum.photos/seed/togetherplay-yellow-snap/400/250"
              alt="Snap yellow challenge"
              className="w-full h-full object-cover"
            />
            <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-surface-deep/90 backdrop-blur font-mono text-[9px] text-shared-amber font-semibold">
              Challenge
            </span>
          </div>
          <div className="mt-2.5 flex flex-col">
            <span className="text-xs font-semibold text-on-surface truncate">
              &lsquo;Show Something Yellow&rsquo;
            </span>
            <span className="text-[10px] font-mono text-canvas-sand mt-0.5">
              Completed 2 days ago
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

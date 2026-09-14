"use client";

import React from "react";
import Link from "next/link";
import { Gamepad2, Play, Sparkles, ArrowRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { HomeContinueGameData, HomeSuggestedGameData } from "@/lib/firebase/services/home";

export interface HomeGamesSectionProps {
  continueGame: HomeContinueGameData | null;
  suggestedGame: HomeSuggestedGameData;
}

export const HomeGamesSection: React.FC<HomeGamesSectionProps> = ({
  continueGame,
  suggestedGame,
}) => {
  return (
    <section className="flex flex-col w-full space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-shared-amber" />
          <h3 className="text-sm font-semibold text-on-surface">Games</h3>
        </div>
        <Link
          href="/play"
          className="text-xs font-mono text-shared-amber hover:underline tracking-wider flex items-center gap-1"
        >
          <span>Catalog (6)</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* 1. Continue Game Sub-module */}
        {continueGame ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-surface-raised border border-subtle-border shadow-md flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-player-two-sage font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-player-two-sage animate-pulse" />
                Continue Game
              </span>
              <Badge variant="sage" size="sm">
                In Progress
              </Badge>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-on-surface">
                  {continueGame.title}
                </h4>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {continueGame.subtitle} · <span className="text-player-two-sage">{continueGame.roundLabel}</span>
                </p>
              </div>

              <Link
                href={continueGame.href}
                className="self-start sm:self-auto px-4 py-2 rounded-xl bg-player-two-sage hover:bg-[#86a87e] text-surface-deep font-semibold text-xs tracking-tight transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{continueGame.actionLabel}</span>
              </Link>
            </div>

            {/* Subtle Progress Track */}
            <div className="w-full bg-surface-deep rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-player-two-sage h-full rounded-full transition-all"
                style={{ width: `${continueGame.progressPercent}%` }}
              />
            </div>
          </div>
        ) : (
          /* Meaningful State: No Previous Games */
          <div className="p-5 sm:p-6 rounded-2xl bg-surface-raised/60 border border-dashed border-subtle-border text-center flex flex-col items-center justify-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-surface-overlay flex items-center justify-center text-on-surface-variant">
              <Gamepad2 className="w-5 h-5 opacity-70" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-on-surface">
                No previous games yet
              </h4>
              <p className="text-xs text-on-surface-variant max-w-sm mt-0.5">
                Play your very first duel together to start your shared couple chronicle and unlock collaborative memories.
              </p>
            </div>
            <Link
              href="/play"
              className="mt-1 px-4 py-2 rounded-xl bg-shared-amber hover:bg-[#e6a847] text-surface-deep font-semibold text-xs transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Start First Game</span>
            </Link>
          </div>
        )}

        {/* 2. Suggested Game Sub-module */}
        <div className="p-4 sm:p-5 rounded-2xl bg-surface-raised border border-subtle-border shadow-md flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-shared-amber font-bold">
              Suggested Game
            </span>
            <span className="text-xs font-mono text-player-two-sage font-semibold">
              {suggestedGame.affinityBonus}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-semibold text-on-surface">
                  {suggestedGame.title}
                </h4>
                <Badge variant={suggestedGame.badgeVariant} size="sm">
                  {suggestedGame.badgeLabel}
                </Badge>
              </div>
              <p className="text-xs text-on-surface-variant line-clamp-2">
                {suggestedGame.description}
              </p>
            </div>

            <Link
              href={suggestedGame.href}
              className="self-start sm:self-auto shrink-0 px-4 py-2.5 rounded-xl bg-shared-amber hover:bg-[#e6a847] text-surface-deep font-semibold text-xs tracking-tight transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play Now</span>
            </Link>
          </div>

          <div className="pt-2 border-t border-subtle-border flex items-center gap-3 text-[11px] font-mono text-on-surface-variant">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-shared-amber" />
              <span>{suggestedGame.durationLabel}</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1.5">
              {suggestedGame.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded bg-surface-overlay text-[10px]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

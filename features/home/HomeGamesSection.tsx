"use client";

import React from "react";
import Link from "next/link";
import {
  Gamepad2,
  Play,
  ArrowRight,
  Camera,
  Zap,
  Compass,
  Video,
  Sparkles,
  Layers,
  Clock,
} from "lucide-react";
import type { HomeContinueGameData, HomeSuggestedGameData } from "@/lib/firebase/services/home";

export interface HomeGamesSectionProps {
  continueGame: HomeContinueGameData | null;
  suggestedGame?: HomeSuggestedGameData | null;
}

interface GameExperienceHighlight {
  id: string;
  title: string;
  cue: string;
  duration: string;
  playStyle: string;
  accent: string;
  href: string;
  icon: React.ElementType;
}

const TOGETHERPLAY_SIX_EXPERIENCES: GameExperienceHighlight[] = [
  {
    id: "find_it_first",
    title: "Find It First",
    cue: "Dual-camera real-world artifact detection duel",
    duration: "4 mins",
    playStyle: "Object Vision Duel",
    accent: "text-brand",
    href: "/play/find-it-first",
    icon: Camera,
  },
  {
    id: "speed_duel",
    title: "Speed Duel",
    cue: "High-tension audio tone shifts and millisecond sensory reflex",
    duration: "3 mins",
    playStyle: "Reflex Tension",
    accent: "text-warning",
    href: "/play/speed-duel",
    icon: Zap,
  },
  {
    id: "couple_race",
    title: "Couple Race",
    cue: "Synchronized reflex journey across distance",
    duration: "8 mins",
    playStyle: "Cooperative Journey",
    accent: "text-brand",
    href: "/play/couple_race",
    icon: Compass,
  },
  {
    id: "camera_challenge",
    title: "Camera Challenge",
    cue: "Spontaneous mirror poses and reciprocal live gestures",
    duration: "3 mins",
    playStyle: "Live Video Event",
    accent: "text-info",
    href: "/play/camera-challenge",
    icon: Video,
  },
  {
    id: "ai_challenge",
    title: "AI Challenge",
    cue: "Gemini-crafted dynamic quest adapted to your shared history",
    duration: "5 mins",
    playStyle: "Generative Quest",
    accent: "text-brand",
    href: "/play/ai_challenge",
    icon: Sparkles,
  },
  {
    id: "ai_game_night",
    title: "AI Game Night",
    cue: "Curated 5-round private evening anthology for two",
    duration: "15 mins",
    playStyle: "Private Evening",
    accent: "text-brand",
    href: "/play/ai_game_night",
    icon: Layers,
  },
];

export const HomeGamesSection: React.FC<HomeGamesSectionProps> = ({
  continueGame,
  suggestedGame,
}) => {
  return (
    <section className="flex flex-col w-full space-y-4">
      {/* Section Header: Act 4 (Play) */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-soft-sage" />
          <h3 className="text-sm font-semibold text-warm-cream tracking-tight">
            Play Anthology
          </h3>
        </div>
        <Link
          href="/play"
          className="text-xs font-mono text-soft-stone hover:text-warm-cream flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-brand transition-colors"
        >
          <span>Catalog (6)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 1. Continue Session (When in-progress game exists) */}
      {continueGame && (
        <div className="p-5 sm:p-6 rounded-3xl bg-surface border border-border/80 shadow-elevation-md flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-brand font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse motion-reduce:animate-none" />
              Active Game Session
            </span>
            <span className="text-soft-sage">{continueGame.roundLabel}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-display text-base sm:text-lg text-warm-cream">
                {continueGame.title}
              </h4>
              <p className="text-xs text-soft-stone mt-0.5">
                {continueGame.subtitle}
              </p>
            </div>

            <Link
              href={continueGame.href}
              className="self-start sm:self-auto px-4 py-2 rounded-xl bg-brand text-text-on-mint font-semibold text-xs transition-all hover:bg-brand-hover active:scale-95 flex items-center gap-1.5 shadow-sm focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{continueGame.actionLabel}</span>
            </Link>
          </div>

          {/* Progress Track */}
          <div className="w-full bg-surface-charcoal rounded-full h-1.5 overflow-hidden border border-border/50">
            <div
              className="bg-brand h-full rounded-full transition-all duration-500"
              style={{ width: `${continueGame.progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* 2. Tonight's Suggested Spotlight */}
      {suggestedGame && (
        <div className="p-5 sm:p-6 rounded-3xl bg-surface border border-border/80 shadow-elevation-md flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-soft-sage font-medium">Tonight&apos;s Recommendation</span>
            {suggestedGame.affinityBonus && (
              <span className="text-soft-stone">{suggestedGame.affinityBonus}</span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h4 className="font-display text-base sm:text-lg text-warm-cream">
                {suggestedGame.title}
              </h4>
              <p className="text-xs text-soft-stone leading-relaxed line-clamp-2">
                {suggestedGame.description}
              </p>
            </div>

            <Link
              href={suggestedGame.href}
              className="self-start sm:self-auto shrink-0 px-4 py-2 rounded-xl bg-surface-charcoal border border-border-strong text-warm-cream hover:bg-surface-raised font-semibold text-xs tracking-tight transition-all active:scale-95 flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Launch Game</span>
            </Link>
          </div>

          <div className="pt-2 border-t border-border/60 flex items-center gap-2 text-xs font-mono text-soft-sage">
            <Clock className="w-3.5 h-3.5 text-soft-stone" />
            <span className="font-tabular">{suggestedGame.durationLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{suggestedGame.badgeLabel}</span>
          </div>
        </div>
      )}

      {/* 3. The 6 Distinct Experiences Grid (Distinct visual cues & typography) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {TOGETHERPLAY_SIX_EXPERIENCES.map((exp) => {
          const Icon = exp.icon;
          return (
            <Link
              key={exp.id}
              href={exp.href}
              className="p-3.5 sm:p-4 rounded-xl bg-surface hover:bg-surface-raised border border-border hover:border-brand/40 transition-all flex flex-col justify-between gap-2.5 group focus-visible:outline-2 focus-visible:outline-brand"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 group-hover:border-brand/50 transition-colors">
                    <Icon className={`w-4 h-4 ${exp.accent}`} />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-text-primary group-hover:text-brand transition-colors">
                      {exp.title}
                    </h5>
                    <span className="text-[10px] font-mono text-text-muted">
                      {exp.playStyle}
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-mono font-tabular text-text-muted">
                  {exp.duration}
                </span>
              </div>

              <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                {exp.cue}
              </p>

              <div className="flex items-center justify-end text-xs font-mono text-text-muted group-hover:text-brand transition-colors pt-1 border-t border-border/40">
                <span className="text-[11px]">Enter Game</span>
                <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

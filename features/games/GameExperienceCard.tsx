"use client";

import React, { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { GameExperienceMetadata } from "@/types/domain";
import {
  Clock,
  Gauge,
  Swords,
  Heart,
  Video,
  Sparkles,
  Play,
  Search,
  Zap,
  Compass,
  RefreshCw,
  Camera,
  Layers,
  Flame,
} from "lucide-react";

export interface GameExperienceCardProps {
  game: GameExperienceMetadata;
  onPlayTogether?: (gameId: string) => void;
}

export const GameExperienceCard: React.FC<GameExperienceCardProps> = ({
  game,
  onPlayTogether,
}) => {
  const [quickQuestionChoice, setQuickQuestionChoice] = useState<number | null>(null);
  const [aiPromptIndex, setAiPromptIndex] = useState(0);

  const aiPrompts = [
    "&ldquo;Find something in Tokyo that shares the color of Alex's favorite London coat.&rdquo;",
    "&ldquo;A souvenir or ticket stub from a trip you still reminisce about late at night.&rdquo;",
    "&ldquo;Write down the one inside joke that always makes the other laugh instantly.&rdquo;",
  ];

  const isCoop =
    game.playStyle === "Cooperative" ||
    game.playStyle === "Synchrony & Insight";
  const isCompetitive = game.playStyle.includes("Competitive") || game.playStyle.includes("Duel");

  return (
    <article
      id={`game-experience-card-${game.id}`}
      className={cn(
        "group relative rounded-2xl bg-surface border border-border p-5 sm:p-6 flex flex-col justify-between space-y-4 transition-all duration-300 hover:border-border-strong hover:bg-surface-raised shadow-elevation-sm hover:shadow-elevation-md",
        game.id === "ai_game_night" &&
          "bg-gradient-to-b from-surface via-surface to-background border-border-strong shadow-elevation-md"
      )}
    >
      {/* Top Header: Unboxed metadata & Title */}
      <div className="flex flex-col space-y-2 relative z-10">
        <div className="flex items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2 text-soft-sage">
            <span className="font-medium text-cream">{game.badgeLabel}</span>
            <span aria-hidden="true" className="text-border-strong">·</span>
            <span className="flex items-center gap-1 text-soft-sage">
              <Clock className="w-3 h-3 text-soft-sage" />
              <span className="font-tabular">{game.duration}</span>
            </span>
          </div>

          <div className="flex items-center gap-1 font-mono text-soft-sage text-[11px]">
            {isCoop ? (
              <span className="inline-flex items-center gap-1 text-soft-sage">
                <Heart className="w-3.5 h-3.5 text-soft-sage" />
                <span>Co-op</span>
              </span>
            ) : isCompetitive ? (
              <span className="inline-flex items-center gap-1 text-warning">
                <Swords className="w-3.5 h-3.5" />
                <span>Duel</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-soft-sage">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Synchrony</span>
              </span>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-display text-lg sm:text-xl text-cream tracking-tight group-hover:text-cream transition-colors">
            {game.title}
          </h3>
          <p className="text-xs text-soft-sage font-mono mt-0.5">
            {game.subtitle}
          </p>
        </div>

        <p className="text-xs sm:text-sm text-text-secondary leading-relaxed line-clamp-2">
          {game.description}
        </p>
      </div>

      {/* DISTINCTIVE VISUAL IDENTITIES PER GAME */}
      <div className="relative z-10 my-1">
        {/* 1. FIND IT FIRST: Visual Search Language (Viewfinder Reticle & Item Hunt) */}
        {game.id === "find_it_first" && (
          <div className="rounded-xl bg-deep-forest border border-border p-3.5 flex flex-col space-y-2.5 overflow-hidden relative">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="flex items-center gap-1.5 text-soft-sage font-medium">
                <Search className="w-3.5 h-3.5 text-cream" />
                Visual Viewfinder HUD
              </span>
              <span className="text-soft-sage/80">Dual Camera Active</span>
            </div>
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-8 flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-lg border border-border bg-surface flex items-center justify-center shrink-0">
                  <div className="absolute inset-1 border border-dashed border-border rounded" />
                  <Camera className="w-5 h-5 text-cream" />
                </div>
                <div className="flex flex-col text-xs">
                  <span className="font-semibold text-cream">Target Item: Pocket Keepsake</span>
                  <span className="text-[10px] font-mono text-soft-sage">
                    London holding clue · Tokyo scanning
                  </span>
                </div>
              </div>
              <div className="col-span-4 text-right font-mono">
                <div className="text-[9px] uppercase tracking-wider text-soft-sage">
                  Match Speed
                </div>
                <div className="text-xs font-bold font-tabular text-cream">0.14s threshold</div>
              </div>
            </div>
          </div>
        )}

        {/* 2. SPEED DUEL: Kinetic / Reaction Language (Waveform & Tension Frequency) */}
        {game.id === "speed_duel" && (
          <div className="rounded-xl bg-deep-forest border border-border p-3.5 flex flex-col space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-soft-sage font-semibold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-cream" />
                Reflex Frequency Wave
              </span>
              <span className="text-soft-sage font-tabular">Alex 0.19s · Sam 0.22s</span>
            </div>
            {/* Kinetic Frequency Waveform: Warm Soft Sage with single peak trigger indicator */}
            <div className="flex items-center gap-1 h-7 w-full px-1">
              {[35, 65, 30, 85, 95, 50, 80, 45, 100, 60, 85, 40, 90, 70, 50, 85, 60].map(
                (h, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex-1 rounded-full transition-all duration-300",
                      idx === 8 ? "bg-brand" : "bg-soft-sage/40"
                    )}
                    style={{ height: `${h}%`, opacity: idx === 8 ? 1 : 0.4 + (idx % 3) * 0.15 }}
                  />
                )
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-soft-sage pt-0.5">
              <span>Haptic spark trigger primed</span>
              <span className="text-cream font-medium">Match Point (1 - 0)</span>
            </div>
          </div>
        )}

        {/* 3. COUPLE RACE: Playful Board / Path Language (Cartography & Caravan Trail) */}
        {game.id === "couple_race" && (
          <div className="rounded-xl bg-deep-forest border border-border p-3.5 flex flex-col space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-cream font-medium">London 51.5°N</span>
              <span className="text-cream font-semibold font-tabular">68% Meridian Path</span>
              <span className="text-cream font-medium">Tokyo 35.6°N</span>
            </div>
            {/* Playful Route Path Track */}
            <div className="relative w-full h-2 rounded-full bg-surface overflow-hidden border border-border">
              <div className="h-full bg-soft-sage rounded-full transition-all duration-500 w-[68%]" />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-soft-sage">
              <span>Weather: High-altitude Clear</span>
              <span className="text-soft-sage flex items-center gap-1">
                <Compass className="w-3 h-3 text-cream" /> Next Waypoint: Silk Road 9,560 km
              </span>
            </div>
          </div>
        )}

        {/* 4. CAMERA CHALLENGE: Photography Language (Dual Polaroid Frames) */}
        {game.id === "camera_challenge" && (
          <div className="rounded-xl bg-deep-forest border border-border p-3.5 flex items-center justify-between gap-3">
            <div className="flex -space-x-2 items-center">
              <div className="w-13 h-16 rounded-md bg-surface border border-border-strong p-1 flex flex-col justify-between shadow-sm rotate-[-3deg]">
                <div className="w-full h-10 rounded bg-deep-forest flex items-center justify-center text-xs">
                  <Camera className="w-4 h-4 text-cream" />
                </div>
                <span className="text-[8px] font-mono text-center text-soft-sage">London</span>
              </div>
              <div className="w-13 h-16 rounded-md bg-surface border border-border-strong p-1 flex flex-col justify-between shadow-sm rotate-[4deg]">
                <div className="w-full h-10 rounded bg-deep-forest flex items-center justify-center text-xs">
                  <Sparkles className="w-4 h-4 text-soft-sage" />
                </div>
                <span className="text-[8px] font-mono text-center text-soft-sage">Tokyo</span>
              </div>
            </div>
            <div className="flex-1 text-right pl-2">
              <p className="text-xs font-medium text-cream italic">
                &ldquo;Show something green on your windowsill&rdquo;
              </p>
              <span className="text-[10px] font-mono text-soft-sage">
                Reciprocal aperture snap
              </span>
            </div>
          </div>
        )}

        {/* 5. KNOW ME / QUICK QUESTIONS: Flash Choice Spark */}
        {game.id === "quick_questions" && (
          <div className="rounded-xl bg-deep-forest border border-border p-3.5 flex flex-col space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-soft-sage font-semibold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-player-one-ember" />
                Rapid Intuition Prompt
              </span>
              <span className="text-soft-sage font-tabular">60s Clock</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setQuickQuestionChoice(0)}
                className={cn(
                  "px-2.5 py-2 rounded-lg text-xs font-mono text-center border transition-all select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-brand",
                  quickQuestionChoice === 0
                    ? "bg-moss text-cream border-border-strong font-semibold shadow-sm"
                    : "bg-surface text-soft-sage border-border hover:text-cream hover:border-border-strong"
                )}
              >
                Midnight Rain
              </button>
              <button
                type="button"
                onClick={() => setQuickQuestionChoice(1)}
                className={cn(
                  "px-2.5 py-2 rounded-lg text-xs font-mono text-center border transition-all select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-brand",
                  quickQuestionChoice === 1
                    ? "bg-moss text-cream border-border-strong font-semibold shadow-sm"
                    : "bg-surface text-soft-sage border-border hover:text-cream hover:border-border-strong"
                )}
              >
                Golden Sunrise
              </button>
            </div>
          </div>
        )}

        {/* 6. AI CHALLENGE: Conversation & Prompt Language (Dynamic Dialogue Quest) */}
        {game.id === "ai_challenge" && (
          <div className="rounded-xl bg-deep-forest border border-border p-3.5 flex flex-col space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-soft-sage font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-cream" />
                Adaptive Quest
              </span>
              <button
                type="button"
                onClick={() => setAiPromptIndex((prev) => (prev + 1) % aiPrompts.length)}
                className="text-[10px] text-soft-sage hover:text-cream flex items-center gap-1 transition-colors cursor-pointer"
                title="Shuffle Quest"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>Shuffle</span>
              </button>
            </div>
            <div className="p-2.5 rounded-lg bg-surface border border-border text-xs text-cream italic min-h-[44px] flex items-center">
              <span>{aiPrompts[aiPromptIndex]}</span>
            </div>
          </div>
        )}

        {/* 7. AI GAME NIGHT: Richer Editorial Anthology Composition */}
        {(game.id === "ai_game_night" || game.id === "ai_host") && (
          <div className="rounded-xl bg-deep-forest border border-border p-3.5 flex flex-col space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-soft-sage font-semibold flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-cream" />
                Curated 5-Round Sequence
              </span>
              <span className="text-soft-sage">Private Host Standing By</span>
            </div>
            {/* 5 Round Sequence Ribbon */}
            <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-mono">
              <div className="p-1.5 rounded-lg bg-surface border border-border">
                <div className="text-cream font-bold">R1</div>
                <div className="text-[9px] text-soft-sage truncate">Find It</div>
              </div>
              <div className="p-1.5 rounded-lg bg-surface border border-border">
                <div className="text-cream font-bold">R2</div>
                <div className="text-[9px] text-soft-sage truncate">Question</div>
              </div>
              <div className="p-1.5 rounded-lg bg-surface border border-border">
                <div className="text-cream font-bold">R3</div>
                <div className="text-[9px] text-soft-sage truncate">Camera</div>
              </div>
              <div className="p-1.5 rounded-lg bg-surface border border-border">
                <div className="text-cream font-bold">R4</div>
                <div className="text-[9px] text-soft-sage truncate">Speed</div>
              </div>
              <div className="p-1.5 rounded-lg bg-moss border border-border-strong">
                <div className="text-cream font-bold">R5</div>
                <div className="text-[9px] text-soft-sage truncate font-medium">Finale</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* METADATA MATRIX (Clean unboxed grid with soft sage metadata) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/60 text-xs font-mono relative z-10">
        <div className="flex flex-col">
          <span className="text-[10px] text-soft-sage uppercase tracking-wider">
            Difficulty
          </span>
          <span className="text-cream font-medium mt-0.5 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-soft-sage" />
            {game.difficulty}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] text-soft-sage uppercase tracking-wider">
            Style
          </span>
          <span className="text-cream font-medium mt-0.5 truncate">
            {game.playStyle}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] text-soft-sage uppercase tracking-wider">
            Video
          </span>
          <span className="text-cream font-medium mt-0.5 truncate flex items-center gap-1">
            <Video className="w-3 h-3 text-soft-sage" />
            {game.videoSupport}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] text-soft-sage uppercase tracking-wider">
            AI Engine
          </span>
          <span className="text-cream font-medium mt-0.5 truncate flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-soft-sage" />
            {game.aiSupport}
          </span>
        </div>
      </div>

      {/* PRIMARY ACTION: PLAY TOGETHER (Acid Mint as the single focused CTA) */}
      <div className="pt-2 flex items-center justify-between gap-3 border-t border-border/60 relative z-10">
        <span className="text-xs font-mono text-soft-sage flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
          <span>2-Player Synchronized</span>
        </span>

        <Link
          id={`play-together-btn-${game.id}`}
          href={game.href}
          onClick={() => onPlayTogether?.(game.id)}
          className="flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl font-semibold text-xs tracking-tight transition-all duration-200 shadow-sm active:scale-95 select-none bg-brand text-text-on-mint hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Play together</span>
        </Link>
      </div>
    </article>
  );
};

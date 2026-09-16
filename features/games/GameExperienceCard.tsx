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
  Camera,
  Compass,
  Search,
  Zap,
  Brain,
  MessageCircleQuestion,
  Wand2,
  RefreshCw,
  Flame,
  Check,
  Shield,
  Layers,
} from "lucide-react";

export interface GameExperienceCardProps {
  game: GameExperienceMetadata;
  onPlayTogether?: (gameId: string) => void;
}

export const GameExperienceCard: React.FC<GameExperienceCardProps> = ({
  game,
  onPlayTogether,
}) => {
  // Local state for interactive vignettes inside cards
  const [quickQuestionChoice, setQuickQuestionChoice] = useState<number | null>(null);
  const [speedDuelHeld, setSpeedDuelHeld] = useState(false);
  const [aiPromptIndex, setAiPromptIndex] = useState(0);

  const aiPrompts = [
    "&ldquo;Find something in Tokyo that shares the color of Alex's favorite London coat.&rdquo;",
    "&ldquo;A souvenir or ticket stub from a trip you still reminisce about at night.&rdquo;",
    "&ldquo;Write down the one inside joke that always makes the other laugh on call.&rdquo;",
  ];

  const isCoop =
    game.playStyle === "Cooperative" ||
    game.playStyle === "Synchrony & Insight";
  const isCompetitive = game.playStyle.includes("Competitive") || game.playStyle.includes("Duel");

  return (
    <article
      id={`game-experience-card-${game.id}`}
      className={cn(
        "group relative rounded-2xl bg-surface-raised border border-subtle-border/80 p-5 sm:p-6 flex flex-col justify-between space-y-4 transition-all duration-300 hover:border-shared-amber/40 hover:bg-surface-raised/95 hover:-translate-y-0.5 hover:shadow-lg",
        game.id === "ai_game_night" &&
          "bg-gradient-to-b from-surface-raised via-surface-raised to-surface-deep border-shared-amber/30 shadow-md"
      )}
    >
      {/* Ambient background glow for atmosphere */}
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 rounded-full bg-shared-amber/[0.03] group-hover:bg-shared-amber/[0.07] blur-3xl pointer-events-none transition-all duration-500" />

      {/* Top Header: Badge, Category, & Title */}
      <div className="flex flex-col space-y-2 relative z-10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {game.badgeLabel && (
              <span
                id={`game-badge-${game.id}`}
                className={cn(
                  "text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full font-semibold border",
                  game.badgeVariant === "amber"
                    ? "bg-shared-amber/15 text-shared-amber border-shared-amber/30"
                    : game.badgeVariant === "sage"
                    ? "bg-player-two-sage/15 text-player-two-sage border-player-two-sage/30"
                    : game.badgeVariant === "ember"
                    ? "bg-player-one-ember/15 text-player-one-ember border-player-one-ember/30"
                    : "bg-surface-container text-on-surface-variant border-subtle-border"
                )}
              >
                {game.badgeLabel}
              </span>
            )}
            <span className="text-[11px] font-mono text-on-surface-variant flex items-center gap-1">
              <Clock className="w-3 h-3 text-shared-amber/80" />
              {game.duration}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono text-on-surface-variant/90">
            {isCoop ? (
              <span className="inline-flex items-center gap-1 text-player-two-sage">
                <Heart className="w-3.5 h-3.5 fill-player-two-sage/20" />
                <span>Co-op</span>
              </span>
            ) : isCompetitive ? (
              <span className="inline-flex items-center gap-1 text-player-one-ember">
                <Swords className="w-3.5 h-3.5" />
                <span>Duel</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-shared-amber">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Synchrony</span>
              </span>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-on-surface tracking-tight group-hover:text-shared-amber transition-colors">
            {game.title}
          </h3>
          <p className="text-xs text-on-surface-variant font-mono mt-0.5">
            {game.subtitle}
          </p>
        </div>

        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed line-clamp-2">
          {game.description}
        </p>
      </div>

      {/* DISTINCTIVE VISUAL IDENTITY EXPERIENCES */}
      <div className="relative z-10 my-1">
        {/* 1. FIND IT FIRST: Tactical Artifact Reticle */}
        {game.id === "find_it_first" && (
          <div className="rounded-xl bg-surface-deep border border-subtle-border p-3.5 flex flex-col space-y-2.5 overflow-hidden relative">
            <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant">
              <span className="flex items-center gap-1 text-shared-amber font-semibold">
                <Search className="w-3 h-3" />
                Tactile Viewfinder HUD
              </span>
              <span className="text-player-two-sage">Dual Camera Active</span>
            </div>
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-8 flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-lg border border-shared-amber/40 bg-surface-container flex items-center justify-center shrink-0">
                  <div className="absolute inset-1 border border-dashed border-shared-amber/30 rounded" />
                  <span className="text-lg">🕰️</span>
                </div>
                <div className="flex flex-col text-xs">
                  <span className="font-semibold text-on-surface">Target Clue: Pocket Watch</span>
                  <span className="text-[10px] font-mono text-on-surface-variant">
                    London holding clue · Tokyo scanning
                  </span>
                </div>
              </div>
              <div className="col-span-4 text-right font-mono">
                <div className="text-[9px] uppercase tracking-wider text-on-surface-variant">
                  Match speed
                </div>
                <div className="text-xs font-bold text-shared-amber">0.14s threshold</div>
              </div>
            </div>
          </div>
        )}

        {/* 2. SPEED DUEL: Pulse Frequency Wave & Tension Gauge */}
        {game.id === "speed_duel" && (
          <div className="rounded-xl bg-surface-deep border border-subtle-border p-3.5 flex flex-col space-y-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-player-one-ember font-semibold flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Reflex Delta: 30ms
              </span>
              <span className="text-on-surface-variant">Alex 0.19s vs Sam 0.22s</span>
            </div>
            {/* Visual Waveform */}
            <div className="flex items-center gap-1 h-6 w-full px-1">
              {[40, 65, 30, 85, 95, 50, 75, 45, 100, 60, 80, 35, 90, 70, 45, 85, 60].map(
                (h, idx) => (
                  <div
                    key={idx}
                    className="flex-1 rounded-full bg-gradient-to-t from-player-one-ember to-shared-amber transition-all duration-300"
                    style={{ height: `${h}%`, opacity: 0.35 + (idx % 3) * 0.25 }}
                  />
                )
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant pt-0.5">
              <span>Haptic spark pad ready</span>
              <span className="text-player-one-ember">Match Point (1 - 0)</span>
            </div>
          </div>
        )}

        {/* 3. COUPLE RACE: The Great Meridian Transcontinental Map */}
        {game.id === "couple_race" && (
          <div className="rounded-xl bg-surface-deep border border-subtle-border p-3.5 flex flex-col space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-player-one-ember">London 51.5°N</span>
              <span className="text-shared-amber font-semibold">68% Synchronized Caravan</span>
              <span className="text-player-two-sage">Tokyo 35.6°N</span>
            </div>
            {/* Expedition Progress track */}
            <div className="relative w-full h-2 rounded-full bg-surface-container overflow-hidden">
              <div className="h-full bg-gradient-to-r from-player-one-ember via-shared-amber to-player-two-sage w-[68%]" />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant">
              <span>Weather: Meridian Gale Storm</span>
              <span className="text-player-two-sage flex items-center gap-1">
                <Compass className="w-3 h-3" /> Next Waypoint: Silk Road
              </span>
            </div>
          </div>
        )}

        {/* 4. CAMERA CHALLENGE: Dual Polaroid Snapshot Frames */}
        {game.id === "camera_challenge" && (
          <div className="rounded-xl bg-surface-deep border border-subtle-border p-3 flex items-center justify-between gap-3">
            <div className="flex -space-x-3 items-center">
              <div className="w-14 h-16 rounded bg-surface-container-highest border border-canvas-sand/20 p-1 flex flex-col justify-between shadow-md rotate-[-3deg]">
                <div className="w-full h-10 rounded-xs bg-surface-container flex items-center justify-center text-xs">
                  🌿
                </div>
                <span className="text-[8px] font-mono text-center text-on-surface-variant">London</span>
              </div>
              <div className="w-14 h-16 rounded bg-surface-container-highest border border-canvas-sand/20 p-1 flex flex-col justify-between shadow-md rotate-[4deg]">
                <div className="w-full h-10 rounded-xs bg-surface-container flex items-center justify-center text-xs">
                  ☕
                </div>
                <span className="text-[8px] font-mono text-center text-on-surface-variant">Tokyo</span>
              </div>
            </div>
            <div className="flex-1 text-right">
              <p className="text-xs font-medium text-on-surface italic">
                &ldquo;Show something green on your windowsill&rdquo;
              </p>
              <span className="text-[10px] font-mono text-player-two-sage">
                Instant rear camera snap
              </span>
            </div>
          </div>
        )}

        {/* 5. KNOW ME: Resonance Keyholes & Double-Blind Answer Seal */}
        {game.id === "know_me" && (
          <div className="rounded-xl bg-surface-deep border border-subtle-border p-3.5 flex flex-col space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-player-two-sage flex items-center gap-1">
                <Brain className="w-3 h-3" />
                Blind Synchrony Quiz
              </span>
              <span className="text-shared-amber font-semibold">84% Wavelength Overlap</span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-container/60 border border-subtle-border/60 flex items-center justify-between gap-2">
              <span className="text-xs text-on-surface italic">
                &ldquo;What is a quiet habit of mine you find endearing?&rdquo;
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-deep text-shared-amber border border-shared-amber/30 shrink-0">
                Sealed until reveal
              </span>
            </div>
          </div>
        )}

        {/* 6. QUICK QUESTIONS: 60-Second Flash Choice Spark */}
        {game.id === "quick_questions" && (
          <div className="rounded-xl bg-surface-deep border border-subtle-border p-3.5 flex flex-col space-y-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-shared-amber font-semibold flex items-center gap-1">
                <Flame className="w-3 h-3 text-player-one-ember" />
                Rapid Intuition Prompt
              </span>
              <span className="text-on-surface-variant">60s Clock</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setQuickQuestionChoice(0)}
                className={cn(
                  "px-2.5 py-2 rounded-lg text-xs font-mono text-center border transition-all select-none cursor-pointer",
                  quickQuestionChoice === 0
                    ? "bg-player-one-ember/20 border-player-one-ember text-player-one-ember font-semibold shadow-xs"
                    : "bg-surface-container text-on-surface-variant border-subtle-border hover:text-on-surface hover:border-subtle-border/90"
                )}
              >
                ☕ Midnight Rain
              </button>
              <button
                type="button"
                onClick={() => setQuickQuestionChoice(1)}
                className={cn(
                  "px-2.5 py-2 rounded-lg text-xs font-mono text-center border transition-all select-none cursor-pointer",
                  quickQuestionChoice === 1
                    ? "bg-player-two-sage/20 border-player-two-sage text-player-two-sage font-semibold shadow-xs"
                    : "bg-surface-container text-on-surface-variant border-subtle-border hover:text-on-surface hover:border-subtle-border/90"
                )}
              >
                🌅 Golden Sunrise
              </button>
            </div>
          </div>
        )}

        {/* 7. AI CHALLENGE: Dynamic Generative Quest Synthesizer */}
        {game.id === "ai_challenge" && (
          <div className="rounded-xl bg-surface-deep border border-shared-amber/25 p-3.5 flex flex-col space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-shared-amber font-semibold flex items-center gap-1">
                <Wand2 className="w-3 h-3" />
                Gemini Adaptive Quest
              </span>
              <button
                type="button"
                onClick={() => setAiPromptIndex((prev) => (prev + 1) % aiPrompts.length)}
                className="text-[10px] text-on-surface-variant hover:text-shared-amber flex items-center gap-1 transition-colors"
                title="Shuffle Quest"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                Shuffle
              </button>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-container/50 border border-shared-amber/20 text-xs text-canvas-sand/90 italic min-h-[44px] flex items-center">
              <span>{aiPrompts[aiPromptIndex]}</span>
            </div>
          </div>
        )}

        {/* 8. AI GAME NIGHT: Full Marquee Evening Timeline */}
        {(game.id === "ai_game_night" || game.id === "ai_host") && (
          <div className="rounded-xl bg-surface-deep border border-shared-amber/40 p-3.5 flex flex-col space-y-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-shared-amber font-semibold flex items-center gap-1">
                <Compass className="w-3 h-3" />
                Curated 5-Round Sequence
              </span>
              <span className="text-player-two-sage">Private Host Standing By</span>
            </div>
            {/* 5 Interactive Round Timeline */}
            <div className="grid grid-cols-5 gap-1 text-center text-[10px] font-mono">
              <div className="p-1.5 rounded bg-surface-container border border-subtle-border">
                <div className="text-shared-amber font-bold">R1</div>
                <div className="text-[8px] text-on-surface-variant truncate">Find It</div>
              </div>
              <div className="p-1.5 rounded bg-surface-container border border-subtle-border">
                <div className="text-player-one-ember font-bold">R2</div>
                <div className="text-[8px] text-on-surface-variant truncate">Question</div>
              </div>
              <div className="p-1.5 rounded bg-surface-container border border-subtle-border">
                <div className="text-player-two-sage font-bold">R3</div>
                <div className="text-[8px] text-on-surface-variant truncate">Camera</div>
              </div>
              <div className="p-1.5 rounded bg-surface-container border border-subtle-border">
                <div className="text-shared-amber font-bold">R4</div>
                <div className="text-[8px] text-on-surface-variant truncate">Speed</div>
              </div>
              <div className="p-1.5 rounded bg-surface-container border border-shared-amber/40 bg-shared-amber/10">
                <div className="text-shared-amber font-bold">R5</div>
                <div className="text-[8px] text-shared-amber truncate">Finale</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECONDARY METADATA MATRIX */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-subtle-border/60 text-[11px] font-mono relative z-10">
        {/* 1. Difficulty */}
        <div className="flex flex-col">
          <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">
            Difficulty
          </span>
          <span className="text-on-surface font-medium mt-0.5 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-shared-amber" />
            {game.difficulty}
          </span>
        </div>

        {/* 2. Play Style / Competitive vs Coop */}
        <div className="flex flex-col">
          <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">
            Style
          </span>
          <span className="text-on-surface font-medium mt-0.5 truncate">
            {game.playStyle}
          </span>
        </div>

        {/* 3. Video Support */}
        <div className="flex flex-col">
          <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">
            Video
          </span>
          <span className="text-on-surface font-medium mt-0.5 truncate flex items-center gap-1">
            <Video className="w-3 h-3 text-player-two-sage" />
            {game.videoSupport}
          </span>
        </div>

        {/* 4. AI Support */}
        <div className="flex flex-col">
          <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">
            AI Support
          </span>
          <span className="text-on-surface font-medium mt-0.5 truncate flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-shared-amber" />
            {game.aiSupport}
          </span>
        </div>
      </div>

      {/* PRIMARY ACTION: PLAY TOGETHER */}
      <div className="pt-2 flex items-center justify-between gap-3 border-t border-subtle-border/60 relative z-10">
        <span className="text-[11px] font-mono text-on-surface-variant flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-player-two-sage animate-pulse" />
          <span>2-Player Synchronized</span>
        </span>

        <Link
          id={`play-together-btn-${game.id}`}
          href={game.href}
          onClick={() => onPlayTogether?.(game.id)}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl font-semibold text-xs font-mono transition-all duration-200 shadow-md active:scale-95 select-none",
            game.id === "ai_game_night"
              ? "bg-shared-amber text-surface-deep hover:bg-[#e4a44b]"
              : "bg-surface-overlay text-on-surface hover:text-shared-amber hover:border-shared-amber/50 border border-subtle-border hover:bg-surface-container"
          )}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Play together</span>
        </Link>
      </div>
    </article>
  );
};

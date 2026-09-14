"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Search, Compass, Camera, Sparkles, Brain, Video, Vibrate } from "lucide-react";
import type { GameType } from "@/types/domain";

export interface GameCardProps {
  id: GameType;
  title: string;
  subtitle: string;
  description: string;
  durationLabel: string;
  tags: string[];
  badgeLabel?: string;
  badgeVariant?: "amber" | "sage" | "neutral";
  previewImageUrl?: string;
  customVisual?: "find_it_first" | "couple_race" | "camera_challenge" | "ai_host" | "know_me";
  onInspect?: () => void;
}

export const GameCard: React.FC<GameCardProps> = ({
  id,
  title,
  description,
  durationLabel,
  badgeLabel,
  badgeVariant = "amber",
  customVisual,
}) => {
  const iconMap: Partial<Record<GameType, React.ComponentType<{ className?: string }>>> = {
    find_it_first: Search,
    speed_duel: Sparkles,
    couple_race: Compass,
    camera_challenge: Camera,
    ai_host: Sparkles,
    know_me: Brain,
    quick_questions: Sparkles,
    ai_challenge: Sparkles,
    ai_game_night: Sparkles,
  };

  const Icon = iconMap[id] || Sparkles;

  return (
    <Card
      variant="raised"
      className="p-4 flex flex-col space-y-3 cursor-pointer hover:border-accent-border transition-all active:scale-[0.99]"
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center gap-2">
            {badgeLabel ? (
              <Badge variant={badgeVariant} size="sm">
                {badgeLabel}
              </Badge>
            ) : null}
            <span className="text-[11px] font-mono text-on-surface-variant">
              {durationLabel}
            </span>
          </div>
          <h4 className="text-base font-semibold text-on-surface pt-0.5">
            {title}
          </h4>
        </div>
        <span className="p-2 rounded-lg bg-surface-container text-shared-amber border border-subtle-border">
          <Icon className="w-5 h-5" />
        </span>
      </div>

      {customVisual === "find_it_first" ? (
        <div className="grid grid-cols-5 gap-3 items-center pt-1">
          <div className="col-span-3">
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {description}
            </p>
            <div className="flex items-center gap-3 pt-2.5">
              <span className="flex items-center gap-1 text-[11px] font-mono text-player-two-sage">
                <Video className="w-3.5 h-3.5" /> Video
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono text-on-surface-variant">
                <Vibrate className="w-3.5 h-3.5" /> Haptics
              </span>
            </div>
          </div>
          <div className="col-span-2 h-20 rounded-lg overflow-hidden border border-subtle-border bg-surface-deep">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://picsum.photos/seed/togetherplay-findit/300/200"
              alt="Find It First Preview"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      ) : customVisual === "couple_race" ? (
        <div className="flex flex-col space-y-2 pt-1">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {description}
          </p>
          {/* Custom Track Progress Mini-Chart */}
          <div className="w-full bg-surface-deep rounded-lg p-3 border border-subtle-border flex flex-col space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-player-one-ember">London · Checkpoint 04</span>
              <span className="text-shared-amber font-semibold">68% Synchronized</span>
              <span className="text-player-two-sage">Tokyo Destination</span>
            </div>
            <div className="relative w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
              <div className="h-full bg-gradient-to-r from-player-one-ember via-shared-amber to-player-two-sage w-[68%]" />
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant leading-relaxed">
          {description}
        </p>
      )}

      <div className="pt-2 flex items-center justify-between border-t border-subtle-border">
        <span className="text-[11px] font-mono text-on-surface-variant">
          2 Players · Private Room
        </span>
        <Link
          href={`/play/${id === "find_it_first" ? "find-it-first" : id}`}
          className="text-xs font-semibold text-shared-amber hover:underline flex items-center gap-1"
        >
          Launch Session →
        </Link>
      </div>
    </Card>
  );
};

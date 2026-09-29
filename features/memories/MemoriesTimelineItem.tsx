"use client";

import React, { useEffect, useState } from "react";
import type { CoupleMemory } from "@/lib/memories/types";
import { memoryService } from "@/lib/firebase/services/memories";
import {
  Camera,
  Gamepad2,
  Trophy,
  CalendarHeart,
  FileText,
  Clock,
  ChevronRight,
  MapPin,
} from "lucide-react";

interface MemoriesTimelineItemProps {
  memory: CoupleMemory;
  onSelect: (memory: CoupleMemory) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export const MemoriesTimelineItem: React.FC<MemoriesTimelineItemProps> = ({
  memory,
  onSelect,
}) => {
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(
    memory.media?.ephemeralUrl || null
  );
  const [hasImageError, setHasImageError] = useState(false);

  // If memory has a storage path but no resolved ephemeral URL, fetch via authenticated blob
  useEffect(() => {
    if (!resolvedImageUrl && memory.media?.storagePath) {
      let isMounted = true;
      memoryService
        .loadEphemeralMediaUrl(memory.media.storagePath)
        .then((url) => {
          if (isMounted && url) {
            setResolvedImageUrl(url);
          }
        })
        .catch(() => {});
      return () => {
        isMounted = false;
      };
    }
  }, [memory.media?.storagePath, resolvedImageUrl]);

  const getTypeIcon = () => {
    switch (memory.type) {
      case "photo":
        return <Camera className="w-3.5 h-3.5 text-player-one-ember" />;
      case "game_moment":
        return <Gamepad2 className="w-3.5 h-3.5 text-brand" />;
      case "milestone":
        return <Trophy className="w-3.5 h-3.5 text-player-two-sage" />;
      case "relationship_date":
        return <CalendarHeart className="w-3.5 h-3.5 text-player-one-ember" />;
      case "note":
      default:
        return <FileText className="w-3.5 h-3.5 text-text-muted" />;
    }
  };

  const getTypeLabel = () => {
    switch (memory.type) {
      case "photo":
        return "Shared Photo";
      case "game_moment":
        return memory.gameActivity?.gameTitle || "Game Moment";
      case "milestone":
        return "Milestone";
      case "relationship_date":
        return "Date Marker";
      case "note":
      default:
        return "Intimate Note";
    }
  };

  const getNodeColorClass = () => {
    switch (memory.type) {
      case "photo":
        return "border-player-one-ember/50 bg-player-one-ember/15 text-player-one-ember";
      case "game_moment":
        return "border-brand/50 bg-brand/15 text-brand";
      case "milestone":
        return "border-player-two-sage/50 bg-player-two-sage/15 text-player-two-sage";
      case "relationship_date":
        return "border-player-one-ember/50 bg-player-one-ember/15 text-player-one-ember";
      case "note":
      default:
        return "border-border bg-surface-raised text-text-muted";
    }
  };

  return (
    <article
      id={`memory-item-${memory.id}`}
      onClick={() => onSelect(memory)}
      className="relative flex flex-col space-y-2.5 pl-8 sm:pl-10 group cursor-pointer transition-all"
    >
      {/* Timeline Node Point on Spine */}
      <div
        className={`absolute left-2.5 sm:left-3 top-1 w-6 h-6 -translate-x-1/2 rounded-full border flex items-center justify-center transition-transform group-hover:scale-110 z-10 shadow-sm ${getNodeColorClass()}`}
      >
        {getTypeIcon()}
      </div>

      {/* Date & Type Subheader */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted">
          <span className="flex items-center gap-1 text-text-primary font-medium font-tabular">
            <Clock className="w-3 h-3 text-text-muted" />
            {memory.dateLabel}
          </span>
          <span className="text-border">·</span>
          <span className="text-text-muted capitalize">{getTypeLabel()}</span>
        </div>
        <span className="text-[10px] font-mono text-text-muted group-hover:text-brand transition-colors flex items-center gap-0.5">
          View details <ChevronRight className="w-3 h-3" />
        </span>
      </div>

      {/* Archive Artifact Card */}
      <div className="bg-surface hover:bg-surface-raised border border-border hover:border-brand/40 rounded-2xl p-4 sm:p-5 transition-all shadow-elevation-sm group-hover:shadow-elevation-md space-y-3">
        {/* Title & Author */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-display font-medium text-text-primary tracking-tight group-hover:text-brand transition-colors">
            {memory.title}
          </h3>
          <span className="shrink-0 text-[10px] font-mono text-text-muted bg-surface-raised px-2.5 py-0.5 rounded-full border border-border">
            by {memory.authorName}
          </span>
        </div>

        {/* Intimate Relationship Context */}
        <div className="flex items-start gap-2 text-xs text-text-secondary leading-relaxed bg-background-canvas rounded-xl p-3 border border-border-subtle">
          <MapPin className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
          <p className="line-clamp-2">{memory.context}</p>
        </div>

        {/* Photo Preview (Private Archive Media) */}
        {resolvedImageUrl && !hasImageError ? (
          <div className="relative rounded-xl overflow-hidden border border-border-subtle bg-background-canvas max-h-64 sm:max-h-72">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedImageUrl}
              alt={memory.title}
              referrerPolicy="no-referrer"
              onError={() => setHasImageError(true)}
              className="w-full h-full object-cover max-h-64 sm:max-h-72 transition-transform duration-500 group-hover:scale-[1.01]"
              loading="lazy"
            />
            {memory.media?.caption && (
              <div className="absolute bottom-0 inset-x-0 bg-background-canvas/90 backdrop-blur-md px-3 py-1.5 border-t border-border-subtle text-[11px] text-text-secondary font-mono">
                {memory.media.caption}
              </div>
            )}
          </div>
        ) : resolvedImageUrl && hasImageError ? (
          <div className="rounded-xl border border-border bg-background p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface border border-brand/30 flex items-center justify-center text-brand shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div className="flex flex-col text-xs">
              <span className="font-semibold text-text-primary">Archived Memory Artifact</span>
              <span className="text-[10px] font-mono text-text-muted">{memory.media?.caption || "Private couple polaroid record"}</span>
            </div>
          </div>
        ) : null}

        {/* Game Activity Highlight */}
        {memory.gameActivity && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-raised border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-text-primary">
              <Gamepad2 className="w-3.5 h-3.5 text-brand" />
              <span className="font-semibold">{memory.gameActivity.gameTitle}</span>
              {memory.gameActivity.winnerName && (
                <span className="text-player-two-sage text-[11px]">
                  · Winner: {memory.gameActivity.winnerName}
                </span>
              )}
            </div>
            {memory.gameActivity.scoreOrMetric && (
              <span className="text-[11px] text-brand bg-background-canvas px-2.5 py-0.5 rounded-lg border border-border font-medium font-tabular">
                {memory.gameActivity.scoreOrMetric}
              </span>
            )}
          </div>
        )}

        {/* Milestone Badge */}
        {memory.milestoneData && (
          <div className="flex items-center justify-between bg-player-two-sage/10 border border-player-two-sage/20 rounded-xl px-3.5 py-2.5 text-xs font-mono">
            <div className="flex items-center gap-2 text-player-two-sage">
              <Trophy className="w-4 h-4 fill-player-two-sage/20" />
              <span className="font-medium">{memory.milestoneData.metricLabel || "Milestone Reached"}</span>
            </div>
            <span className="font-bold text-player-two-sage font-tabular">
              {memory.milestoneData.metricValue}
            </span>
          </div>
        )}

        {/* Relationship Date Marker */}
        {memory.relationshipDateData && (
          <div className="flex items-center justify-between bg-player-one-ember/10 border border-player-one-ember/20 rounded-xl px-3.5 py-2.5 text-xs font-mono text-player-one-ember">
            <div className="flex items-center gap-2">
              <CalendarHeart className="w-4 h-4" />
              <span>{memory.relationshipDateData.location || "Couple Date Marker"}</span>
            </div>
            {memory.relationshipDateData.anniversaryYear && (
              <span className="font-bold">Year {memory.relationshipDateData.anniversaryYear}</span>
            )}
          </div>
        )}

        {/* Notes / Whisper Snippet */}
        {memory.note && memory.type === "note" && (
          <div className="text-xs text-text-secondary italic leading-relaxed border-l-2 border-brand/50 pl-3 py-1 font-display">
            &ldquo;{memory.note}&rdquo;
          </div>
        )}
      </div>
    </article>
  );
};

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
  Sparkles,
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
        return <Gamepad2 className="w-3.5 h-3.5 text-shared-amber" />;
      case "milestone":
        return <Trophy className="w-3.5 h-3.5 text-player-two-sage" />;
      case "relationship_date":
        return <CalendarHeart className="w-3.5 h-3.5 text-player-one-ember" />;
      case "note":
      default:
        return <FileText className="w-3.5 h-3.5 text-on-surface-variant" />;
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
        return "border-player-one-ember/40 bg-player-one-ember/10 text-player-one-ember";
      case "game_moment":
        return "border-shared-amber/40 bg-shared-amber/10 text-shared-amber";
      case "milestone":
        return "border-player-two-sage/40 bg-player-two-sage/10 text-player-two-sage";
      case "relationship_date":
        return "border-player-one-ember/40 bg-player-one-ember/10 text-player-one-ember";
      case "note":
      default:
        return "border-subtle-border bg-surface-raised text-on-surface-variant";
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
        className={`absolute left-1.5 sm:left-2 top-1 w-6 h-6 -translate-x-1/2 rounded-full border flex items-center justify-center transition-transform group-hover:scale-110 z-10 ${getNodeColorClass()}`}
      >
        {getTypeIcon()}
      </div>

      {/* Date & Type Subheader */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-mono text-on-surface-variant">
          <span className="flex items-center gap-1 text-on-surface font-medium">
            <Clock className="w-3 h-3 text-on-surface-muted" />
            {memory.dateLabel}
          </span>
          <span className="text-on-surface-muted">·</span>
          <span className="text-on-surface-muted capitalize">{getTypeLabel()}</span>
        </div>
        <span className="text-[10px] font-mono text-on-surface-muted group-hover:text-shared-amber transition-colors flex items-center gap-0.5">
          View details <ChevronRight className="w-3 h-3" />
        </span>
      </div>

      {/* Archive Artifact Card */}
      <div className="bg-surface-raised/80 hover:bg-surface-raised border border-subtle-border hover:border-shared-amber/30 rounded-xl p-4 sm:p-5 transition-all shadow-sm group-hover:shadow-md space-y-3">
        {/* Title & Author */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-medium text-on-surface tracking-tight group-hover:text-shared-amber transition-colors">
            {memory.title}
          </h3>
          <span className="shrink-0 text-[10px] font-mono text-on-surface-muted bg-surface-container/60 px-2 py-0.5 rounded-full border border-subtle-border">
            by {memory.authorName}
          </span>
        </div>

        {/* Intimate Relationship Context */}
        <div className="flex items-start gap-2 text-xs text-on-surface-variant/90 leading-relaxed bg-surface-deep/40 rounded-lg p-2.5 border border-subtle-border/50">
          <MapPin className="w-3.5 h-3.5 text-shared-amber shrink-0 mt-0.5" />
          <p className="line-clamp-2">{memory.context}</p>
        </div>

        {/* Photo Preview (Private Archive Media) */}
        {resolvedImageUrl && (
          <div className="relative rounded-lg overflow-hidden border border-subtle-border bg-surface-deep max-h-64 sm:max-h-72">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedImageUrl}
              alt={memory.title}
              className="w-full h-full object-cover max-h-64 sm:max-h-72 transition-transform duration-500 group-hover:scale-[1.01]"
              loading="lazy"
            />
            {memory.media?.caption && (
              <div className="absolute bottom-0 inset-x-0 bg-surface-deep/80 backdrop-blur-md px-3 py-1.5 border-t border-subtle-border text-[11px] text-on-surface-variant font-mono">
                {memory.media.caption}
              </div>
            )}
          </div>
        )}

        {/* Game Activity Highlight */}
        {memory.gameActivity && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-container/40 border border-subtle-border/70 rounded-lg px-3 py-2 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-on-surface">
              <Gamepad2 className="w-3.5 h-3.5 text-shared-amber" />
              <span className="font-semibold">{memory.gameActivity.gameTitle}</span>
              {memory.gameActivity.winnerName && (
                <span className="text-player-two-sage text-[11px]">
                  · Winner: {memory.gameActivity.winnerName}
                </span>
              )}
            </div>
            {memory.gameActivity.scoreOrMetric && (
              <span className="text-[11px] text-shared-amber bg-surface-raised px-2 py-0.5 rounded border border-subtle-border font-medium">
                {memory.gameActivity.scoreOrMetric}
              </span>
            )}
          </div>
        )}

        {/* Milestone Badge */}
        {memory.milestoneData && (
          <div className="flex items-center justify-between bg-player-two-sage/10 border border-player-two-sage/20 rounded-lg px-3 py-2 text-xs font-mono">
            <div className="flex items-center gap-2 text-player-two-sage">
              <Trophy className="w-4 h-4 fill-player-two-sage/20" />
              <span className="font-medium">{memory.milestoneData.metricLabel || "Milestone Reached"}</span>
            </div>
            <span className="font-bold text-player-two-sage">
              {memory.milestoneData.metricValue}
            </span>
          </div>
        )}

        {/* Relationship Date Marker */}
        {memory.relationshipDateData && (
          <div className="flex items-center justify-between bg-player-one-ember/10 border border-player-one-ember/20 rounded-lg px-3 py-2 text-xs font-mono text-player-one-ember">
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
          <div className="text-xs text-on-surface-variant italic leading-relaxed border-l-2 border-shared-amber/40 pl-3 py-0.5 font-serif">
            &ldquo;{memory.note}&rdquo;
          </div>
        )}
      </div>
    </article>
  );
};

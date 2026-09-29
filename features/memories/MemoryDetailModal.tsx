"use client";

import React, { useEffect, useState } from "react";
import type { CoupleMemory } from "@/lib/memories/types";
import { memoryService } from "@/lib/firebase/services/memories";
import {
  X,
  Clock,
  MapPin,
  Gamepad2,
  Trophy,
  CalendarHeart,
  FileText,
  Trash2,
  ShieldCheck,
} from "lucide-react";

interface MemoryDetailModalProps {
  memory: CoupleMemory | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestDelete: (memory: CoupleMemory) => void;
}

export const MemoryDetailModal: React.FC<MemoryDetailModalProps> = ({
  memory,
  isOpen,
  onClose,
  onRequestDelete,
}) => {
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!memory) {
      setResolvedImageUrl(null);
      return;
    }

    if (memory.media?.ephemeralUrl) {
      setResolvedImageUrl(memory.media.ephemeralUrl);
    } else if (memory.media?.storagePath) {
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
    } else {
      setResolvedImageUrl(null);
    }
  }, [memory]);

  if (!isOpen || !memory) return null;

  return (
    <div
      id="memory-detail-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-canvas/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        id="memory-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-detail-title"
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-2xl p-6 sm:p-7 shadow-elevation-lg space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title & Close Button */}
        <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted">
              <span className="flex items-center gap-1 text-brand font-semibold font-tabular">
                <Clock className="w-3.5 h-3.5" />
                {memory.dateLabel}
              </span>
              <span>·</span>
              <span>Preserved by {memory.authorName}</span>
            </div>
            <h2
              id="memory-detail-title"
              className="text-xl sm:text-2xl font-display font-medium text-text-primary tracking-tight"
            >
              {memory.title}
            </h2>
          </div>

          <button
            id="close-memory-detail-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors cursor-pointer"
            aria-label="Close memory details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Private Visual Media View */}
        {resolvedImageUrl && (
          <div className="space-y-2">
            <div className="relative rounded-xl overflow-hidden border border-border bg-background-canvas max-h-80 flex items-center justify-center shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolvedImageUrl}
                alt={memory.title}
                className="w-full h-full object-contain max-h-80"
              />
            </div>
            {memory.media?.caption && (
              <p className="text-xs text-text-secondary font-mono text-center">
                {memory.media.caption}
              </p>
            )}
          </div>
        )}

        {/* Intimate Context & Location */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-mono uppercase tracking-widest text-text-muted flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-brand" />
            Intimate Context &amp; Backstory
          </h4>
          <div className="bg-background-canvas border border-border-subtle rounded-xl p-4 text-xs sm:text-sm text-text-primary leading-relaxed">
            {memory.context}
          </div>
        </div>

        {/* Game Activity Section (if relevant) */}
        {memory.gameActivity && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-mono uppercase tracking-widest text-text-muted flex items-center gap-1.5">
              <Gamepad2 className="w-3.5 h-3.5 text-brand" />
              Game Activity Record
            </h4>
            <div className="bg-background-canvas border border-border-subtle rounded-xl p-4 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-text-primary">
                <span className="font-semibold">{memory.gameActivity.gameTitle}</span>
                {memory.gameActivity.scoreOrMetric && (
                  <span className="text-brand bg-surface-raised px-2.5 py-0.5 rounded border border-border font-tabular">
                    {memory.gameActivity.scoreOrMetric}
                  </span>
                )}
              </div>
              {memory.gameActivity.resultSummary && (
                <p className="text-text-secondary">{memory.gameActivity.resultSummary}</p>
              )}
              {memory.gameActivity.winnerName && (
                <p className="text-player-two-sage font-medium">
                  Authoritative Winner: {memory.gameActivity.winnerName}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Milestone Detail (if relevant) */}
        {memory.milestoneData && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-mono uppercase tracking-widest text-text-muted flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-player-two-sage" />
              Milestone Metric
            </h4>
            <div className="bg-player-two-sage/10 border border-player-two-sage/20 rounded-xl p-4 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-text-primary font-semibold block">
                  {memory.milestoneData.badgeTitle || "Milestone"}
                </span>
                <span className="text-text-muted text-[11px]">
                  {memory.milestoneData.metricLabel || "Achievement"}
                </span>
              </div>
              <span className="text-base font-bold text-player-two-sage font-tabular">
                {memory.milestoneData.metricValue}
              </span>
            </div>
          </div>
        )}

        {/* Relationship Date (if relevant) */}
        {memory.relationshipDateData && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-mono uppercase tracking-widest text-text-muted flex items-center gap-1.5">
              <CalendarHeart className="w-3.5 h-3.5 text-player-one-ember" />
              Relationship Date Marker
            </h4>
            <div className="bg-player-one-ember/10 border border-player-one-ember/20 rounded-xl p-4 space-y-1 text-xs font-mono">
              <div className="flex items-center justify-between text-player-one-ember">
                <span className="font-semibold">{memory.relationshipDateData.location}</span>
                {memory.relationshipDateData.anniversaryYear && (
                  <span>Anniversary {memory.relationshipDateData.anniversaryYear}</span>
                )}
              </div>
              {memory.relationshipDateData.reflection && (
                <p className="text-text-secondary text-[11px]">
                  {memory.relationshipDateData.reflection}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Intimate Notes / Reflections */}
        {memory.note && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-mono uppercase tracking-widest text-text-muted flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-text-muted" />
              Intimate Reflection &amp; Whispers
            </h4>
            <div className="bg-background-canvas border border-border-subtle rounded-xl p-4 text-xs sm:text-sm text-text-secondary italic leading-relaxed font-display">
              &ldquo;{memory.note}&rdquo;
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-muted">
            <ShieldCheck className="w-3.5 h-3.5 text-brand" />
            <span>Private to this couple</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="delete-memory-btn"
              onClick={() => onRequestDelete(memory)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-mono text-danger hover:bg-danger/10 border border-danger/20 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
            <button
              id="close-memory-btn"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl text-xs font-mono bg-surface-raised text-text-primary border border-border hover:bg-surface-overlay transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

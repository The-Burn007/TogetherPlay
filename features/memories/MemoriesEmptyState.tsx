"use client";

import React from "react";
import { Sparkles, Plus, BookOpen } from "lucide-react";

interface MemoriesEmptyStateProps {
  filter: string;
  onOpenUpload: () => void;
  onResetFilter?: () => void;
}

export const MemoriesEmptyState: React.FC<MemoriesEmptyStateProps> = ({
  filter,
  onOpenUpload,
  onResetFilter,
}) => {
  const isFiltered = filter !== "all";

  return (
    <div
      id="memories-empty-state"
      className="relative my-8 p-8 sm:p-12 text-center rounded-2xl border border-subtle-border bg-surface-raised/60 flex flex-col items-center justify-center space-y-4"
    >
      <div className="w-12 h-12 rounded-2xl bg-surface-deep border border-subtle-border flex items-center justify-center text-shared-amber shadow-inner">
        <BookOpen className="w-6 h-6 stroke-[1.5]" />
      </div>

      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-base sm:text-lg font-semibold text-on-surface tracking-tight">
          {isFiltered ? "No artifacts in this category" : "The Archive is Quiet"}
        </h3>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          {isFiltered
            ? "You haven't recorded any artifacts under this filter yet. Create a new memory or return to view your complete couple timeline."
            : "Every photo finish, shared discovery, and intimate milestone preserved forever. Capture your first artifact to begin your private timeline."}
        </p>
      </div>

      <div className="flex items-center gap-2 pt-2">
        {isFiltered && onResetFilter && (
          <button
            type="button"
            onClick={onResetFilter}
            className="px-4 py-2 rounded-xl text-xs font-mono bg-surface-deep border border-subtle-border text-on-surface hover:bg-surface-container transition-colors"
          >
            View All Artifacts
          </button>
        )}
        <button
          id="record-first-memory-btn"
          type="button"
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono bg-shared-amber text-surface-deep font-semibold hover:brightness-105 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Preserve Memory</span>
        </button>
      </div>
    </div>
  );
};

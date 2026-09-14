"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { GameFilterTag } from "@/types/domain";

export type FilterCategory = "all" | GameFilterTag;

export interface GameFilterBarProps {
  activeFilter: FilterCategory;
  onSelectFilter: (filter: FilterCategory) => void;
  counts?: Partial<Record<FilterCategory, number>>;
}

export const GameFilterBar: React.FC<GameFilterBarProps> = ({
  activeFilter,
  onSelectFilter,
  counts,
}) => {
  const filters: { id: FilterCategory; label: string }[] = [
    { id: "all", label: "All Experiences" },
    { id: "quick", label: "Quick" },
    { id: "competitive", label: "Competitive" },
    { id: "cooperative", label: "Cooperative" },
    { id: "camera", label: "Camera" },
    { id: "ai", label: "AI" },
  ];

  return (
    <div
      id="game-filter-bar"
      className="flex items-center gap-1.5 overflow-x-auto py-1.5 -mx-4 px-4 scrollbar-none"
    >
      {filters.map((f) => {
        const isSelected = activeFilter === f.id;
        const count = counts?.[f.id];

        return (
          <button
            key={f.id}
            id={`filter-btn-${f.id}`}
            onClick={() => onSelectFilter(f.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-mono transition-all shrink-0 flex items-center gap-1.5 border select-none",
              isSelected
                ? "bg-surface-overlay text-shared-amber border-shared-amber/50 font-medium shadow-xs"
                : "bg-surface-raised/60 text-on-surface-variant border-subtle-border/70 hover:text-on-surface hover:border-subtle-border hover:bg-surface-raised"
            )}
          >
            <span>{f.label}</span>
            {typeof count === "number" && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full",
                  isSelected
                    ? "bg-shared-amber/20 text-shared-amber font-semibold"
                    : "bg-surface-container text-on-surface-variant/80"
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};


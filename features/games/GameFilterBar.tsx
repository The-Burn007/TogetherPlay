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
      className="flex items-center gap-1.5 overflow-x-auto py-1 -mx-4 px-4 scrollbar-none"
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
              "px-3 py-1.5 rounded-xl text-xs font-mono transition-all shrink-0 flex items-center gap-1.5 border select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-brand",
              isSelected
                ? "bg-brand text-text-on-mint border-brand font-semibold shadow-sm"
                : "bg-surface text-text-secondary border-border hover:text-text-primary hover:border-brand/40"
            )}
          >
            <span>{f.label}</span>
            {typeof count === "number" && (
              <span
                className={cn(
                  "text-[10px] font-tabular",
                  isSelected
                    ? "text-text-on-mint/80 font-bold"
                    : "text-text-muted"
                )}
              >
                ({count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

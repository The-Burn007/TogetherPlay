"use client";

import React from "react";

export const MemoriesSkeleton: React.FC = () => {
  return (
    <div className="relative flex flex-col space-y-6 pt-4 animate-pulse">
      {/* Timeline spine shimmer */}
      <div className="absolute left-2.5 sm:left-3 top-4 bottom-4 w-[1px] bg-border-subtle" />

      {[1, 2, 3].map((idx) => (
        <div key={idx} className="relative flex flex-col space-y-3 pl-8 sm:pl-10">
          <div className="absolute left-2.5 sm:left-3 top-1.5 w-5 h-5 -translate-x-1/2 rounded-full border border-border bg-surface-raised flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-border" />
          </div>

          <div className="flex items-center justify-between">
            <div className="h-3 w-28 bg-surface-raised rounded-md" />
            <div className="h-3 w-16 bg-surface-raised rounded-md" />
          </div>

          <div className="bg-surface border border-border rounded-2xl p-5 space-y-3 shadow-elevation-sm">
            <div className="h-4 w-3/5 bg-surface-raised rounded-md" />
            <div className="h-3 w-4/5 bg-surface-raised/60 rounded-md" />
            <div className="h-28 w-full bg-background-canvas rounded-xl border border-border-subtle" />
          </div>
        </div>
      ))}
    </div>
  );
};

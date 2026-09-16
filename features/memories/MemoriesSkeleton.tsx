"use client";

import React from "react";

export const MemoriesSkeleton: React.FC = () => {
  return (
    <div className="relative flex flex-col space-y-6 pt-4 animate-pulse">
      {/* Timeline spine shimmer */}
      <div className="absolute left-3 top-4 bottom-4 w-[1px] bg-subtle-border/60" />

      {[1, 2, 3].map((idx) => (
        <div key={idx} className="relative flex flex-col space-y-3 pl-8 sm:pl-10">
          <div className="absolute left-1.5 sm:left-2 top-1.5 w-5 h-5 -translate-x-1/2 rounded-full border border-subtle-border bg-surface-deep flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-subtle-border" />
          </div>

          <div className="flex items-center justify-between">
            <div className="h-3 w-28 bg-surface-container rounded" />
            <div className="h-3 w-16 bg-surface-container rounded" />
          </div>

          <div className="bg-surface-raised border border-subtle-border rounded-xl p-5 space-y-3">
            <div className="h-4 w-3/5 bg-surface-container rounded" />
            <div className="h-3 w-4/5 bg-surface-container/60 rounded" />
            <div className="h-24 w-full bg-surface-deep rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
};

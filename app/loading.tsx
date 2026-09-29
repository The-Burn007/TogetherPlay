import React from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background-canvas text-center selection:bg-brand selection:text-text-on-mint">
      <div className="flex flex-col items-center justify-center space-y-4 max-w-xs">
        {/* Dual presence node pulse */}
        <div className="relative flex items-center justify-center py-2">
          <span className="absolute w-20 h-20 rounded-full bg-brand/10 blur-xl animate-pulse" />
          <div className="relative flex items-center -space-x-2">
            <div className="w-10 h-10 rounded-full bg-surface border-2 border-player-one-ember flex items-center justify-center text-player-one-ember shadow-md">
              <span className="w-2.5 h-2.5 rounded-full bg-player-one-ember animate-pulse" />
            </div>
            <div className="w-6 h-0.5 bg-brand animate-pulse" />
            <div className="w-10 h-10 rounded-full bg-surface border-2 border-player-two-sage flex items-center justify-center text-player-two-sage shadow-md">
              <span className="w-2.5 h-2.5 rounded-full bg-player-two-sage animate-pulse" />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <LoadingSpinner size="md" label="Synchronizing couple room..." />
          <p className="text-[11px] font-mono text-text-muted">
            Bridging time zones &amp; mutual presence
          </p>
        </div>
      </div>
    </div>
  );
}

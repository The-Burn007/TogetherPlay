"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { SpeedDuelArena } from "@/features/games/speed-duel/SpeedDuelArena";

function SpeedDuelContent() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get("gameId") || "speed_duel_arena";
  const playerParam = searchParams.get("player");
  const defaultPlayerId = playerParam === "sam" ? "user_sam" : "user_alex";

  return (
    <div id="speed-duel-page-wrapper" className="min-h-screen bg-background text-text-primary flex flex-col">
      {/* Top navigation bar */}
      <nav className="border-b border-border px-4 py-3 flex items-center justify-between bg-surface/90 backdrop-blur-md">
        <Link
          id="speed-duel-back-nav-link"
          href="/play"
          className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors font-medium focus-visible:outline-2 focus-visible:outline-brand rounded-lg"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Exit Arena</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          <span className="text-[11px] font-mono text-text-muted tracking-wider uppercase">
            Real-Time Sync Active
          </span>
        </div>
      </nav>

      {/* Arena container */}
      <main className="flex-1 flex flex-col">
        <SpeedDuelArena initialGameId={gameId} defaultPlayerId={defaultPlayerId} />
      </main>
    </div>
  );
}

export default function SpeedDuelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-text-muted font-mono text-sm">
          Loading Speed Duel Arena...
        </div>
      }
    >
      <SpeedDuelContent />
    </Suspense>
  );
}

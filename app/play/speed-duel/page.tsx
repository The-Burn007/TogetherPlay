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
    <div id="speed-duel-page-wrapper" className="min-h-screen bg-[#0c0b0a] text-neutral-100 flex flex-col">
      {/* Top navigation bar */}
      <nav className="border-b border-neutral-800/80 px-4 py-2.5 flex items-center justify-between">
        <Link
          id="speed-duel-back-nav-link"
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors font-medium"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Exit Arena</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[11px] font-mono text-neutral-400 tracking-wider uppercase">
            P2P Authoritative Sync Active
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
        <div className="min-h-screen bg-[#0c0b0a] flex items-center justify-center text-neutral-400 font-mono text-sm">
          Loading Speed Duel Arena...
        </div>
      }
    >
      <SpeedDuelContent />
    </Suspense>
  );
}

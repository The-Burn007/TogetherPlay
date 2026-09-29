"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CoupleRaceArena } from "@/features/games/couple-race/CoupleRaceArena";

function CoupleRaceContent() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get("gameId") || "couple_race_arena";
  const playerParam = searchParams.get("player");
  const defaultPlayerId = playerParam === "sam" ? "user_sam" : "user_alex";

  return (
    <div id="couple-race-page-wrapper" className="min-h-screen bg-background text-text-primary flex flex-col">
      {/* Top navigation bar */}
      <nav className="border-b border-border px-4 py-2.5 flex items-center justify-between bg-surface/90 backdrop-blur-md">
        <Link
          id="couple-race-back-nav-link"
          href="/play"
          className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors font-medium font-mono rounded-lg focus-visible:outline-2 focus-visible:outline-brand"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Exit Tabletop</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          <span className="text-[11px] font-mono text-text-muted tracking-wider uppercase">
            Meridian Digital Tabletop · Server Authoritative
          </span>
        </div>
      </nav>

      {/* Main Arena */}
      <main className="flex-1 flex flex-col">
        <CoupleRaceArena initialGameId={gameId} defaultPlayerId={defaultPlayerId} />
      </main>
    </div>
  );
}

export default function CoupleRacePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-text-muted font-mono text-sm">
          Setting up Meridian Tabletop...
        </div>
      }
    >
      <CoupleRaceContent />
    </Suspense>
  );
}

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
    <div id="couple-race-page-wrapper" className="min-h-screen bg-[#0d0c0b] text-stone-100 flex flex-col">
      {/* Top navigation bar */}
      <nav className="border-b border-stone-800/80 px-4 py-2 flex items-center justify-between bg-[#121110]">
        <Link
          id="couple-race-back-nav-link"
          href="/play"
          className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors font-medium font-mono"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Exit Tabletop</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[11px] font-mono text-stone-400 tracking-wider uppercase">
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
        <div className="min-h-screen bg-[#0d0c0b] flex items-center justify-center text-stone-400 font-mono text-sm">
          Setting up Meridian Tabletop...
        </div>
      }
    >
      <CoupleRaceContent />
    </Suspense>
  );
}

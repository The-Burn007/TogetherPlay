"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TogetherPlayAIGameNight } from "@/features/ai-game-night/TogetherPlayAIGameNight";
import type { GameNightVibe } from "@/lib/ai/gameNightTypes";

function AIGameNightContent() {
  const searchParams = useSearchParams();
  const vibeParam = (searchParams.get("vibe") as GameNightVibe) || "balanced";
  const p1Param = searchParams.get("p1") || "Alex";
  const p2Param = searchParams.get("p2") || "Sam";
  const city1Param = searchParams.get("c1") || "London";
  const city2Param = searchParams.get("c2") || "Tokyo";

  return (
    <TogetherPlayAIGameNight
      initialVibe={vibeParam}
      partnerNames={{ p1: p1Param, p2: p2Param }}
      partnerCities={{ p1: city1Param, p2: city2Param }}
    />
  );
}

export default function AIGameNightPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0c0b0a] flex items-center justify-center text-neutral-400 font-mono text-xs">
          Opening TogetherPlay AI Game Night Sanctuary...
        </div>
      }
    >
      <AIGameNightContent />
    </Suspense>
  );
}

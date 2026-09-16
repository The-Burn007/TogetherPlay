"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TogetherPlayAIChallengeView } from "@/features/ai-challenge/TogetherPlayAIChallengeView";
import type { AIChallengeCategory } from "@/types/domain";

function AIChallengeContent() {
  const searchParams = useSearchParams();
  const categoryParam = (searchParams.get("category") as AIChallengeCategory) || "relationship_question";

  return (
    <TogetherPlayAIChallengeView
      initialCategory={categoryParam}
      partnerNames={{ p1: "Alex", p2: "Sam" }}
      partnerCities={{ p1: "London", p2: "Tokyo" }}
    />
  );
}

export default function AIChallengePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0c0b0a] flex items-center justify-center text-neutral-400 font-mono text-xs">
          Loading TogetherPlay AI Challenge...
        </div>
      }
    >
      <AIChallengeContent />
    </Suspense>
  );
}

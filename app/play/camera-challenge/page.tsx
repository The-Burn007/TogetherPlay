"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CameraChallengeArena } from "@/features/games/camera-challenge/CameraChallengeArena";

function CameraChallengeContent() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get("gameId") || "camera_challenge_live";
  const playerParam = searchParams.get("player");
  const myUserId = playerParam === "sam" ? "user_sam" : "user_alex";
  const partnerId = myUserId === "user_alex" ? "user_sam" : "user_alex";

  return (
    <CameraChallengeArena
      gameId={gameId}
      myUserId={myUserId}
      partnerId={partnerId}
      playerNames={{ p1: "Alex", p2: "Sam" }}
      playerCities={{ p1: "London", p2: "Tokyo" }}
    />
  );
}

export default function CameraChallengePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0c0b0a] flex items-center justify-center text-amber-200 font-serif text-lg">
          Connecting Camera Challenge Event...
        </div>
      }
    >
      <CameraChallengeContent />
    </Suspense>
  );
}

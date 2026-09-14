"use client";

import React, { use } from "react";
import { MultiplayerGameLobby } from "@/features/lobby/MultiplayerGameLobby";
import type { GameType } from "@/types/domain";

export default function GameRoomPage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const resolvedParams = use(params);
  const normalizedGame = (resolvedParams.game.replace(/-/g, "_") as GameType) || "find_it_first";

  return <MultiplayerGameLobby initialGameId={normalizedGame} />;
}

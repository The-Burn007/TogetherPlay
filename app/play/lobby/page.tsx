import React from "react";
import { MultiplayerGameLobby } from "@/features/lobby/MultiplayerGameLobby";
import type { GameType } from "@/types/domain";

export const metadata = {
  title: "Game Lobby | TogetherPlay",
  description: "Private multiplayer game lobby for long-distance couples.",
};

export default async function LobbyPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const resolvedParams = await searchParams;
  const game = (resolvedParams.game as GameType) || "find_it_first";

  return <MultiplayerGameLobby initialGameId={game} />;
}

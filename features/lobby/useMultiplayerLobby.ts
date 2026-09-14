"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameType } from "@/types/domain";
import type { LobbyFlowState, LobbyPlayerInfo, LobbyConnectionStats, LobbyGameInfo } from "./types";
import { TOGETHERPLAY_GAMES } from "@/features/games/gameCatalog";
import { roomService } from "@/lib/firebase/services/rooms";

const DEFAULT_PLAYER_A: LobbyPlayerInfo = {
  id: "user_alex",
  name: "Alex",
  city: "London",
  countryCode: "GB",
  localTime: "23:14",
  weather: "14°C · Light Rain",
  colorRole: "ember",
  avatarUrl: "https://picsum.photos/seed/alex-profile-london/200/200",
  isOnline: true,
  isInLobby: true,
  isReady: false,
  videoEnabled: true,
  audioEnabled: true,
  latencyMs: 24,
};

const DEFAULT_PLAYER_B: LobbyPlayerInfo = {
  id: "user_sam",
  name: "Sam",
  city: "Tokyo",
  countryCode: "JP",
  localTime: "08:14",
  weather: "21°C · Clear Morning",
  colorRole: "sage",
  avatarUrl: "https://picsum.photos/seed/sam-profile-tokyo/200/200",
  isOnline: true,
  isInLobby: false,
  isReady: false,
  videoEnabled: true,
  audioEnabled: true,
  latencyMs: 28,
};

export function useMultiplayerLobby(initialGameId: GameType = "find_it_first") {
  const [selectedGameId, setSelectedGameId] = useState<GameType>(initialGameId);
  const [lobbyState, setLobbyState] = useState<LobbyFlowState>("waiting");
  const [sessionId, setSessionId] = useState<string>("tp-session-" + Math.random().toString(36).substring(2, 7));
  const [playerA, setPlayerA] = useState<LobbyPlayerInfo>(DEFAULT_PLAYER_A);
  const [playerB, setPlayerB] = useState<LobbyPlayerInfo>(DEFAULT_PLAYER_B);
  const [countdown, setCountdown] = useState<number>(3);
  const [lastWhisperSent, setLastWhisperSent] = useState<string | null>(null);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Connection metadata reflecting current state
  const connectionStats: LobbyConnectionStats = {
    status:
      lobbyState === "disconnected"
        ? "disconnected"
        : lobbyState === "waiting"
        ? "connecting"
        : "connected",
    latencyMs: lobbyState === "disconnected" ? 0 : 26,
    relayType: "Transatlantic Relay",
    packetLossPercent: lobbyState === "disconnected" ? 100 : 0.2,
    lastHeartbeatAgo: lobbyState === "disconnected" ? "14s ago" : "Just now",
  };

  // Find game metadata from catalog
  const currentGameMeta = TOGETHERPLAY_GAMES.find((g) => g.id === selectedGameId) || TOGETHERPLAY_GAMES[0];
  const selectedGame: LobbyGameInfo = {
    id: currentGameMeta.id,
    title: currentGameMeta.title,
    subtitle: currentGameMeta.subtitle,
    description: currentGameMeta.description,
    duration: currentGameMeta.duration,
    difficulty: currentGameMeta.difficulty,
    playStyle: currentGameMeta.playStyle,
    videoSupport: currentGameMeta.videoSupport,
    aiSupport: currentGameMeta.aiSupport,
    badgeLabel: currentGameMeta.badgeLabel || "Featured",
  };

  // Synchronize Countdown when entering "starting" state
  useEffect(() => {
    if (lobbyState === "starting") {
      setCountdown(3);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            setLobbyState("game");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [lobbyState]);

  // Check if both are ready when in partner_joined or ready state
  useEffect(() => {
    if (lobbyState === "partner_joined" || lobbyState === "ready") {
      if (playerA.isReady && playerB.isReady) {
        setLobbyState("starting");
      } else if (playerA.isReady || playerB.isReady) {
        setLobbyState("ready");
      } else if (playerB.isInLobby) {
        setLobbyState("partner_joined");
      }
    }
  }, [playerA.isReady, playerB.isReady, playerB.isInLobby, lobbyState]);

  // FLOW ACTIONS:
  // 1. Create game: Reset room and wait for partner
  const createGame = useCallback((gameType?: GameType) => {
    if (gameType) {
      setSelectedGameId(gameType);
    }
    const newSessionId = "tp-session-" + Math.random().toString(36).substring(2, 7);
    setSessionId(newSessionId);
    setPlayerA((prev) => ({ ...prev, isReady: false }));
    setPlayerB((prev) => ({ ...prev, isInLobby: false, isReady: false }));
    setLobbyState("waiting");
    roomService.createSession("cpl_london_tokyo", gameType || selectedGameId, "user_alex").catch(() => {});
  }, [selectedGameId]);

  // 2. Partner Joins
  const partnerJoins = useCallback(() => {
    setPlayerB((prev) => ({ ...prev, isInLobby: true, isReady: false }));
    setLobbyState("partner_joined");
    roomService.joinSession(sessionId, "user_sam").catch(() => {});
  }, [sessionId]);

  // 3. Toggle Player A ready status
  const togglePlayerAReady = useCallback(() => {
    setPlayerA((prev) => {
      const nextReady = !prev.isReady;
      roomService.setReadyStatus(sessionId, "user_alex", nextReady).catch(() => {});
      return { ...prev, isReady: nextReady };
    });
  }, [sessionId]);

  // 4. Toggle Partner (Player B) ready status (for testing / remote sync)
  const togglePlayerBReady = useCallback(() => {
    setPlayerB((prev) => {
      const nextReady = !prev.isReady;
      roomService.setReadyStatus(sessionId, "user_sam", nextReady).catch(() => {});
      return { ...prev, isReady: nextReady };
    });
  }, [sessionId]);

  // 5. Simulate Disconnect state
  const triggerDisconnect = useCallback(() => {
    setLobbyState("disconnected");
  }, []);

  // 6. Reconnect
  const triggerReconnect = useCallback(() => {
    setLobbyState(playerB.isInLobby ? "partner_joined" : "waiting");
  }, [playerB.isInLobby]);

  // 7. Change selected game
  const switchGame = useCallback((gameId: GameType) => {
    setSelectedGameId(gameId);
    // Unready both when game changes so partners agree
    setPlayerA((prev) => ({ ...prev, isReady: false }));
    setPlayerB((prev) => ({ ...prev, isReady: false }));
    if (lobbyState === "ready") {
      setLobbyState("partner_joined");
    }
  }, [lobbyState]);

  // Video / Audio previews
  const togglePlayerAVideo = useCallback(() => {
    setPlayerA((prev) => ({ ...prev, videoEnabled: !prev.videoEnabled }));
  }, []);

  const togglePlayerAAudio = useCallback(() => {
    setPlayerA((prev) => ({ ...prev, audioEnabled: !prev.audioEnabled }));
  }, []);

  // Manual State Override (For seamless UI review of all 5 required states)
  const setExplicitState = useCallback((state: LobbyFlowState) => {
    if (state === "waiting") {
      setPlayerA((prev) => ({ ...prev, isReady: false }));
      setPlayerB((prev) => ({ ...prev, isInLobby: false, isReady: false }));
      setLobbyState("waiting");
    } else if (state === "partner_joined") {
      setPlayerA((prev) => ({ ...prev, isReady: false }));
      setPlayerB((prev) => ({ ...prev, isInLobby: true, isReady: false }));
      setLobbyState("partner_joined");
    } else if (state === "ready") {
      setPlayerA((prev) => ({ ...prev, isReady: true }));
      setPlayerB((prev) => ({ ...prev, isInLobby: true, isReady: false }));
      setLobbyState("ready");
    } else if (state === "starting") {
      setPlayerA((prev) => ({ ...prev, isReady: true }));
      setPlayerB((prev) => ({ ...prev, isInLobby: true, isReady: true }));
      setLobbyState("starting");
    } else if (state === "disconnected") {
      setLobbyState("disconnected");
    } else if (state === "game") {
      setPlayerA((prev) => ({ ...prev, isReady: true }));
      setPlayerB((prev) => ({ ...prev, isInLobby: true, isReady: true }));
      setLobbyState("game");
    }
  }, []);

  // Send a gentle whisper / nudge to partner in Tokyo
  const sendPartnerWhisper = useCallback((message: string) => {
    setLastWhisperSent(message);
    return true;
  }, []);

  // Return to Lobby from Game
  const returnToLobby = useCallback(() => {
    setPlayerA((prev) => ({ ...prev, isReady: false }));
    setPlayerB((prev) => ({ ...prev, isReady: false }));
    setLobbyState("partner_joined");
  }, []);

  return {
    lobbyState,
    sessionId,
    selectedGame,
    playerA,
    playerB,
    countdown,
    connectionStats,
    lastWhisperSent,
    // Actions
    createGame,
    partnerJoins,
    togglePlayerAReady,
    togglePlayerBReady,
    triggerDisconnect,
    triggerReconnect,
    switchGame,
    togglePlayerAVideo,
    togglePlayerAAudio,
    setExplicitState,
    sendPartnerWhisper,
    returnToLobby,
  };
}

import type { GameType, PlayerColor, LobbyFlowState } from "@/types/domain";

export type { LobbyFlowState };

export interface LobbyPlayerInfo {
  id: string;
  name: string;
  city: string;
  countryCode: string;
  localTime: string;
  weather: string;
  colorRole: PlayerColor;
  avatarUrl: string;
  isOnline: boolean;
  isInLobby: boolean;
  isReady: boolean;
  videoEnabled: boolean;
  audioEnabled: boolean;
  latencyMs: number;
}

export interface LobbyConnectionStats {
  status: "connected" | "connecting" | "reconnecting" | "disconnected";
  latencyMs: number;
  relayType: "Direct WebRTC Mesh" | "Transatlantic Relay";
  packetLossPercent: number;
  lastHeartbeatAgo: string;
}

export interface LobbyGameInfo {
  id: GameType;
  title: string;
  subtitle: string;
  description: string;
  duration: string;
  difficulty: string;
  playStyle: string;
  videoSupport: string;
  aiSupport: string;
  badgeLabel: string;
}

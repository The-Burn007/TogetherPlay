import type {
  CoupleRaceTile,
  CoupleRacePlayerState,
  CoupleRacePowerType,
  CoupleRaceRoundHistoryItem,
} from "@/types/domain";

export type TabletopCameraMode = "perspective" | "flat" | "focus_player";

export interface CoupleRaceClientState {
  cameraMode: TabletopCameraMode;
  zoom: number; // 0.85 to 1.3
  isMuted: boolean;
  inspectingTile: CoupleRaceTile | null;
  animatingPiece: {
    playerId: string;
    from: number;
    to: number;
    current: number;
  } | null;
  selectedPower: CoupleRacePowerType | null;
  showCardDeck: boolean;
  showRulesModal: boolean;
}

export interface PlayerIdentityMeta {
  id: string;
  name: string;
  city: string;
  roleTitle: string;
  pieceName: string;
  pieceTheme: {
    primary: string;
    secondary: string;
    glow: string;
    ring: string;
    border: string;
  };
}

export const PLAYER_METAS: Record<string, PlayerIdentityMeta> = {
  user_alex: {
    id: "user_alex",
    name: "Alex",
    city: "London",
    roleTitle: "Navigator A",
    pieceName: "Gilded Astrolabe",
    pieceTheme: {
      primary: "#d97706", // amber-600
      secondary: "#fef3c7", // amber-100
      glow: "rgba(245, 158, 11, 0.4)",
      ring: "border-amber-400",
      border: "#b45309",
    },
  },
  user_sam: {
    id: "user_sam",
    name: "Sam",
    city: "Tokyo",
    roleTitle: "Navigator B",
    pieceName: "Celadon Lotus",
    pieceTheme: {
      primary: "#059669", // emerald-600
      secondary: "#d1fae5", // emerald-100
      glow: "rgba(16, 185, 129, 0.4)",
      ring: "border-emerald-400",
      border: "#047857",
    },
  },
};

export type UserRole = "USER" | "COUPLE_MEMBER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  email?: string;
  coupleId?: string;
  timezone: string;
  createdAt: string;
  lastActiveAt: string;
  status: "active" | "disabled";
}

export interface Couple {
  coupleId: string;
  memberIds: [string, string] | string[];
  ownerId: string;
  createdAt: string;
  relationshipStartDate?: string;
  status: "active" | "deleted";
}

export type GameType = "find_it_first" | "speed_duel" | "couple_race" | "camera_challenge";

export type GameStatus =
  | "waiting"
  | "ready"
  | "countdown"
  | "playing"
  | "round_end"
  | "game_end"
  | "results";

export interface GameSession {
  gameId: string;
  coupleId: string;
  gameType: GameType;
  status: GameStatus;
  playerIds: string[];
  createdBy: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  winnerId?: string;
  schemaVersion: number;
}

export type GameActionType =
  | "JOIN_GAME"
  | "READY"
  | "START_GAME"
  | "ROLL_DICE"
  | "SELECT_CELL"
  | "SUBMIT_REACTION"
  | "SUBMIT_CAMERA_CHALLENGE"
  | "END_GAME"
  | "REMATCH";

export interface GameAction<TPayload = unknown> {
  gameId: string;
  clientActionId: string;
  type: GameActionType;
  payload: TPayload;
  clientTimestamp: number;
}

export interface GameActionResult {
  accepted: boolean;
  gameId: string;
  clientActionId: string;
  serverTimestamp: number;
  eventType: string;
  stateVersion: number;
  payload?: unknown;
}

export interface FindItFirstState {
  schemaVersion: 1;
  round: number;
  maxRounds: number;
  status: "waiting" | "playing" | "round_end" | "game_end";
  targetId: string;
  board: string[];
  scores: Record<string, number>;
  roundWinnerId?: string;
}

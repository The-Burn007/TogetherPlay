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

export interface CoupleInvite {
  inviteId: string;
  coupleId: string;
  inviterId: string;
  inviterName: string;
  tokenHash: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: string;
  createdAt: string;
  acceptedBy?: string;
}

export type GameType =
  | "find_it_first"
  | "speed_duel"
  | "couple_race"
  | "camera_challenge"
  | "know_me"
  | "quick_questions"
  | "ai_challenge"
  | "ai_game_night"
  | "ai_host";

export type GameFilterTag = "quick" | "competitive" | "cooperative" | "camera" | "ai";

export interface GameExperienceMetadata {
  id: GameType;
  title: string;
  subtitle: string;
  description: string;
  duration: string;
  difficulty: "Breeze" | "Light" | "Moderate" | "Intense" | "Thoughtful" | "Adaptive" | "Full Session";
  playStyle: "Competitive Duel" | "Cooperative" | "Synchrony & Insight" | "Co-op & Duel Blend" | "Lighthearted Duel";
  videoSupport: string;
  aiSupport: string;
  filterTags: GameFilterTag[];
  badgeLabel?: string;
  badgeVariant?: "amber" | "sage" | "ember" | "neutral";
  href: string;
}

export type GameStatus =
  | "waiting"
  | "ready"
  | "countdown"
  | "playing"
  | "round_end"
  | "game_end"
  | "results";

export type PlayerColor = "ember" | "sage";

export interface PartnerTelemetry {
  city: string;
  countryCode: string;
  localTime: string;
  weather: string;
  temperatureCelsius: number;
  isOnline: boolean;
  activeScreen?: string;
  lastSeenMs: number;
  latencyMs?: number;
  statusState?: "online" | "offline" | "in_game" | "in_call";
  currentActivity?: string;
}

export interface PartnerPresence {
  userId: string;
  displayName: string;
  colorRole: PlayerColor;
  avatarUrl?: string;
  telemetry: PartnerTelemetry;
}

export interface QuickSparkPrompt {
  id: string;
  question: string;
  partnerAnswered: boolean;
  partnerAnsweredTimeAgo?: string;
  revealed: boolean;
  userAnswer?: string;
  partnerAnswer?: string;
}

export type MemoryType = "duel_finish" | "camera_quest" | "milestone" | "voice_note";

export interface MemoryItem {
  id: string;
  title: string;
  dateLabel: string;
  tag: string;
  description: string;
  type: MemoryType;
  playerOneMedia?: {
    imageUrl?: string;
    caption: string;
    reactionTimeMs?: number;
    city: string;
  };
  playerTwoMedia?: {
    imageUrl?: string;
    caption: string;
    reactionTimeMs?: number;
    city: string;
  };
  audioNote?: {
    author: string;
    durationLabel: string;
    url?: string;
  };
  highlightStat?: {
    label: string;
    value: string;
    pts: string;
  };
}

export interface TimeCapsule {
  id: string;
  draftText: string;
  unlockTimeUtc: string;
  unlockTargetCity: string;
  isSealed: boolean;
}

export interface GameItemMetadata {
  id: GameType;
  title: string;
  subtitle: string;
  description: string;
  durationLabel: string;
  tags: ("all" | "video" | "reflex" | "talk" | "coop")[];
  iconName: string;
  badgeLabel?: string;
  playerColorTag?: PlayerColor;
  previewImageUrl?: string;
  quote?: string;
}

export type LobbyFlowState =
  | "waiting"
  | "partner_joined"
  | "ready"
  | "starting"
  | "game"
  | "disconnected";

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
  winnerId?: string | null;
  schemaVersion: number;
  readyPlayerIds?: string[];
  videoStatus?: Record<string, "active" | "off" | "unavailable">;
  audioStatus?: Record<string, "active" | "muted">;
  connectionLatencyMs?: number;
  metadata?: Record<string, unknown>;
}

export type GameActionType =
  | "JOIN_GAME"
  | "READY"
  | "START_GAME"
  | "ROLL_DICE"
  | "MOVE"
  | "USE_POWER"
  | "END_TURN"
  | "PAUSE_GAME"
  | "RESUME_GAME"
  | "PLAYER_DISCONNECT"
  | "PLAYER_RECONNECT"
  | "SELECT_CELL"
  | "DRAW_CARD"
  | "SUBMIT_ANSWER"
  | "SUBMIT_REACTION"
  | "TRIGGER_TARGET"
  | "SUBMIT_CAMERA_CHALLENGE"
  | "START_COUNTDOWN"
  | "START_PERFORM"
  | "SKIP_CHALLENGE"
  | "NEXT_CHALLENGE"
  | "END_ROUND"
  | "END_GAME"
  | "REMATCH";

export interface GameAction<TPayload = unknown> {
  gameId: string;
  clientActionId: string;
  type: GameActionType | string;
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
  idempotentDuplicate?: boolean;
  payload?: unknown;
  gameState?: GameState;
  gameSession?: GameSession;
  gameResult?: GameResult;
}

/**
 * Authoritative ephemeral GameState stored in Firebase Realtime Database.
 * The server is strictly authoritative: clients can read but cannot write.
 */
export interface GameState {
  gameId: string;
  gameType: GameType;
  status: GameStatus;
  currentRound: number;
  maxRounds: number;
  version: number;
  scores: Record<string, number>;
  turnPlayerId?: string | null;
  roundStartedAtServer: number;
  roundDeadlineServer: number;
  serverTimestamp: number;
  data: Record<string, unknown>;
  processedActionIds: Record<string, number>;
  lastProcessedAction?: {
    clientActionId: string;
    type: string;
    playerId: string;
    serverTimestamp: number;
  };
  isFinished: boolean;
  winnerId?: string | null;
}

/**
 * Authoritative durable GameResult stored in Cloud Firestore.
 * Contains validated outcome, scores, and relationship memories.
 */
export interface GameResult {
  resultId: string;
  gameId: string;
  coupleId: string;
  gameType: GameType;
  playerIds: string[];
  winnerId: string | null;
  finalScores: Record<string, number>;
  totalRounds: number;
  durationSeconds: number;
  startedAt: string;
  completedAt: string;
  serverTimestamp: number;
  summary?: Record<string, unknown>;
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

export type SpeedDuelStage =
  | "ready"
  | "countdown"
  | "tension"
  | "active"
  | "round_result"
  | "game_end";

export interface SpeedDuelRoundHistoryItem {
  round: number;
  winnerId: string | null;
  reactionMs?: number;
  pointsAwarded?: number;
  speedBonus?: number;
  isFalseStart?: boolean;
  falseStartPlayerId?: string;
  scoresAtEnd: Record<string, number>;
  serverTimestamp: number;
}

export interface SpeedDuelState {
  schemaVersion: 1;
  round: number;
  maxRounds: number;
  status: SpeedDuelStage;
  scores: Record<string, number>;
  roundStage: SpeedDuelStage;
  tensionStartedAtServer: number;
  tensionDelayMs: number;
  targetAppearedAtServer: number;
  roundWinnerId: string | null;
  roundWinnerReactionMs?: number | null;
  roundWinnerReason?: "fastest_reaction" | "opponent_false_start" | null;
  playerReactions?: Record<string, number>;
  falseStarts?: Record<string, number>;
  roundHistory: SpeedDuelRoundHistoryItem[];
  competitiveMode: "first_to_3" | "standard_5";
}

export type CameraChallengeStage =
  | "challenge"
  | "countdown"
  | "perform"
  | "submit"
  | "result";

export interface CameraChallengePrompt {
  id: string;
  title: string;
  category: "expression" | "scavenger" | "pose" | "memory" | "synchrony";
  description: string;
  hint?: string;
  countdownSeconds?: number;
  durationSeconds?: number;
}

export interface CameraChallengeRoundHistoryItem {
  round: number;
  promptId: string;
  promptTitle: string;
  completedPlayerIds: string[];
  skipped?: boolean;
  serverTimestamp: number;
}

export interface CameraChallengeState {
  schemaVersion: 1;
  currentRound: number;
  maxRounds: number;
  stage: CameraChallengeStage;
  currentPrompt: CameraChallengePrompt;
  stageDeadlineServer: number;
  submissions: Record<string, { submittedAt: number; ready: boolean }>;
  skips?: Record<string, boolean>;
  roundHistory: CameraChallengeRoundHistoryItem[];
  scores: Record<string, number>;
}

export type WebRtcCallStatus =
  | "idle"
  | "requesting_permissions"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "failed"
  | "permission_denied"
  | "no_camera"
  | "no_microphone";

export interface WebRtcParticipant {
  userId: string;
  joined: boolean;
  cameraEnabled: boolean;
  micEnabled: boolean;
  hasCamera: boolean;
  hasMic: boolean;
  joinedAt: number;
  updatedAt: number;
}

export interface WebRtcSignalOffer {
  fromUserId: string;
  toUserId: string;
  sdp: { type: string; sdp: string };
  timestamp: number;
}

export interface WebRtcSignalAnswer {
  fromUserId: string;
  toUserId: string;
  sdp: { type: string; sdp: string };
  timestamp: number;
}

export interface WebRtcSignalCandidate {
  fromUserId: string;
  toUserId: string;
  candidate: {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
  };
  timestamp: number;
}

export type CoupleRacePowerType =
  | "WIND_STRIDE"
  | "DOUBLE_DICE"
  | "HARMONY_LEAP"
  | "SHIELD_AURA";

export type CoupleRaceTileType =
  | "START"
  | "REGULAR"
  | "BOOST"
  | "POWER_CACHE"
  | "HARMONY_SYNC"
  | "SCENIC_REST"
  | "CHALLENGE_GATE";

export interface CoupleRaceTile {
  index: number;
  type: CoupleRaceTileType;
  name: string;
  description: string;
  bonusPoints?: number;
  stepOffset?: number;
}

export interface CoupleRacePlayerState {
  playerId: string;
  position: number;
  lapsCompleted: number;
  powers: CoupleRacePowerType[];
  shieldActive: boolean;
  activeEffects: string[];
  totalRolls: number;
  connectionStatus: "connected" | "disconnected";
  disconnectedAt?: number | null;
}

export interface CoupleRaceRoundHistoryItem {
  turn: number;
  playerId: string;
  action: string;
  diceValue?: number;
  fromPos?: number;
  toPos?: number;
  tileType?: string;
  pointsEarned?: number;
  powerUsed?: string;
  timestamp: number;
}

export interface CoupleRaceState {
  gameType: "couple_race";
  mode: "competitive" | "cooperative";
  boardSize: number;
  targetLaps: number;
  players: Record<string, CoupleRacePlayerState>;
  currentTurnPlayerId: string;
  turnNumber: number;
  hasRolledThisTurn: boolean;
  hasMovedThisTurn: boolean;
  currentDiceValue: number | null;
  validMovePositions: number[];
  activePowerThisTurn: CoupleRacePowerType | null;
  isPaused: boolean;
  pausedByPlayerId?: string | null;
  roundHistory: CoupleRaceRoundHistoryItem[];
  cooperativeHarmonyScore?: number;
}

// ---------------------------------------------------------------------------
// TogetherPlay AI Challenge Types (Enhancement Layer Only)
// ---------------------------------------------------------------------------
export type AIChallengeCategory =
  | "relationship_question"
  | "camera_challenge"
  | "quick_game"
  | "fun_challenge"
  | "conversation_prompt";

export type AIChallengeDifficulty = "gentle" | "playful" | "deep" | "spicy";

export type AIChallengeSafetyLevel = "family_safe" | "intimate_couple";

export interface AIChallenge {
  id: string;
  title: string;
  instructions: string;
  durationSeconds: number;
  difficulty: AIChallengeDifficulty;
  category: AIChallengeCategory;
  safetyLevel: AIChallengeSafetyLevel;
  isAIGenerated: boolean;
  generatedAt: number;
  tags?: string[];
}

export interface AIChallengeRequest {
  category?: AIChallengeCategory;
  difficulty?: AIChallengeDifficulty;
  partnerNames?: { p1?: string; p2?: string };
  partnerCities?: { p1?: string; p2?: string };
  topicHint?: string;
}

export interface AIChallengeResponse {
  success: boolean;
  challenge: AIChallenge;
  isFallback: boolean;
  fallbackReason?: string;
  rateLimit?: {
    remaining: number;
    resetInSeconds: number;
  };
}




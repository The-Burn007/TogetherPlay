import type {
  GameType,
  GameState,
  PublicGameState,
  PrivateGameState,
} from "@/types/domain";

/**
 * Universal list of all confidential / secret field keys that must NEVER
 * be exposed to the browser or public game state across any game.
 */
export const FORBIDDEN_PUBLIC_FIELDS: readonly string[] = [
  // Find It First secrets
  "targetId",
  "targetName",
  "targetCode",
  "targetAnswer",
  "usedTargetIds",
  // Answer keys & test seeds
  "answerKey",
  "secretSeed",
  "diceSeed",
  "nextDiceRoll",
  "hiddenDeck",
  // Future sequence information (prevents anticipatory cheating)
  "futurePrompts",
  "upcomingPrompts",
  "upcomingRounds",
  // Server-only infrastructure credentials and system prompts
  "apiKey",
  "systemPrompt",
  "rawResponse",
  "modelConfig",
  "promptTokens",
  // Secret partner unrevealed answers
  "partnerSecretAnswer",
] as const;

/**
 * Interface representing an authoritative game state contract.
 * Each game definition declares how its public state is produced and what
 * private state is securely maintained on the server.
 */
export interface GameStateContract {
  gameType: GameType;
  /**
   * Produces a sanitized, client-safe PublicGameState from the server state.
   * Strips all confidential target fields, answer keys, or cheating vectors.
   */
  getPublicState(fullState: {
    state: GameState;
    privateState?: PrivateGameState | null;
    viewingPlayerId?: string;
  }): PublicGameState;

  /**
   * Extracts or produces the server-only PrivateGameState.
   */
  getPrivateState(fullState: {
    state: GameState;
    privateState?: PrivateGameState | null;
  }): PrivateGameState | null;

  /**
   * Specific list of forbidden fields for this game.
   */
  forbiddenFields: readonly string[];
}

/**
 * Helper to deep clone state immutably.
 */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Strips specified forbidden keys from a dictionary.
 */
function stripKeys(record: Record<string, unknown>, keysToStrip: readonly string[]): void {
  for (const key of keysToStrip) {
    if (key in record) {
      delete record[key];
    }
  }
}

// ---------------------------------------------------------------------------
// 1. Find It First Contract
// ---------------------------------------------------------------------------
const findItFirstContract: GameStateContract = {
  gameType: "find_it_first",
  forbiddenFields: [
    "targetId",
    "targetName",
    "targetCode",
    "targetAnswer",
    "usedTargetIds",
    "answerKey",
  ],
  getPublicState({ state }) {
    const publicCopy: PublicGameState = deepClone(state);
    if (publicCopy.data && typeof publicCopy.data === "object") {
      stripKeys(publicCopy.data, this.forbiddenFields);
    }
    return publicCopy;
  },
  getPrivateState({ state, privateState }) {
    if (privateState) return deepClone(privateState);
    // If state still had raw target data (e.g. legacy or test seed), extract to private
    const data = state.data || {};
    if (data.targetId || data.targetCode) {
      return {
        gameId: state.gameId,
        targetId: String(data.targetId || ""),
        targetName: String(data.targetName || ""),
        targetCode: String(data.targetCode || ""),
        targetClue: String(data.targetClue || ""),
        usedTargetIds: Array.isArray(data.usedTargetIds) ? (data.usedTargetIds as string[]) : [],
      };
    }
    return null;
  },
};

// ---------------------------------------------------------------------------
// 2. Speed Duel Contract
// ---------------------------------------------------------------------------
const speedDuelContract: GameStateContract = {
  gameType: "speed_duel",
  forbiddenFields: [
    "secretSeed",
    "targetAnswer",
    "answerKey",
    "targetId",
    "targetCode",
    "usedTargetIds",
  ],
  getPublicState({ state }) {
    const publicCopy: PublicGameState = deepClone(state);
    if (publicCopy.data && typeof publicCopy.data === "object") {
      stripKeys(publicCopy.data, this.forbiddenFields);
    }
    return publicCopy;
  },
  getPrivateState({ state, privateState }) {
    if (privateState) return deepClone(privateState);
    return null;
  },
};

// ---------------------------------------------------------------------------
// 3. Couple Race Contract
// ---------------------------------------------------------------------------
const coupleRaceContract: GameStateContract = {
  gameType: "couple_race",
  forbiddenFields: [
    "diceSeed",
    "nextDiceRoll",
    "hiddenDeck",
    "targetAnswer",
    "targetId",
  ],
  getPublicState({ state }) {
    const publicCopy: PublicGameState = deepClone(state);
    if (publicCopy.data && typeof publicCopy.data === "object") {
      stripKeys(publicCopy.data, this.forbiddenFields);
    }
    return publicCopy;
  },
  getPrivateState({ privateState }) {
    return privateState ? deepClone(privateState) : null;
  },
};

// ---------------------------------------------------------------------------
// 4. Camera Challenge Contract
// ---------------------------------------------------------------------------
const cameraChallengeContract: GameStateContract = {
  gameType: "camera_challenge",
  forbiddenFields: [
    "futurePrompts",
    "allPrompts",
    "targetAnswer",
    "targetId",
    "targetCode",
    "rawMediaBlob",
    "rawBase64",
    "permanentMediaUrl",
    "mediaSecret",
    "imageDataUri",
    "photoUrl",
    "capturedBlobUrl",
    "videoStreamToken",
  ],
  getPublicState({ state }) {
    const publicCopy: PublicGameState = deepClone(state);
    if (publicCopy.data && typeof publicCopy.data === "object") {
      stripKeys(publicCopy.data, this.forbiddenFields);
      if (publicCopy.data.submissions && typeof publicCopy.data.submissions === "object") {
        for (const pid of Object.keys(publicCopy.data.submissions as Record<string, unknown>)) {
          const sub = (publicCopy.data.submissions as Record<string, Record<string, unknown>>)[pid];
          if (sub && typeof sub === "object") {
            stripKeys(sub, [
              "rawMediaBlob",
              "rawBase64",
              "permanentMediaUrl",
              "mediaSecret",
              "imageDataUri",
              "photoUrl",
              "capturedBlobUrl",
              "videoStreamToken",
            ]);
          }
        }
      }
    }
    return publicCopy;
  },
  getPrivateState({ privateState }) {
    return privateState ? deepClone(privateState) : null;
  },
};

// ---------------------------------------------------------------------------
// 5. AI Challenge Contract
// ---------------------------------------------------------------------------
const aiChallengeContract: GameStateContract = {
  gameType: "ai_challenge",
  forbiddenFields: [
    "apiKey",
    "systemPrompt",
    "rawResponse",
    "modelConfig",
    "promptTokens",
  ],
  getPublicState({ state }) {
    const publicCopy: PublicGameState = deepClone(state);
    if (publicCopy.data && typeof publicCopy.data === "object") {
      stripKeys(publicCopy.data, this.forbiddenFields);
    }
    return publicCopy;
  },
  getPrivateState({ privateState }) {
    return privateState ? deepClone(privateState) : null;
  },
};

// ---------------------------------------------------------------------------
// 6. AI Game Night Contract
// ---------------------------------------------------------------------------
const aiGameNightContract: GameStateContract = {
  gameType: "ai_game_night",
  forbiddenFields: [
    "apiKey",
    "systemPrompt",
    "answerKey",
    "partnerSecretAnswer",
  ],
  getPublicState({ state }) {
    const publicCopy: PublicGameState = deepClone(state);
    if (publicCopy.data && typeof publicCopy.data === "object") {
      stripKeys(publicCopy.data, this.forbiddenFields);
    }
    return publicCopy;
  },
  getPrivateState({ privateState }) {
    return privateState ? deepClone(privateState) : null;
  },
};

// ---------------------------------------------------------------------------
// Generic Fallback Contract (for know_me, quick_questions, ai_host)
// ---------------------------------------------------------------------------
const defaultContract: GameStateContract = {
  gameType: "know_me",
  forbiddenFields: FORBIDDEN_PUBLIC_FIELDS,
  getPublicState({ state }) {
    const publicCopy: PublicGameState = deepClone(state);
    if (publicCopy.data && typeof publicCopy.data === "object") {
      stripKeys(publicCopy.data, FORBIDDEN_PUBLIC_FIELDS);
    }
    return publicCopy;
  },
  getPrivateState({ privateState }) {
    return privateState ? deepClone(privateState) : null;
  },
};

/**
 * Registry of contracts indexed by game type.
 */
export const GAME_STATE_CONTRACTS: Record<GameType, GameStateContract> = {
  find_it_first: findItFirstContract,
  speed_duel: speedDuelContract,
  couple_race: coupleRaceContract,
  camera_challenge: cameraChallengeContract,
  ai_challenge: aiChallengeContract,
  ai_game_night: aiGameNightContract,
  know_me: defaultContract,
  quick_questions: defaultContract,
  ai_host: defaultContract,
};

/**
 * Produces an authoritative, client-safe PublicGameState.
 * Guarantees zero leak of secret fields to browser clients.
 */
export function getPublicState(fullState: {
  state: GameState;
  privateState?: PrivateGameState | null;
  viewingPlayerId?: string;
}): PublicGameState {
  const contract = GAME_STATE_CONTRACTS[fullState.state.gameType] || defaultContract;
  const publicState = contract.getPublicState(fullState);

  // Global defense-in-depth: strip any universal forbidden fields from top-level and data
  if (publicState.data && typeof publicState.data === "object") {
    stripKeys(publicState.data, FORBIDDEN_PUBLIC_FIELDS);
  }
  stripKeys(publicState as unknown as Record<string, unknown>, FORBIDDEN_PUBLIC_FIELDS);

  return publicState;
}

/**
 * Extracts or produces the authoritative PrivateGameState for the given server state.
 */
export function getPrivateState(fullState: {
  state: GameState;
  privateState?: PrivateGameState | null;
}): PrivateGameState | null {
  const contract = GAME_STATE_CONTRACTS[fullState.state.gameType] || defaultContract;
  return contract.getPrivateState(fullState);
}

/**
 * Audit utility for tests and server runtime to verify that a given PublicGameState
 * contains zero secret/forbidden fields.
 */
export function auditPublicStateForLeaks(state: PublicGameState): {
  hasLeak: boolean;
  leakedFields: string[];
} {
  const leakedFields: string[] = [];
  const stateRecord = state as unknown as Record<string, unknown>;
  const dataRecord = (state.data || {}) as Record<string, unknown>;

  for (const forbidden of FORBIDDEN_PUBLIC_FIELDS) {
    if (forbidden in stateRecord && stateRecord[forbidden] !== undefined) {
      leakedFields.push(`state.${forbidden}`);
    }
    if (forbidden in dataRecord && dataRecord[forbidden] !== undefined) {
      leakedFields.push(`state.data.${forbidden}`);
    }
  }

  return {
    hasLeak: leakedFields.length > 0,
    leakedFields,
  };
}

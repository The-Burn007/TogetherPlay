import { authenticateServerRequest } from "./auth";

if (typeof window !== "undefined") {
  throw new Error("Security Violation: Server security utilities cannot be loaded in client browser bundle.");
}

/**
 * Server-side Security & Validation Module
 * 
 * ARCHITECTURE PRINCIPLE: THE BROWSER IS UNTRUSTED.
 * All verification must run server-side.
 */

export interface AuthContext {
  uid: string;
  email?: string;
  isAnonymous?: boolean;
}

export {
  verifyAppCheckToken,
  type AppCheckVerificationResult,
  type AppCheckVerificationOptions,
  type AppCheckErrorCode,
  extractAppCheckToken,
  appCheckErrorResponse,
  requireAppCheck,
  requireServerSecurity,
} from "./appCheck";

export type SecurityVerificationOptions = import("./appCheck").AppCheckVerificationOptions;


/**
 * Validates the basic structural integrity of a GameAction payload.
 */
export function validateActionPayloadStructure(action: unknown): {
  valid: boolean;
  error?: string;
} {
  if (!action || typeof action !== "object") {
    return { valid: false, error: "Action must be a non-null object" };
  }

  const candidate = action as Record<string, unknown>;

  if (typeof candidate.gameId !== "string" || candidate.gameId.trim().length === 0) {
    return { valid: false, error: "Action must specify a non-empty string 'gameId'" };
  }

  if (typeof candidate.clientActionId !== "string" || candidate.clientActionId.trim().length === 0) {
    return { valid: false, error: "Action must specify a unique 'clientActionId'" };
  }

  if (typeof candidate.type !== "string" || candidate.type.trim().length === 0) {
    return { valid: false, error: "Action must specify a non-empty 'type'" };
  }

  if (typeof candidate.clientTimestamp !== "number" || isNaN(candidate.clientTimestamp)) {
    return { valid: false, error: "Action must contain a numeric 'clientTimestamp'" };
  }

  if (candidate.payload === undefined) {
    return { valid: false, error: "Action must contain a 'payload' field" };
  }

  // SECURITY MANDATE: The client is UNTRUSTED.
  // Global forbidden bypass and test cheating flags are rejected on ALL actions.
  const globalForbiddenFields = [
    "isCorrectMock",
    "skipAuth",
    "skipValidation",
    "bypass",
    "mock",
    "force",
    "cheat",
    "randomSeed",
    "mockRandom",
    "testRandom",
    "injectedRandom",
    "testSeed",
    "deterministicSeed",
  ];

  for (const field of globalForbiddenFields) {
    if (field in candidate) {
      return {
        valid: false,
        error: `Client cannot submit testing/bypass field '${field}'. Authoritative outcomes are strictly server-determined.`,
      };
    }
  }

  // Reject unexpected top-level fields on GameAction candidate
  const allowedTopLevelKeys = new Set([
    "gameId",
    "clientActionId",
    "type",
    "clientTimestamp",
    "payload",
    "playerId",
    "expectedVersion",
    "version",
  ]);
  for (const key of Object.keys(candidate)) {
    if (!allowedTopLevelKeys.has(key)) {
      return {
        valid: false,
        error: `Unexpected top-level action field '${key}'.`,
      };
    }
  }

  if (candidate.payload && typeof candidate.payload === "object") {
    const payload = candidate.payload as Record<string, unknown>;

    // Global forbidden payload fields across all environments
    for (const field of globalForbiddenFields) {
      if (field in payload) {
        return {
          valid: false,
          error: `Client cannot submit bypass or mock field '${field}'. Authoritative outcomes are strictly server-determined.`,
        };
      }
    }

    // Production-strict constraint: production clients must NEVER submit authoritative fields
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
      const productionForbiddenAuthoritativeFields = [
        "score",
        "scores",
        "points",
        "pointsAwarded",
        "winner",
        "winnerId",
        "roundWinnerId",
        "winningPlayerId",
        "target",
        "targetId",
        "targetAnswer",
        "targetAppearedAtServer",
        "correct",
        "isCorrect",
        "correctAnswer",
        "answerCorrect",
        "isAnswerCorrect",
        "diceResult",
        "diceValue",
        "diceRoll",
        "serverDiceValue",
        "authoritativeTimestamp",
        "serverTime",
        "serverTimestamp",
        "roundStartedAtServer",
        "roundDeadlineServer",
        "playerIdentity",
        "gamePhase",
        "phase",
        "status",
        "gameStatus",
        "roundStage",
        "stateVersion",
        "tensionDelayMs",
        "randomCountdown",
        "countdownMs",
        "targetPlacement",
        "board",
        "shuffledBoard",
      ];

      for (const field of productionForbiddenAuthoritativeFields) {
        if (field in payload) {
          return {
            valid: false,
            error: `Production client cannot submit authoritative field '${field}'. The server is strictly authoritative.`,
          };
        }
      }
    }

    // Action-specific validations (enforced across all environments)
    if (candidate.type === "SELECT_CELL" || candidate.type === "SUBMIT_ANSWER") {
      const forbiddenFields = [
        "score",
        "scores",
        "points",
        "winner",
        "winnerId",
        "roundWinnerId",
        "correct",
        "isCorrect",
        "isCorrectMock",
        "correctAnswer",
        "answerCorrect",
        "target",
        "targetId",
        "targetAnswer",
        "serverTime",
        "serverTimestamp",
        "stateVersion",
        "diceResult",
        "diceValue",
        "status",
        "phase",
        "roundStage",
      ];

      for (const field of forbiddenFields) {
        if (field in payload) {
          return {
            valid: false,
            error: `Client cannot submit authoritative field '${field}'. The server is strictly authoritative.`,
          };
        }
      }
    }

    if (candidate.type === "TRIGGER_TARGET" || candidate.type === "SUBMIT_REACTION") {
      const forbiddenFields = [
        "targetAppearedAtServer",
        "targetTime",
        "winner",
        "winnerId",
        "roundWinnerId",
        "score",
        "scores",
        "points",
        "reactionTimeMs",
      ];

      for (const field of forbiddenFields) {
        if (field in payload) {
          return {
            valid: false,
            error: `Client cannot submit authoritative field '${field}'. The server is strictly authoritative.`,
          };
        }
      }
    }

    if (candidate.type === "MOVE") {
      const forbiddenFields = [
        "score",
        "scores",
        "winner",
        "winnerId",
        "lapsCompleted",
        "position",
      ];

      for (const field of forbiddenFields) {
        if (field in payload) {
          return {
            valid: false,
            error: `Client cannot submit authoritative field '${field}'. The server is strictly authoritative.`,
          };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Extracts authenticated user context from HTTP Authorization headers.
 * Uses Firebase Admin SDK to cryptographically verify the ID token.
 * Production does NOT support fake uid: tokens or unsigned JWTs.
 */
export async function extractAuthContext(
  source: Request | Headers | string | null | undefined
): Promise<AuthContext | null> {
  const result = await authenticateServerRequest(source);
  if (!result.success) {
    return null;
  }
  return {
    uid: result.user.uid,
    email: result.user.email,
  };
}

import {
  checkSharedRateLimitSync,
  checkSharedRateLimit,
  clearSharedRateLimitsForTesting,
  type RateLimitPromise,
  type RateLimitResult,
} from "./sharedRateLimiter";

export function clearRateLimitsForTesting(): void {
  clearSharedRateLimitsForTesting();
}

/**
 * Universal sliding window rate limiter for API endpoints.
 * Backed by Firestore shared authority across server instances with in-memory fail-safe fallback.
 */
export function checkApiRateLimit(
  key: string,
  maxRequests = 60,
  windowMs = 60000,
  ip?: string
): RateLimitPromise {
  return checkSharedRateLimitSync({
    key,
    maxRequests,
    windowMs,
    ip,
  });
}

export async function checkApiRateLimitShared(
  key: string,
  maxRequests = 60,
  windowMs = 60000,
  ip?: string
): Promise<RateLimitResult> {
  return checkSharedRateLimit({
    key,
    maxRequests,
    windowMs,
    ip,
  });
}

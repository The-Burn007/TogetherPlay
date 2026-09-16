/**
 * Authoritative Server Function: submitGameAction
 * 
 * ARCHITECTURE PRINCIPLES:
 * 1. THE BROWSER IS UNTRUSTED.
 * 2. The server is strictly authoritative over all scores, dice, cards, winners, timers, and state.
 * 3. Server-side timestamps are always used for game outcomes.
 * 4. Idempotency is strictly enforced using clientActionId.
 * 
 * VALIDATION PIPELINE:
 * 1. authenticated
 * 2. App Check valid
 * 3. game exists
 * 4. player belongs to game
 * 5. game is active
 * 6. action is valid
 * 7. action is allowed for current state
 * 8. action has not already been processed
 */

import type { GameAction, GameState, GameSession, GameResult } from "@/types/domain";
import { verifyAppCheckToken, validateActionPayloadStructure } from "./security";
import { serverGameRepository, type GameRepositoryContract } from "./gameRepository";
import { AuthoritativeGameEngine } from "./authoritativeGameEngine";

export type ActionErrorCode =
  | "UNAUTHENTICATED"
  | "APP_CHECK_INVALID"
  | "GAME_NOT_FOUND"
  | "PLAYER_NOT_IN_GAME"
  | "GAME_NOT_ACTIVE"
  | "INVALID_ACTION"
  | "INVALID_ACTION_TYPE"
  | "ACTION_DISALLOWED_FOR_STATE"
  | "INTERNAL_ERROR";

export class ActionValidationError extends Error {
  constructor(
    public code: ActionErrorCode,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "ActionValidationError";
  }
}

export interface SubmitActionServerContext {
  auth?: { uid: string; email?: string } | null;
  appCheckToken?: string | null;
  enforceAppCheck?: boolean;
  serverTimestamp?: number;
  repository?: GameRepositoryContract;
}

export interface SubmitActionResult {
  accepted: boolean;
  idempotentDuplicate: boolean;
  gameId: string;
  clientActionId: string;
  serverTimestamp: number;
  eventType: string;
  stateVersion: number;
  gameState: GameState;
  gameSession: GameSession;
  gameResult?: GameResult | null;
  payload?: Record<string, unknown>;
}

/**
 * Authoritative Server Function: submitGameAction
 * Validates and applies an untrusted client GameAction authoritatively.
 */
export async function submitGameAction(
  action: GameAction,
  context: SubmitActionServerContext
): Promise<SubmitActionResult> {
  const repo = context.repository || serverGameRepository;
  const serverTimestamp = context.serverTimestamp || Date.now();

  // -------------------------------------------------------------
  // Step 1: Authentication Validation
  // -------------------------------------------------------------
  if (!context.auth || !context.auth.uid || typeof context.auth.uid !== "string" || context.auth.uid.trim() === "") {
    throw new ActionValidationError(
      "UNAUTHENTICATED",
      "Authentication required: Request does not contain a valid authenticated user context.",
      401
    );
  }
  const playerId = context.auth.uid.trim();

  // -------------------------------------------------------------
  // Step 2: App Check Validation
  // -------------------------------------------------------------
  const appCheckResult = await verifyAppCheckToken(context.appCheckToken, {
    enforceAppCheck: context.enforceAppCheck ?? true,
  });
  if (!appCheckResult.valid) {
    throw new ActionValidationError(
      "APP_CHECK_INVALID",
      `App Check validation failed: ${appCheckResult.reason || "Invalid or missing App Check token"}.`,
      403
    );
  }

  // -------------------------------------------------------------
  // Step 6 (Preliminary): Action Structural Validation
  // -------------------------------------------------------------
  const structCheck = validateActionPayloadStructure(action);
  if (!structCheck.valid) {
    throw new ActionValidationError(
      "INVALID_ACTION",
      `Action validation failed: ${structCheck.error || "Malformed action structure"}.`,
      400
    );
  }

  // -------------------------------------------------------------
  // Step 3: Game Existence Validation
  // -------------------------------------------------------------
  const aggregate = await repo.getGameAggregate(action.gameId);
  if (!aggregate || !aggregate.session) {
    throw new ActionValidationError(
      "GAME_NOT_FOUND",
      `Game not found: Game session '${action.gameId}' does not exist.`,
      404
    );
  }
  const { session, state } = aggregate;

  // Verify action gameId matches session
  if (action.gameId !== session.gameId) {
    throw new ActionValidationError(
      "INVALID_ACTION",
      `Action gameId mismatch: '${action.gameId}' does not match target session '${session.gameId}'.`,
      400
    );
  }

  // -------------------------------------------------------------
  // Step 4: Player Membership Validation
  // -------------------------------------------------------------
  if (!session.playerIds.includes(playerId)) {
    throw new ActionValidationError(
      "PLAYER_NOT_IN_GAME",
      `Access denied: Player '${playerId}' does not belong to game '${session.gameId}'.`,
      403
    );
  }

  // -------------------------------------------------------------
  // Step 5: Game Active Validation
  // -------------------------------------------------------------
  const isGameConcluded =
    state.isFinished ||
    session.status === "game_end" ||
    session.status === "results";

  if (isGameConcluded && action.type !== "REMATCH") {
    throw new ActionValidationError(
      "GAME_NOT_ACTIVE",
      `Game is not active: Game '${session.gameId}' has already concluded with status '${session.status}'.`,
      409
    );
  }

  // -------------------------------------------------------------
  // Step 8: Idempotency Check (Has Not Already Been Processed)
  // If an action is submitted twice, execute it only once.
  // -------------------------------------------------------------
  if (state.processedActionIds && state.processedActionIds[action.clientActionId]) {
    // Action already processed! Execute only ONCE.
    // Return the cached state without re-executing state mutations.
    let existingResult: GameResult | null = null;
    if (state.isFinished) {
      existingResult = await repo.getGameResult(`res_${session.gameId}`);
    }

    return {
      accepted: true,
      idempotentDuplicate: true,
      gameId: session.gameId,
      clientActionId: action.clientActionId,
      serverTimestamp,
      eventType: action.type,
      stateVersion: state.version,
      gameState: state,
      gameSession: session,
      gameResult: existingResult,
      payload: {
        idempotent: true,
        originalProcessedAtServer: state.processedActionIds[action.clientActionId],
      },
    };
  }

  // -------------------------------------------------------------
  // Step 7: Action Allowed for Current State Validation
  // -------------------------------------------------------------
  validateActionStateAllowed(action, state, session, playerId, serverTimestamp);

  // -------------------------------------------------------------
  // Authoritative State Transition Execution
  // -------------------------------------------------------------
  const execution = AuthoritativeGameEngine.applyAction(
    session,
    state,
    action,
    playerId,
    serverTimestamp
  );

  // Persist ephemeral state to Realtime Database
  await repo.saveEphemeralGameState(execution.updatedState);

  // Persist durable session to Firestore
  await repo.saveGameSession(execution.updatedSession);

  // If game produced a durable result, persist to Firestore
  if (execution.gameResult) {
    await repo.saveGameResult(execution.gameResult);
  }

  return {
    accepted: true,
    idempotentDuplicate: false,
    gameId: session.gameId,
    clientActionId: action.clientActionId,
    serverTimestamp,
    eventType: action.type,
    stateVersion: execution.updatedState.version,
    gameState: execution.updatedState,
    gameSession: execution.updatedSession,
    gameResult: execution.gameResult,
    payload: execution.authoritativePayload,
  };
}

/**
 * Validates whether the given action type is permitted in the current game status.
 */
function validateActionStateAllowed(
  action: GameAction,
  state: GameState,
  session: GameSession,
  playerId: string,
  serverTimestamp: number
): void {
  const currentStatus = state.status;

  switch (action.type) {
    case "READY": {
      if (currentStatus !== "ready" && currentStatus !== "waiting") {
        throw new ActionValidationError(
          "ACTION_DISALLOWED_FOR_STATE",
          `Action 'READY' is not allowed when game status is '${currentStatus}'.`,
          400
        );
      }
      break;
    }

    case "START_GAME": {
      if (currentStatus !== "ready" && currentStatus !== "countdown") {
        throw new ActionValidationError(
          "ACTION_DISALLOWED_FOR_STATE",
          `Action 'START_GAME' requires all players ready or in countdown, but current status is '${currentStatus}'.`,
          400
        );
      }
      break;
    }

    case "ROLL_DICE":
    case "MOVE":
    case "USE_POWER":
    case "END_TURN":
    case "SELECT_CELL":
    case "SUBMIT_ANSWER":
    case "SUBMIT_REACTION":
    case "TRIGGER_TARGET": {
      if (currentStatus !== "playing") {
        throw new ActionValidationError(
          "ACTION_DISALLOWED_FOR_STATE",
          `Gameplay action '${action.type}' is only allowed during 'playing' state, but current state is '${currentStatus}'.`,
          400
        );
      }

      // If game is paused, reject gameplay actions until resumed
      if (state.data?.isPaused) {
        throw new ActionValidationError(
          "ACTION_DISALLOWED_FOR_STATE",
          "Game is currently paused. Resume before submitting gameplay actions.",
          400
        );
      }

      // Check authoritative timer deadline (server-side timestamp)
      if (state.roundDeadlineServer > 0 && serverTimestamp > state.roundDeadlineServer) {
        throw new ActionValidationError(
          "ACTION_DISALLOWED_FOR_STATE",
          `Round deadline has expired on the server (deadline: ${state.roundDeadlineServer}, serverTime: ${serverTimestamp}).`,
          400
        );
      }

      // Check turn order for turn-based actions
      if (
        (action.type === "ROLL_DICE" || action.type === "MOVE" || action.type === "END_TURN") &&
        state.turnPlayerId &&
        state.turnPlayerId !== playerId
      ) {
        throw new ActionValidationError(
          "ACTION_DISALLOWED_FOR_STATE",
          `It is not player '${playerId}'s turn (current turn: '${state.turnPlayerId}').`,
          400
        );
      }
      break;
    }

    case "PAUSE_GAME": {
      if (currentStatus !== "playing") {
        throw new ActionValidationError(
          "ACTION_DISALLOWED_FOR_STATE",
          `Cannot pause game when status is '${currentStatus}'.`,
          400
        );
      }
      break;
    }

    case "RESUME_GAME": {
      if (currentStatus !== "playing") {
        throw new ActionValidationError(
          "ACTION_DISALLOWED_FOR_STATE",
          `Cannot resume game when status is '${currentStatus}'.`,
          400
        );
      }
      break;
    }

    case "PLAYER_DISCONNECT":
    case "PLAYER_RECONNECT": {
      // Always permitted to track network connection lifecycle
      break;
    }

    case "NEXT_ROUND": {
      if (currentStatus !== "round_end" && currentStatus !== "playing") {
        throw new ActionValidationError(
          "ACTION_DISALLOWED_FOR_STATE",
          `Action 'NEXT_ROUND' is only allowed after a round ends, but current status is '${currentStatus}'.`,
          400
        );
      }
      break;
    }

    case "SUBMIT_CAMERA_CHALLENGE":
    case "START_COUNTDOWN":
    case "START_PERFORM":
    case "SKIP_CHALLENGE": {
      if (currentStatus !== "playing" && currentStatus !== "round_end") {
        throw new ActionValidationError(
          "ACTION_DISALLOWED_FOR_STATE",
          `Camera challenge action '${action.type}' is only allowed during active gameplay, but current status is '${currentStatus}'.`,
          400
        );
      }
      break;
    }

    case "NEXT_CHALLENGE": {
      if (currentStatus !== "round_end" && currentStatus !== "playing") {
        throw new ActionValidationError(
          "ACTION_DISALLOWED_FOR_STATE",
          `Action 'NEXT_CHALLENGE' is only allowed after a challenge completes, but current status is '${currentStatus}'.`,
          400
        );
      }
      break;
    }

    case "REMATCH": {
      const isConcluded = state.isFinished || currentStatus === "game_end" || currentStatus === "results";
      if (!isConcluded) {
        throw new ActionValidationError(
          "ACTION_DISALLOWED_FOR_STATE",
          `Action 'REMATCH' is only allowed after game conclusion, but current status is '${currentStatus}'.`,
          400
        );
      }
      break;
    }

    case "END_GAME": {
      if (currentStatus !== "playing") {
        throw new ActionValidationError(
          "ACTION_DISALLOWED_FOR_STATE",
          `Cannot end game when status is '${currentStatus}'.`,
          400
        );
      }
      break;
    }

    default: {
      const recognized = [
        "READY",
        "START_GAME",
        "ROLL_DICE",
        "MOVE",
        "USE_POWER",
        "END_TURN",
        "PAUSE_GAME",
        "RESUME_GAME",
        "PLAYER_DISCONNECT",
        "PLAYER_RECONNECT",
        "SELECT_CELL",
        "SUBMIT_ANSWER",
        "NEXT_ROUND",
        "REMATCH",
        "TRIGGER_TARGET",
        "SUBMIT_REACTION",
        "START_COUNTDOWN",
        "START_PERFORM",
        "SUBMIT_CAMERA_CHALLENGE",
        "SKIP_CHALLENGE",
        "NEXT_CHALLENGE",
        "END_GAME",
      ];
      if (!recognized.includes(action.type)) {
        throw new ActionValidationError(
          "INVALID_ACTION_TYPE",
          `Unrecognized action type '${action.type}'. Action is not permitted.`,
          400
        );
      }
      break;
    }
  }
}

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

import type { GameAction, GameState, GameSession, GameResult, ProcessedActionRecord } from "@/types/domain";
import { verifyAppCheckToken, validateActionPayloadStructure } from "./security";
import { serverGameRepository, type GameRepositoryContract, PersistenceError } from "./gameRepository";
import { AuthoritativeGameEngine } from "./authoritativeGameEngine";

if (typeof window !== "undefined") {
  throw new Error("Security Violation: submitGameAction cannot be loaded in client browser bundle.");
}

export type ActionErrorCode =
  | "UNAUTHENTICATED"
  | "APP_CHECK_INVALID"
  | "GAME_NOT_FOUND"
  | "PLAYER_NOT_IN_GAME"
  | "PLAYER_IMPERSONATION"
  | "GAME_NOT_ACTIVE"
  | "INVALID_ACTION"
  | "INVALID_ACTION_TYPE"
  | "ACTION_DISALLOWED_FOR_STATE"
  | "NOT_PLAYER_TURN"
  | "STALE_VERSION"
  | "ACTION_ID_REUSED_CROSS_GAME"
  | "PERSISTENCE_ERROR"
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
  requestId?: string;
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

  // Security Invariant: Never trust client-supplied playerId
  if (action.playerId && action.playerId !== playerId) {
    throw new ActionValidationError(
      "PLAYER_IMPERSONATION",
      `Access denied: Action playerId '${action.playerId}' does not match authenticated user '${playerId}'.`,
      403
    );
  }
  action.playerId = playerId;

  // -------------------------------------------------------------
  // Step 2: App Check Validation
  // In production, App Check is unconditionally mandatory.
  // In development/test, enforceAppCheck can be configured explicitly.
  // -------------------------------------------------------------
  const isProduction = process.env.NODE_ENV === "production";
  const shouldEnforce = isProduction ? true : (context.enforceAppCheck ?? false);

  const appCheckResult = await verifyAppCheckToken(context.appCheckToken, {
    enforceAppCheck: shouldEnforce,
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
  const session = await repo.getGameSession(action.gameId);
  if (!session) {
    throw new ActionValidationError(
      "GAME_NOT_FOUND",
      `Game not found: Game session '${action.gameId}' does not exist.`,
      404
    );
  }

  // Verify action gameId matches session
  if (action.gameId !== session.gameId) {
    throw new ActionValidationError(
      "INVALID_ACTION",
      `Action gameId mismatch: '${action.gameId}' does not match target session '${session.gameId}'.`,
      400
    );
  }

  // -------------------------------------------------------------
  // Step 4: Player Membership Validation & Cross-Game Scoping
  // -------------------------------------------------------------
  if (!session.playerIds.includes(playerId)) {
    throw new ActionValidationError(
      "PLAYER_NOT_IN_GAME",
      `Access denied: Player '${playerId}' does not belong to game '${session.gameId}'.`,
      403
    );
  }

  // Cross-game payload integrity check
  if (
    action.payload &&
    typeof action.payload === "object" &&
    "gameId" in action.payload &&
    typeof (action.payload as { gameId: unknown }).gameId === "string" &&
    (action.payload as { gameId: string }).gameId !== action.gameId
  ) {
    throw new ActionValidationError(
      "INVALID_ACTION",
      `Payload gameId mismatch: '${(action.payload as { gameId: string }).gameId}' does not match target session '${action.gameId}'.`,
      400
    );
  }

  // Action ID prefix scoping check (e.g. "game_xyz:act_123")
  if (action.clientActionId.includes(":")) {
    const [prefixGameId] = action.clientActionId.split(":");
    if (prefixGameId && prefixGameId.startsWith("game_") && prefixGameId !== action.gameId) {
      throw new ActionValidationError(
        "ACTION_ID_REUSED_CROSS_GAME",
        `Action ID prefix '${prefixGameId}' does not match target session '${action.gameId}'.`,
        403
      );
    }
  }

  // Authoritative action ID claim & cross-game replay defense
  const claimCheck = await repo.checkAndClaimActionId(
    action.clientActionId,
    action.gameId,
    playerId,
    serverTimestamp
  );
  if (!claimCheck.allowed) {
    throw new ActionValidationError(
      "ACTION_ID_REUSED_CROSS_GAME",
      `Security violation: Action ID '${action.clientActionId}' is already associated with game '${claimCheck.existingGameId}' and cannot be reused in game '${action.gameId}'.`,
      403
    );
  }

  // -------------------------------------------------------------
  // Step 5: Atomic Authoritative Transaction on Realtime State
  // -------------------------------------------------------------
  interface TransactionExecutionMeta {
    isIdempotentDuplicate: boolean;
    updatedSession: GameSession;
    updatedState: GameState;
    gameResult: GameResult | null | undefined;
    authoritativePayload?: Record<string, unknown>;
    cachedActionRecord?: ProcessedActionRecord;
  }

  const txOutcome = await repo.transactEphemeralGameState<TransactionExecutionMeta>(
    action.gameId,
    (currentState) => {
      // 1. Read current state (atomically read latest committed state or initialize)
      let state = currentState;
      if (!state) {
        state = {
          gameId: session.gameId,
          gameType: session.gameType,
          status: session.status,
          playerIds: session.playerIds,
          allowedPlayers: Object.fromEntries(session.playerIds.map((pid) => [pid, true])),
          currentRound: 1,
          maxRounds: 3,
          version: 1,
          scores: Object.fromEntries(session.playerIds.map((pid) => [pid, 0])),
          turnPlayerId: session.gameType === "couple_race" ? session.playerIds[0] || null : null,
          roundStartedAtServer: serverTimestamp,
          roundDeadlineServer: serverTimestamp + 60000,
          serverTimestamp,
          data: {},
          processedActionIds: {},
          processedActions: {},
          isFinished: false,
          winnerId: null,
        };
      }

      // 2. Verify action has not already been processed (Idempotency Protection)
      // If client retries an action, do not double-mutate state or re-validate conditions
      // altered by this action itself.
      if (state.processedActionIds && state.processedActionIds[action.clientActionId]) {
        const cached = state.processedActions?.[action.clientActionId];
        return {
          nextState: state,
          meta: {
            isIdempotentDuplicate: true,
            updatedSession: session,
            updatedState: state,
            gameResult: null,
            authoritativePayload: (cached?.payload as Record<string, unknown>) ?? {
              idempotent: true,
              originalProcessedAtServer: state.processedActionIds[action.clientActionId],
            },
            cachedActionRecord: cached,
          },
        };
      }

      // 3. Verify game version (atomic optimistic concurrency verification)
      const expectedVersion =
        (action as { expectedVersion?: number; version?: number }).expectedVersion ??
        (action as { expectedVersion?: number; version?: number }).version;
      if (typeof expectedVersion === "number" && expectedVersion !== state.version) {
        return {
          abortError: new ActionValidationError(
            "STALE_VERSION",
            `Stale state version: Action expects version ${expectedVersion} but current authoritative version is ${state.version}.`,
            409
          ),
        };
      }

      // 4. Verify player
      if (!session.playerIds.includes(playerId)) {
        return {
          abortError: new ActionValidationError(
            "PLAYER_NOT_IN_GAME",
            `Access denied: Player '${playerId}' does not belong to game '${session.gameId}'.`,
            403
          ),
        };
      }

      // Check turn order for turn-based actions
      if (
        (action.type === "ROLL_DICE" || action.type === "MOVE" || action.type === "END_TURN") &&
        state.turnPlayerId &&
        state.turnPlayerId !== playerId
      ) {
        return {
          abortError: new ActionValidationError(
            "NOT_PLAYER_TURN",
            `It is not player '${playerId}'s turn (current turn: '${state.turnPlayerId}').`,
            400
          ),
        };
      }

      // 5. Verify game phase
      const isGameConcluded =
        state.isFinished ||
        state.status === "game_end" ||
        state.status === "results" ||
        session.status === "game_end" ||
        session.status === "results";

      if (isGameConcluded && action.type !== "REMATCH") {
        return {
          abortError: new ActionValidationError(
            "GAME_NOT_ACTIVE",
            `Game is not active: Game '${session.gameId}' has already concluded with status '${state.status}'.`,
            409
          ),
        };
      }

      // Action after round end check
      if (
        state.status === "round_end" &&
        (action.type === "ROLL_DICE" ||
          action.type === "MOVE" ||
          action.type === "TRIGGER_TARGET" ||
          action.type === "SELECT_CELL" ||
          action.type === "SUBMIT_ANSWER")
      ) {
        return {
          abortError: new ActionValidationError(
            "ACTION_DISALLOWED_FOR_STATE",
            `Action '${action.type}' is disallowed after round has ended (current status: '${state.status}').`,
            400
          ),
        };
      }

      // 6. Verify action validity
      try {
        validateActionStateAllowed(action, state, session, playerId, serverTimestamp);
      } catch (err) {
        return { abortError: err as Error };
      }

      // 7. Apply the existing game engine
      const execution = AuthoritativeGameEngine.applyAction(
        session,
        state,
        action,
        playerId,
        serverTimestamp
      );

      // 8. Update version
      const nextVersion = Math.max((state.version || 0) + 1, execution.updatedState.version);
      execution.updatedState.version = nextVersion;

      // 9. Record the processed action ID and cached record
      const actionRecord: ProcessedActionRecord = {
        clientActionId: action.clientActionId,
        type: action.type,
        playerId,
        gameId: session.gameId,
        serverTimestamp,
        stateVersion: nextVersion,
        payload: execution.authoritativePayload,
      };

      const updatedProcessedActionIds = {
        ...(state.processedActionIds || {}),
        ...(execution.updatedState.processedActionIds || {}),
        [action.clientActionId]: serverTimestamp,
      };
      execution.updatedState.processedActionIds = updatedProcessedActionIds;

      const updatedProcessedActions = {
        ...(state.processedActions || {}),
        ...(execution.updatedState.processedActions || {}),
        [action.clientActionId]: actionRecord,
      };
      execution.updatedState.processedActions = updatedProcessedActions;

      execution.updatedState.lastProcessedAction = {
        clientActionId: action.clientActionId,
        type: action.type,
        playerId,
        serverTimestamp,
      };
      execution.updatedState.serverTimestamp = serverTimestamp;

      // 10. Write the resulting state
      return {
        nextState: execution.updatedState,
        meta: {
          isIdempotentDuplicate: false,
          updatedSession: execution.updatedSession,
          updatedState: execution.updatedState,
          gameResult: execution.gameResult,
          authoritativePayload: execution.authoritativePayload,
        },
      };
    }
  );

  if (txOutcome.abortError) {
    throw txOutcome.abortError;
  }

  if (!txOutcome.committed || !txOutcome.state) {
    throw new PersistenceError(
      "Transaction failed to atomically commit authoritative game state to persistent store.",
      {
        operation: "transactEphemeralGameState",
        gameId: action.gameId,
        actionId: action.clientActionId,
        requestId: context.requestId,
      }
    );
  }

  const committedState = txOutcome.state;

  if (txOutcome.meta?.isIdempotentDuplicate) {
    let existingResult: GameResult | null = null;
    if (committedState.isFinished) {
      existingResult = await repo.getGameResult(`res_${session.gameId}`);
      if (!existingResult) {
        existingResult = await repo.getGameResult(session.gameId);
      }
    }

    const cached = txOutcome.meta.cachedActionRecord;

    return {
      accepted: true,
      idempotentDuplicate: true,
      gameId: session.gameId,
      clientActionId: action.clientActionId,
      serverTimestamp: cached?.serverTimestamp || serverTimestamp,
      eventType: cached?.type || action.type,
      stateVersion: cached?.stateVersion || committedState.version,
      gameState: committedState,
      gameSession: session,
      gameResult: existingResult,
      payload: (txOutcome.meta.authoritativePayload as Record<string, unknown>) || {
        idempotent: true,
        originalProcessedAtServer: committedState.processedActionIds[action.clientActionId],
      },
    };
  }

  // Persist durable session to Firestore
  if (txOutcome.meta?.updatedSession) {
    await repo.saveGameSession(txOutcome.meta.updatedSession);
  }

  // Persist durable gameResult to Firestore
  if (txOutcome.meta?.gameResult) {
    await repo.saveGameResult(txOutcome.meta.gameResult);
  }

  return {
    accepted: true,
    idempotentDuplicate: false,
    gameId: session.gameId,
    clientActionId: action.clientActionId,
    serverTimestamp,
    eventType: action.type,
    stateVersion: committedState.version,
    gameState: committedState,
    gameSession: txOutcome.meta?.updatedSession || session,
    gameResult: txOutcome.meta?.gameResult || null,
    payload: txOutcome.meta?.authoritativePayload,
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

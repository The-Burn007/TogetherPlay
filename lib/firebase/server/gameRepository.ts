/**
 * Authoritative Server Game Repository
 * 
 * Manages:
 * - Realtime Database (RTDB): Ephemeral GameState (/gameStates/{gameId}) via Firebase Admin SDK
 * - Firestore: Durable GameSession (/games/{gameId}) & GameResult (/gameResults/{resultId}) via Firebase Admin SDK
 * 
 * ARCHITECTURAL PRINCIPLES:
 * 1. PERSISTENCE IS AUTHORITATIVE: Firebase (Firestore & RTDB) is the sole authoritative store in production.
 * 2. NO SILENT FALLBACKS: Process-memory is NEVER an authoritative fallback for failed persistent operations.
 * 3. NO SWALLOWED EXCEPTIONS: All Firebase persistence failures must throw PersistenceError and be logged structured.
 * 4. ATOMIC INTEGRITY: Game mutations must fail if the authoritative persistent write fails.
 */

import {
  getAdminFirestore,
  getAdminDatabase,
  isAdminFirebaseConfigured,
} from "./admin";
import type {
  GameSession,
  GameState,
  PublicGameState,
  GameResult,
  PrivateGameState,
  ActionClaimRecord,
} from "@/types/domain";
import { ACTION_CLAIM_TTL_MS, MAX_BOUNDED_PROCESSED_ACTIONS } from "@/types/domain";
import { PersistenceError, type ActionErrorCode } from "./errors";
import { logStructuredError } from "./logger";
import { getPublicState, getPrivateState } from "@/lib/games/gameStateContract";

export { PersistenceError } from "./errors";
export type { PrivateGameState, ActionClaimRecord };
export { ACTION_CLAIM_TTL_MS, MAX_BOUNDED_PROCESSED_ACTIONS };
export { logStructuredError, type ErrorCategory, type StructuredLogPayload } from "./logger";

export interface ActionClaimCheckResult {
  allowed: boolean;
  error?: ActionErrorCode;
  errorMessage?: string;
  existingGameId?: string;
  existingPlayerId?: string;
  existingType?: string;
  isCompleted?: boolean;
  cachedRecord?: ActionClaimRecord;
}

export function computePayloadFingerprint(payload: unknown): string {
  if (payload === undefined || payload === null) return "";
  if (typeof payload !== "object") return String(payload);
  try {
    const sortObject = (obj: any): any => {
      if (obj === null || typeof obj !== "object") return obj;
      if (Array.isArray(obj)) return obj.map(sortObject);
      return Object.keys(obj)
        .sort()
        .reduce((res: Record<string, unknown>, key: string) => {
          res[key] = sortObject(obj[key]);
          return res;
        }, {});
    };
    return JSON.stringify(sortObject(payload));
  } catch {
    return JSON.stringify(payload);
  }
}

if (typeof window !== "undefined") {
  throw new Error("Security Violation: ServerGameRepository cannot be loaded in client browser bundle.");
}

export interface PersistenceFailureSimulation {
  failGetGameSession?: boolean | Error;
  failSaveGameSession?: boolean | Error;
  failGetEphemeralGameState?: boolean | Error;
  failSaveEphemeralGameState?: boolean | Error;
  failTransactEphemeralGameState?: boolean | Error;
  failCheckAndClaimActionId?: boolean | Error;
  failCompleteActionClaim?: boolean | Error;
  failCleanupExpiredActionClaims?: boolean | Error;
  failSaveGameResult?: boolean | Error;
  failGetGameResult?: boolean | Error;
  failGetActionClaim?: boolean | Error;
  failGetPrivateGameState?: boolean | Error;
  failSavePrivateGameState?: boolean | Error;
}

/**
 * Isolated in-memory fixture store for offline unit test execution.
 * CLASSIFICATION: test state.
 * 
 * ARCHITECTURAL RULE:
 * This store is strictly isolated from production authority. In production,
 * ServerGameRepository communicates directly with Firebase (Firestore & RTDB)
 * and does NOT instantiate or reference IsolatedTestGameStore.
 */
export class IsolatedTestGameStore {
  readonly memorySessions = new Map<string, GameSession>();
  readonly memoryStates = new Map<string, GameState>();
  readonly memoryPrivateStates = new Map<string, PrivateGameState>();
  readonly memoryResults = new Map<string, GameResult>();
  readonly memoryActionClaims = new Map<string, ActionClaimRecord>();
  readonly gameLocks = new Map<string, Promise<void>>();
  readonly actionClaimLocks = new Map<string, Promise<void>>();

  clear(): void {
    this.memorySessions.clear();
    this.memoryStates.clear();
    this.memoryPrivateStates.clear();
    this.memoryResults.clear();
    this.memoryActionClaims.clear();
    this.gameLocks.clear();
    this.actionClaimLocks.clear();
  }

  async withGameLock<R>(gameId: string, fn: () => Promise<R>): Promise<R> {
    while (this.gameLocks.has(gameId)) {
      await this.gameLocks.get(gameId);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.gameLocks.set(gameId, lockPromise);
    try {
      return await fn();
    } finally {
      this.gameLocks.delete(gameId);
      resolveLock();
    }
  }

  async withActionClaimLock<R>(actionId: string, fn: () => Promise<R>): Promise<R> {
    while (this.actionClaimLocks.has(actionId)) {
      await this.actionClaimLocks.get(actionId);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.actionClaimLocks.set(actionId, lockPromise);
    try {
      return await fn();
    } finally {
      this.actionClaimLocks.delete(actionId);
      resolveLock();
    }
  }
}

export interface GameRepositoryOptions {
  useLiveBackend?: boolean;
  simulation?: PersistenceFailureSimulation;
  /** Explicit test store for isolated unit tests. Undefined in production. */
  testStore?: IsolatedTestGameStore;
}

export interface TransactionUpdateResult<T = unknown> {
  nextState?: GameState;
  meta?: T;
  abortError?: Error;
}

export interface TransactionOutcome<T = unknown> {
  committed: boolean;
  state: GameState | null;
  meta?: T;
  abortError?: Error | null;
}

export interface GameRepositoryContract {
  // Durable Firestore operations
  getGameSession(gameId: string): Promise<GameSession | null>;
  saveGameSession(session: GameSession): Promise<void>;
  saveGameResult(result: GameResult): Promise<void>;
  getGameResult(resultId: string): Promise<GameResult | null>;

  // Ephemeral Realtime Database operations
  getEphemeralGameState(gameId: string): Promise<GameState | null>;
  saveEphemeralGameState(state: GameState): Promise<void>;
  transactEphemeralGameState<T = unknown>(
    gameId: string,
    updateFn: (currentState: GameState | null) => TransactionUpdateResult<T>
  ): Promise<TransactionOutcome<T>>;

  // Private Server-Side State operations (strictly denied to client RTDB rules)
  getPrivateGameState(gameId: string): Promise<PrivateGameState | null>;
  savePrivateGameState(gameId: string, state: PrivateGameState): Promise<void>;

  // Action ID Scoping & Cross-Game Replay Prevention
  checkAndClaimActionId(
    clientActionId: string,
    gameId: string,
    playerId: string,
    timestamp?: number,
    actionType?: string,
    actionPayload?: unknown
  ): Promise<ActionClaimCheckResult>;
  completeActionClaim(
    clientActionId: string,
    gameId: string,
    playerId: string,
    stateVersion: number,
    resultPayload?: unknown,
    timestamp?: number
  ): Promise<void>;
  cleanupExpiredActionClaims(now?: number): Promise<{ cleanedCount: number }>;
  getActionClaim(clientActionId: string): Promise<ActionClaimRecord | null>;

  // Combined atomic snapshot
  getGameAggregate(gameId: string): Promise<{ session: GameSession; state: GameState } | null>;

  // Testing & Reset helpers (strictly isolated from production authority)
  clearForTesting(): void;
  seedGame(session: GameSession, state?: GameState, privateState?: PrivateGameState): void;
  simulatePersistenceFailure(sim: PersistenceFailureSimulation): void;
  clearPersistenceFailureSimulation(): void;
}

export class ServerGameRepository implements GameRepositoryContract {
  // Production authority: Firebase Firestore & Realtime Database.
  // Test isolation: IsolatedTestGameStore is only present when explicitly in test mode.
  private readonly testStore?: IsolatedTestGameStore;
  private readonly useLiveBackend: boolean;
  private simulation: PersistenceFailureSimulation | null = null;

  constructor(options: GameRepositoryOptions = {}) {
    if (options.useLiveBackend !== undefined) {
      this.useLiveBackend = options.useLiveBackend;
    } else {
      // In isolated Vitest environments, defaults to false unless explicitly configured.
      // In production and dev server environments, live backend is mandatory authority.
      const isTestEnv = typeof process !== "undefined" && Boolean(process.env.VITEST);
      this.useLiveBackend = !isTestEnv && isAdminFirebaseConfigured();
    }

    if (!this.useLiveBackend) {
      this.testStore = options.testStore ?? new IsolatedTestGameStore();
    }

    if (options.simulation) {
      this.simulation = { ...options.simulation };
    }
  }

  public isLive(): boolean {
    return this.useLiveBackend;
  }

  public hasProcessLocalAuthority(): boolean {
    return !this.useLiveBackend;
  }

  public getStorageClassification(): {
    authority: "FIREBASE_FIRESTORE_AND_RTDB" | "TEST_ISOLATED_FIXTURE";
    hasProcessLocalAuthority: boolean;
  } {
    return {
      authority: this.useLiveBackend ? "FIREBASE_FIRESTORE_AND_RTDB" : "TEST_ISOLATED_FIXTURE",
      hasProcessLocalAuthority: !this.useLiveBackend,
    };
  }

  public getIsolatedTestStore(): IsolatedTestGameStore | undefined {
    return this.testStore;
  }

  public simulatePersistenceFailure(sim: PersistenceFailureSimulation): void {
    this.simulation = { ...(this.simulation || {}), ...sim };
  }

  public clearPersistenceFailureSimulation(): void {
    this.simulation = null;
  }

  private checkSimulatedFailure(
    key: keyof PersistenceFailureSimulation,
    operation: string,
    gameId?: string,
    actionId?: string
  ): void {
    if (!this.simulation) return;
    const sim = this.simulation[key];
    if (sim) {
      const err =
        sim instanceof PersistenceError
          ? sim
          : new PersistenceError(
              sim instanceof Error ? sim.message : `Simulated persistent store failure during '${operation}'.`,
              {
                operation,
                gameId,
                actionId,
                cause: sim instanceof Error ? sim : undefined,
              }
            );
      logStructuredError({
        requestId: "simulated_req",
        gameId: gameId || "unknown_game",
        actionId: actionId || "none",
        errorCategory: "PERSISTENCE_FAILURE",
        operation,
        message: err.message,
        error: err,
      });
      throw err;
    }
  }

  clearForTesting(): void {
    if (this.testStore) {
      this.testStore.clear();
    }
    this.simulation = null;
  }

  seedGame(session: GameSession, state?: GameState, privateState?: PrivateGameState): void {
    if (!this.testStore) {
      throw new Error(
        "Invalid Operation: seedGame is an isolated test fixture helper. Live ServerGameRepository persists only to Firebase."
      );
    }
    this.testStore.memorySessions.set(session.gameId, { ...session });
    if (state) {
      if (privateState) {
        this.testStore.memoryPrivateStates.set(session.gameId, JSON.parse(JSON.stringify(privateState)));
      } else if (state.data && (state.data.targetId || state.data.targetName || state.data.targetCode || state.data.targetAnswer)) {
        this.testStore.memoryPrivateStates.set(session.gameId, {
          gameId: session.gameId,
          targetId: state.data.targetId as string | undefined,
          targetName: state.data.targetName as string | undefined,
          targetCode: state.data.targetCode as string | undefined,
          targetClue: state.data.targetClue as string | undefined,
          targetAnswer: state.data.targetAnswer as string | undefined,
          usedTargetIds: state.data.usedTargetIds as string[] | undefined,
        });
      }

      this.testStore.memoryStates.set(session.gameId, {
        ...state,
        processedActions: state.processedActions || {},
      });
      if (state.processedActionIds) {
        for (const [actionId, ts] of Object.entries(state.processedActionIds)) {
          this.testStore.memoryActionClaims.set(actionId, {
            gameId: session.gameId,
            playerId: session.createdBy,
            timestamp: ts,
            status: "completed",
            expiresAt: ts + ACTION_CLAIM_TTL_MS,
          });
        }
      }
    } else {
      const initialState: GameState = {
        gameId: session.gameId,
        gameType: session.gameType,
        status: session.status,
        playerIds: session.playerIds,
        allowedPlayers: Object.fromEntries(session.playerIds.map((pid) => [pid, true])),
        currentRound: 1,
        maxRounds: 3,
        version: 1,
        scores: Object.fromEntries(session.playerIds.map((pid) => [pid, 0])),
        turnPlayerId: session.playerIds[0] || null,
        roundStartedAtServer: Date.now(),
        roundDeadlineServer: Date.now() + 60000,
        serverTimestamp: Date.now(),
        data: {},
        processedActionIds: {},
        processedActions: {},
        isFinished: false,
        winnerId: null,
      };
      this.testStore.memoryStates.set(session.gameId, initialState);
    }
  }

  // --- Durable Firestore: GameSession ---
  async getGameSession(gameId: string): Promise<GameSession | null> {
    this.checkSimulatedFailure("failGetGameSession", "getGameSession", gameId);

    if (this.useLiveBackend) {
      try {
        const firestore = getAdminFirestore();
        const snap = await firestore.collection("games").doc(gameId).get();
        if (snap.exists) {
          return snap.data() as GameSession;
        }
        return null;
      } catch (err) {
        logStructuredError({
          requestId: "internal_repo",
          gameId,
          actionId: "none",
          errorCategory: "PERSISTENCE_FAILURE",
          operation: "getGameSession",
          message: `Firestore getGameSession failed: ${err instanceof Error ? err.message : String(err)}`,
          error: err,
        });
        throw new PersistenceError(`Failed to read game session '${gameId}' from persistent store.`, {
          operation: "getGameSession",
          gameId,
          cause: err,
        });
      }
    }

    if (!this.testStore) return null;
    const memory = this.testStore.memorySessions.get(gameId);
    return memory ? (JSON.parse(JSON.stringify(memory)) as GameSession) : null;
  }

  async saveGameSession(session: GameSession): Promise<void> {
    this.checkSimulatedFailure("failSaveGameSession", "saveGameSession", session.gameId);

    if (this.useLiveBackend) {
      try {
        const firestore = getAdminFirestore();
        await firestore.collection("games").doc(session.gameId).set(session, { merge: true });
        return;
      } catch (err) {
        logStructuredError({
          requestId: "internal_repo",
          gameId: session.gameId,
          actionId: "none",
          errorCategory: "PERSISTENCE_FAILURE",
          operation: "saveGameSession",
          message: `Firestore saveGameSession failed: ${err instanceof Error ? err.message : String(err)}`,
          error: err,
        });
        throw new PersistenceError(`Failed to commit game session '${session.gameId}' to persistent store.`, {
          operation: "saveGameSession",
          gameId: session.gameId,
          cause: err,
        });
      }
    }

    if (!this.testStore) {
      throw new PersistenceError("No live backend or test store configured for saveGameSession.", {
        operation: "saveGameSession",
        gameId: session.gameId,
      });
    }
    this.testStore.memorySessions.set(session.gameId, JSON.parse(JSON.stringify(session)) as GameSession);
  }

  // --- Durable Firestore: GameResult ---
  async saveGameResult(result: GameResult): Promise<void> {
    this.checkSimulatedFailure("failSaveGameResult", "saveGameResult", result.gameId);

    if (this.useLiveBackend) {
      try {
        const firestore = getAdminFirestore();
        await firestore.collection("gameResults").doc(result.resultId).set(result);
        return;
      } catch (err) {
        logStructuredError({
          requestId: "internal_repo",
          gameId: result.gameId,
          actionId: "none",
          errorCategory: "PERSISTENCE_FAILURE",
          operation: "saveGameResult",
          message: `Firestore saveGameResult failed: ${err instanceof Error ? err.message : String(err)}`,
          error: err,
        });
        throw new PersistenceError(`Failed to commit game result '${result.resultId}' to persistent store.`, {
          operation: "saveGameResult",
          gameId: result.gameId,
          cause: err,
        });
      }
    }

    if (!this.testStore) {
      throw new PersistenceError("No live backend or test store configured for saveGameResult.", {
        operation: "saveGameResult",
        gameId: result.gameId,
      });
    }
    this.testStore.memoryResults.set(result.resultId, JSON.parse(JSON.stringify(result)) as GameResult);
  }

  async getGameResult(resultIdOrGameId: string): Promise<GameResult | null> {
    this.checkSimulatedFailure("failGetGameResult", "getGameResult", resultIdOrGameId);

    if (this.useLiveBackend) {
      try {
        const firestore = getAdminFirestore();
        const snap = await firestore.collection("gameResults").doc(resultIdOrGameId).get();
        if (snap.exists) {
          return snap.data() as GameResult;
        }

        const querySnap = await firestore
          .collection("gameResults")
          .where("gameId", "==", resultIdOrGameId)
          .limit(1)
          .get();
        if (!querySnap.empty) {
          return querySnap.docs[0].data() as GameResult;
        }
        return null;
      } catch (err) {
        logStructuredError({
          requestId: "internal_repo",
          gameId: resultIdOrGameId,
          actionId: "none",
          errorCategory: "PERSISTENCE_FAILURE",
          operation: "getGameResult",
          message: `Firestore getGameResult failed: ${err instanceof Error ? err.message : String(err)}`,
          error: err,
        });
        throw new PersistenceError(`Failed to read game result '${resultIdOrGameId}' from persistent store.`, {
          operation: "getGameResult",
          gameId: resultIdOrGameId,
          cause: err,
        });
      }
    }

    if (!this.testStore) return null;
    const memory = this.testStore.memoryResults.get(resultIdOrGameId);
    if (memory) return JSON.parse(JSON.stringify(memory)) as GameResult;

    for (const res of this.testStore.memoryResults.values()) {
      if (res.gameId === resultIdOrGameId) {
        return JSON.parse(JSON.stringify(res)) as GameResult;
      }
    }

    return null;
  }

  // --- Ephemeral Realtime Database: GameState ---
  async getEphemeralGameState(gameId: string): Promise<GameState | null> {
    this.checkSimulatedFailure("failGetEphemeralGameState", "getEphemeralGameState", gameId);

    if (this.useLiveBackend) {
      try {
        const rtdb = getAdminDatabase();
        const snap = await rtdb.ref(`gameStates/${gameId}`).get();
        if (snap.exists()) {
          return snap.val() as GameState;
        }
        return null;
      } catch (err) {
        logStructuredError({
          requestId: "internal_repo",
          gameId,
          actionId: "none",
          errorCategory: "PERSISTENCE_FAILURE",
          operation: "getEphemeralGameState",
          message: `RTDB getEphemeralGameState failed: ${err instanceof Error ? err.message : String(err)}`,
          error: err,
        });
        throw new PersistenceError(`Failed to read ephemeral game state '${gameId}' from persistent store.`, {
          operation: "getEphemeralGameState",
          gameId,
          cause: err,
        });
      }
    }

    if (!this.testStore) return null;
    const memory = this.testStore.memoryStates.get(gameId);
    return memory ? (JSON.parse(JSON.stringify(memory)) as GameState) : null;
  }

  async saveEphemeralGameState(state: GameState): Promise<void> {
    this.checkSimulatedFailure("failSaveEphemeralGameState", "saveEphemeralGameState", state.gameId);

    // If state contains private/secret fields that have not yet been migrated to private state,
    // ensure private state is preserved in isolated storage before stripping from public state
    const extractedPrivate = getPrivateState({ state });
    if (extractedPrivate && (extractedPrivate.targetId || extractedPrivate.targetAnswer)) {
      try {
        const existingPrivate = await this.getPrivateGameState(state.gameId);
        if (!existingPrivate) {
          await this.savePrivateGameState(state.gameId, extractedPrivate);
        }
      } catch {
        // Ignore errors checking/saving private state in non-configured environments
      }
    }

    // Defense-in-depth: Ensure state persisted to public RTDB gameStates/ is strictly PublicGameState
    const publicState = getPublicState({ state });

    if (this.useLiveBackend) {
      try {
        const rtdb = getAdminDatabase();
        await rtdb.ref(`gameStates/${publicState.gameId}`).set(publicState);
        return;
      } catch (err) {
        logStructuredError({
          requestId: "internal_repo",
          gameId: publicState.gameId,
          actionId: "none",
          errorCategory: "PERSISTENCE_FAILURE",
          operation: "saveEphemeralGameState",
          message: `RTDB saveEphemeralGameState failed: ${err instanceof Error ? err.message : String(err)}`,
          error: err,
        });
        throw new PersistenceError(`Failed to commit ephemeral game state '${publicState.gameId}' to persistent store.`, {
          operation: "saveEphemeralGameState",
          gameId: publicState.gameId,
          cause: err,
        });
      }
    }

    if (!this.testStore) {
      throw new PersistenceError("No live backend or test store configured for saveEphemeralGameState.", {
        operation: "saveEphemeralGameState",
        gameId: publicState.gameId,
      });
    }
    this.testStore.memoryStates.set(publicState.gameId, JSON.parse(JSON.stringify(publicState)) as GameState);
  }

  // --- Private Server-Side State Operations (Deny-All Client RTDB Rules) ---
  async getPrivateGameState(gameId: string): Promise<PrivateGameState | null> {
    this.checkSimulatedFailure("failGetPrivateGameState", "getPrivateGameState", gameId);

    if (this.useLiveBackend) {
      try {
        const rtdb = getAdminDatabase();
        const snap = await rtdb.ref(`privateGameStates/${gameId}`).get();
        if (snap.exists()) {
          return snap.val() as PrivateGameState;
        }
        return null;
      } catch (err) {
        logStructuredError({
          requestId: "internal_repo",
          gameId,
          actionId: "none",
          errorCategory: "PERSISTENCE_FAILURE",
          operation: "getPrivateGameState",
          message: `RTDB getPrivateGameState failed: ${err instanceof Error ? err.message : String(err)}`,
          error: err,
        });
        throw new PersistenceError(`Failed to read private game state '${gameId}' from persistent store.`, {
          operation: "getPrivateGameState",
          gameId,
          cause: err,
        });
      }
    }

    if (!this.testStore) return null;
    const memory = this.testStore.memoryPrivateStates.get(gameId);
    return memory ? (JSON.parse(JSON.stringify(memory)) as PrivateGameState) : null;
  }

  async savePrivateGameState(gameId: string, state: PrivateGameState): Promise<void> {
    this.checkSimulatedFailure("failSavePrivateGameState", "savePrivateGameState", gameId);

    if (this.useLiveBackend) {
      try {
        const rtdb = getAdminDatabase();
        await rtdb.ref(`privateGameStates/${gameId}`).set(state);
        return;
      } catch (err) {
        logStructuredError({
          requestId: "internal_repo",
          gameId,
          actionId: "none",
          errorCategory: "PERSISTENCE_FAILURE",
          operation: "savePrivateGameState",
          message: `RTDB savePrivateGameState failed: ${err instanceof Error ? err.message : String(err)}`,
          error: err,
        });
        throw new PersistenceError(`Failed to commit private game state '${gameId}' to persistent store.`, {
          operation: "savePrivateGameState",
          gameId,
          cause: err,
        });
      }
    }

    if (!this.testStore) {
      throw new PersistenceError("No live backend or test store configured for savePrivateGameState.", {
        operation: "savePrivateGameState",
        gameId,
      });
    }
    this.testStore.memoryPrivateStates.set(gameId, JSON.parse(JSON.stringify(state)) as PrivateGameState);
  }

  /**
   * Atomic Realtime Database Transaction
   * Concurrently safe state mutation guaranteed by Firebase RTDB transaction primitives.
   */
  async transactEphemeralGameState<T = unknown>(
    gameId: string,
    updateFn: (currentState: GameState | null) => TransactionUpdateResult<T>
  ): Promise<TransactionOutcome<T>> {
    this.checkSimulatedFailure("failTransactEphemeralGameState", "transactEphemeralGameState", gameId);

    if (this.useLiveBackend) {
      try {
        const rtdb = getAdminDatabase();
        const stateRef = rtdb.ref(`gameStates/${gameId}`);

        let capturedMeta: T | undefined;
        let capturedAbortError: Error | null = null;

        const txResult = await stateRef.transaction((currentData) => {
          const currentState = currentData ? (currentData as GameState) : null;
          const result = updateFn(currentState);

          if (!result || result.abortError || !result.nextState) {
            if (result?.abortError) {
              capturedAbortError = result.abortError;
            }
            return undefined; // Returning undefined aborts the transaction in RTDB
          }

          capturedMeta = result.meta;
          return result.nextState;
        });

        if (!txResult.committed) {
          if (capturedAbortError) {
            return {
              committed: false,
              state: null,
              meta: capturedMeta,
              abortError: capturedAbortError,
            };
          }

          const persistenceErr = new PersistenceError(
            `RTDB transaction failed to commit state for game '${gameId}'.`,
            { operation: "transactEphemeralGameState", gameId }
          );
          logStructuredError({
            requestId: "internal_repo",
            gameId,
            actionId: "none",
            errorCategory: "PERSISTENCE_FAILURE",
            operation: "transactEphemeralGameState",
            message: `RTDB transaction uncommitted for game '${gameId}'`,
            error: persistenceErr,
          });
          return {
            committed: false,
            state: null,
            meta: capturedMeta,
            abortError: persistenceErr,
          };
        }

        const committedState = txResult.snapshot ? (txResult.snapshot.val() as GameState) : null;
        return {
          committed: true,
          state: committedState,
          meta: capturedMeta,
          abortError: null,
        };
      } catch (err) {
        const persistenceErr = new PersistenceError(
          `RTDB transaction error for game '${gameId}': ${err instanceof Error ? err.message : String(err)}`,
          { operation: "transactEphemeralGameState", gameId, cause: err }
        );
        logStructuredError({
          requestId: "internal_repo",
          gameId,
          actionId: "none",
          errorCategory: "PERSISTENCE_FAILURE",
          operation: "transactEphemeralGameState",
          message: persistenceErr.message,
          error: err,
        });
        return {
          committed: false,
          state: null,
          abortError: persistenceErr,
        };
      }
    }

    if (!this.testStore) {
      throw new PersistenceError("No live backend or test store configured for transactEphemeralGameState.", {
        operation: "transactEphemeralGameState",
        gameId,
      });
    }

    // In isolated test environment: Execute under atomic game lock
    return this.testStore.withGameLock(gameId, async () => {
      const currentStored = this.testStore!.memoryStates.get(gameId);
      const currentState = currentStored ? (JSON.parse(JSON.stringify(currentStored)) as GameState) : null;

      const result = updateFn(currentState);
      if (!result || result.abortError || !result.nextState) {
        return {
          committed: false,
          state: null,
          meta: result?.meta,
          abortError: result?.abortError || null,
        };
      }

      const clonedNextState = JSON.parse(JSON.stringify(result.nextState)) as GameState;
      this.testStore!.memoryStates.set(gameId, clonedNextState);

      return {
        committed: true,
        state: clonedNextState,
        meta: result.meta,
        abortError: null,
      };
    });
  }

  // --- Action ID Scoping & Cross-Game Replay Prevention ---
  async checkAndClaimActionId(
    clientActionId: string,
    gameId: string,
    playerId: string,
    timestamp: number = Date.now(),
    actionType?: string,
    actionPayload?: unknown
  ): Promise<ActionClaimCheckResult> {
    this.checkSimulatedFailure("failCheckAndClaimActionId", "checkAndClaimActionId", gameId, clientActionId);

    const incomingFingerprint = computePayloadFingerprint(actionPayload);
    const expiresAt = timestamp + ACTION_CLAIM_TTL_MS;

    if (this.useLiveBackend) {
      try {
        const rtdb = getAdminDatabase();
        const sanitizedKey = encodeURIComponent(clientActionId).replace(/\./g, "%2E");
        const claimRef = rtdb.ref(`actionClaims/${sanitizedKey}`);

        let resultOutcome: ActionClaimCheckResult = { allowed: true };

        await claimRef.transaction((current) => {
          if (current && typeof current === "object" && "gameId" in current) {
            const existing = current as ActionClaimRecord;

            // 1. Check expiration: if expired, claim can be renewed
            if (existing.expiresAt && existing.expiresAt <= timestamp) {
              resultOutcome = { allowed: true, isCompleted: false };
              return {
                gameId,
                playerId,
                timestamp,
                type: actionType,
                payloadHash: incomingFingerprint,
                status: "pending",
                expiresAt,
              };
            }

            // 2. Cross-game reuse check
            if (existing.gameId && existing.gameId !== gameId) {
              resultOutcome = {
                allowed: false,
                error: "ACTION_ID_REUSED_CROSS_GAME",
                existingGameId: existing.gameId,
                errorMessage: `Security violation: Action ID '${clientActionId}' is already associated with game '${existing.gameId}' and cannot be reused in game '${gameId}'.`,
              };
              return undefined; // abort transaction in RTDB
            }

            // 3. Different player reuse check
            if (existing.playerId && existing.playerId !== playerId) {
              resultOutcome = {
                allowed: false,
                error: "ACTION_ID_REUSED_BY_OTHER_PLAYER",
                existingPlayerId: existing.playerId,
                errorMessage: `Security violation: Action ID '${clientActionId}' was claimed by player '${existing.playerId}' and cannot be reused by player '${playerId}'.`,
              };
              return undefined; // abort transaction in RTDB
            }

            // 4. Action type mismatch
            if (actionType && existing.type && existing.type !== actionType) {
              resultOutcome = {
                allowed: false,
                error: "INVALID_ACTION",
                existingType: existing.type,
                errorMessage: `Action ID '${clientActionId}' was originally submitted as type '${existing.type}', but received '${actionType}'.`,
              };
              return undefined;
            }

            // 5. Payload mismatch
            if (
              incomingFingerprint &&
              existing.payloadHash &&
              existing.payloadHash !== incomingFingerprint
            ) {
              resultOutcome = {
                allowed: false,
                error: "INVALID_ACTION_PAYLOAD",
                errorMessage: `Action ID '${clientActionId}' was previously submitted with a different payload.`,
              };
              return undefined;
            }

            // 6. Completed action
            if (existing.status === "completed") {
              resultOutcome = {
                allowed: true,
                isCompleted: true,
                cachedRecord: existing,
              };
              return current; // keep current claim
            }

            // 7. Pending action (simultaneous attempt or retry after error)
            resultOutcome = {
              allowed: true,
              isCompleted: false,
              cachedRecord: existing,
            };
            return current;
          }

          // Brand new claim
          resultOutcome = { allowed: true, isCompleted: false };
          return {
            gameId,
            playerId,
            timestamp,
            type: actionType,
            payloadHash: incomingFingerprint,
            status: "pending",
            expiresAt,
          };
        });

        return resultOutcome;
      } catch (err) {
        logStructuredError({
          requestId: "internal_repo",
          gameId,
          actionId: clientActionId,
          playerId,
          errorCategory: "PERSISTENCE_FAILURE",
          operation: "checkAndClaimActionId",
          message: `Failed to claim actionId in RTDB: ${err instanceof Error ? err.message : String(err)}`,
          error: err,
        });
        throw new PersistenceError(`Failed to verify or claim action ID in persistent store.`, {
          operation: "checkAndClaimActionId",
          gameId,
          actionId: clientActionId,
          cause: err,
        });
      }
    }

    if (!this.testStore) {
      throw new PersistenceError("No live backend or test store configured for checkAndClaimActionId.", {
        operation: "checkAndClaimActionId",
        gameId,
        actionId: clientActionId,
      });
    }

    return this.testStore.withActionClaimLock(clientActionId, async () => {
      const existing = this.testStore!.memoryActionClaims.get(clientActionId);

      if (existing) {
        // 1. Expiration check
        if (existing.expiresAt && existing.expiresAt <= timestamp) {
          const freshClaim: ActionClaimRecord = {
            gameId,
            playerId,
            timestamp,
            type: actionType,
            payloadHash: incomingFingerprint,
            status: "pending",
            expiresAt,
          };
          this.testStore!.memoryActionClaims.set(clientActionId, freshClaim);
          return { allowed: true, isCompleted: false };
        }

        // 2. Cross-game reuse check
        if (existing.gameId && existing.gameId !== gameId) {
          return {
            allowed: false,
            error: "ACTION_ID_REUSED_CROSS_GAME",
            existingGameId: existing.gameId,
            errorMessage: `Security violation: Action ID '${clientActionId}' is already associated with game '${existing.gameId}' and cannot be reused in game '${gameId}'.`,
          };
        }

        // 3. Different player reuse check
        if (existing.playerId && existing.playerId !== playerId) {
          return {
            allowed: false,
            error: "ACTION_ID_REUSED_BY_OTHER_PLAYER",
            existingPlayerId: existing.playerId,
            errorMessage: `Security violation: Action ID '${clientActionId}' was claimed by player '${existing.playerId}' and cannot be reused by player '${playerId}'.`,
          };
        }

        // 4. Action type mismatch
        if (actionType && existing.type && existing.type !== actionType) {
          return {
            allowed: false,
            error: "INVALID_ACTION",
            existingType: existing.type,
            errorMessage: `Action ID '${clientActionId}' was originally submitted as type '${existing.type}', but received '${actionType}'.`,
          };
        }

        // 5. Payload mismatch
        if (
          incomingFingerprint &&
          existing.payloadHash &&
          existing.payloadHash !== incomingFingerprint
        ) {
          return {
            allowed: false,
            error: "INVALID_ACTION_PAYLOAD",
            errorMessage: `Action ID '${clientActionId}' was previously submitted with a different payload.`,
          };
        }

        // 6. Completed action
        if (existing.status === "completed") {
          return {
            allowed: true,
            isCompleted: true,
            cachedRecord: { ...existing },
          };
        }

        // 7. Pending action
        return {
          allowed: true,
          isCompleted: false,
          cachedRecord: { ...existing },
        };
      }

      // Brand new claim
      const newClaim: ActionClaimRecord = {
        gameId,
        playerId,
        timestamp,
        type: actionType,
        payloadHash: incomingFingerprint,
        status: "pending",
        expiresAt,
      };
      this.testStore!.memoryActionClaims.set(clientActionId, newClaim);
      return { allowed: true, isCompleted: false };
    });
  }

  async completeActionClaim(
    clientActionId: string,
    gameId: string,
    playerId: string,
    stateVersion: number,
    resultPayload?: unknown,
    timestamp: number = Date.now()
  ): Promise<void> {
    this.checkSimulatedFailure("failCompleteActionClaim", "completeActionClaim", gameId, clientActionId);

    if (this.useLiveBackend) {
      try {
        const rtdb = getAdminDatabase();
        const sanitizedKey = encodeURIComponent(clientActionId).replace(/\./g, "%2E");
        const claimRef = rtdb.ref(`actionClaims/${sanitizedKey}`);
        const updateData = {
          status: "completed" as const,
          stateVersion,
          resultPayload: resultPayload !== undefined ? resultPayload : null,
          completedAt: timestamp,
        };

        if (typeof (claimRef as any).update === "function") {
          await (claimRef as any).update(updateData);
        } else {
          await claimRef.transaction((current: any) => {
            if (!current) return updateData;
            return { ...current, ...updateData };
          });
        }
      } catch (err) {
        logStructuredError({
          requestId: "internal_repo",
          gameId,
          actionId: clientActionId,
          playerId,
          errorCategory: "PERSISTENCE_FAILURE",
          operation: "completeActionClaim",
          message: `Failed to complete action claim in RTDB: ${err instanceof Error ? err.message : String(err)}`,
          error: err,
        });
        // Non-fatal if state transaction already committed
      }
      return;
    }

    if (this.testStore) {
      await this.testStore.withActionClaimLock(clientActionId, async () => {
        const existing = this.testStore!.memoryActionClaims.get(clientActionId);
        if (existing) {
          existing.status = "completed";
          existing.stateVersion = stateVersion;
          existing.resultPayload = resultPayload;
          existing.completedAt = timestamp;
        }
      });
    }
  }

  async cleanupExpiredActionClaims(
    now: number = Date.now(),
    maxAgeMs: number = ACTION_CLAIM_TTL_MS
  ): Promise<{ cleanedCount: number }> {
    this.checkSimulatedFailure("failCleanupExpiredActionClaims", "cleanupExpiredActionClaims");

    let cleanedCount = 0;

    if (this.useLiveBackend) {
      try {
        const rtdb = getAdminDatabase();
        const claimsRef = rtdb.ref("actionClaims");
        const snap = await claimsRef.get();
        if (snap.exists()) {
          const claims = snap.val() as Record<string, ActionClaimRecord>;
          const updates: Record<string, null> = {};
          for (const [key, claim] of Object.entries(claims)) {
            const isExpired =
              (claim.expiresAt && claim.expiresAt <= now) ||
              (claim.timestamp && now - claim.timestamp > maxAgeMs);
            if (isExpired) {
              updates[key] = null;
              cleanedCount++;
            }
          }
          if (cleanedCount > 0) {
            await claimsRef.update(updates);
          }
        }
        return { cleanedCount };
      } catch (err) {
        logStructuredError({
          requestId: "internal_repo",
          gameId: "none",
          actionId: "none",
          errorCategory: "PERSISTENCE_FAILURE",
          operation: "cleanupExpiredActionClaims",
          message: `Failed cleanup of expired action claims: ${err instanceof Error ? err.message : String(err)}`,
          error: err,
        });
        return { cleanedCount: 0 };
      }
    }

    if (this.testStore) {
      for (const [key, claim] of Array.from(this.testStore.memoryActionClaims.entries())) {
        const isExpired =
          (claim.expiresAt && claim.expiresAt <= now) ||
          (claim.timestamp && now - claim.timestamp > maxAgeMs);
        if (isExpired) {
          this.testStore.memoryActionClaims.delete(key);
          cleanedCount++;
        }
      }
    }

    return { cleanedCount };
  }

  async getActionClaim(
    clientActionId: string
  ): Promise<ActionClaimRecord | null> {
    this.checkSimulatedFailure("failGetActionClaim", "getActionClaim", undefined, clientActionId);

    if (this.useLiveBackend) {
      try {
        const rtdb = getAdminDatabase();
        const sanitizedKey = encodeURIComponent(clientActionId).replace(/\./g, "%2E");
        const snap = await rtdb.ref(`actionClaims/${sanitizedKey}`).get();
        if (snap.exists()) {
          return snap.val();
        }
        return null;
      } catch (err) {
        logStructuredError({
          requestId: "internal_repo",
          gameId: "unknown",
          actionId: clientActionId,
          errorCategory: "PERSISTENCE_FAILURE",
          operation: "getActionClaim",
          message: `Failed to get action claim from RTDB: ${err instanceof Error ? err.message : String(err)}`,
          error: err,
        });
        throw new PersistenceError(`Failed to read action claim '${clientActionId}' from persistent store.`, {
          operation: "getActionClaim",
          actionId: clientActionId,
          cause: err,
        });
      }
    }

    if (!this.testStore) return null;
    const mem = this.testStore.memoryActionClaims.get(clientActionId);
    return mem ? { ...mem } : null;
  }

  // --- Combined Aggregate ---
  async getGameAggregate(gameId: string): Promise<{ session: GameSession; state: GameState } | null> {
    const session = await this.getGameSession(gameId);
    if (!session) return null;

    let state = await this.getEphemeralGameState(gameId);
    if (!state) {
      // Initialize ephemeral state if missing
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
        turnPlayerId: session.playerIds[0] || null,
        roundStartedAtServer: Date.now(),
        roundDeadlineServer: Date.now() + 60000,
        serverTimestamp: Date.now(),
        data: {},
        processedActionIds: {},
        processedActions: {},
        isFinished: false,
        winnerId: null,
      };
      await this.saveEphemeralGameState(state);
    }

    return { session, state };
  }
}

export const serverGameRepository = new ServerGameRepository();

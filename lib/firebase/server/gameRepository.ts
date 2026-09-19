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
import type { GameSession, GameState, GameResult } from "@/types/domain";
import { PersistenceError } from "./errors";
import { logStructuredError } from "./logger";

export { PersistenceError } from "./errors";
export { logStructuredError, type ErrorCategory, type StructuredLogPayload } from "./logger";

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
  failSaveGameResult?: boolean | Error;
  failGetGameResult?: boolean | Error;
  failGetActionClaim?: boolean | Error;
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
  readonly memoryResults = new Map<string, GameResult>();
  readonly memoryActionClaims = new Map<string, { gameId: string; playerId: string; timestamp: number }>();
  readonly gameLocks = new Map<string, Promise<void>>();
  readonly actionClaimLocks = new Map<string, Promise<void>>();

  clear(): void {
    this.memorySessions.clear();
    this.memoryStates.clear();
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

  // Action ID Scoping & Cross-Game Replay Prevention
  checkAndClaimActionId(
    clientActionId: string,
    gameId: string,
    playerId: string,
    timestamp?: number
  ): Promise<{ allowed: boolean; existingGameId?: string }>;
  getActionClaim(clientActionId: string): Promise<{ gameId: string; playerId: string; timestamp: number } | null>;

  // Combined atomic snapshot
  getGameAggregate(gameId: string): Promise<{ session: GameSession; state: GameState } | null>;

  // Testing & Reset helpers (strictly isolated from production authority)
  clearForTesting(): void;
  seedGame(session: GameSession, state?: GameState): void;
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

  seedGame(session: GameSession, state?: GameState): void {
    if (!this.testStore) {
      throw new Error(
        "Invalid Operation: seedGame is an isolated test fixture helper. Live ServerGameRepository persists only to Firebase."
      );
    }
    this.testStore.memorySessions.set(session.gameId, { ...session });
    if (state) {
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

    if (this.useLiveBackend) {
      try {
        const rtdb = getAdminDatabase();
        await rtdb.ref(`gameStates/${state.gameId}`).set(state);
        return;
      } catch (err) {
        logStructuredError({
          requestId: "internal_repo",
          gameId: state.gameId,
          actionId: "none",
          errorCategory: "PERSISTENCE_FAILURE",
          operation: "saveEphemeralGameState",
          message: `RTDB saveEphemeralGameState failed: ${err instanceof Error ? err.message : String(err)}`,
          error: err,
        });
        throw new PersistenceError(`Failed to commit ephemeral game state '${state.gameId}' to persistent store.`, {
          operation: "saveEphemeralGameState",
          gameId: state.gameId,
          cause: err,
        });
      }
    }

    if (!this.testStore) {
      throw new PersistenceError("No live backend or test store configured for saveEphemeralGameState.", {
        operation: "saveEphemeralGameState",
        gameId: state.gameId,
      });
    }
    this.testStore.memoryStates.set(state.gameId, JSON.parse(JSON.stringify(state)) as GameState);
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
    timestamp: number = Date.now()
  ): Promise<{ allowed: boolean; existingGameId?: string }> {
    this.checkSimulatedFailure("failCheckAndClaimActionId", "checkAndClaimActionId", gameId, clientActionId);

    if (this.useLiveBackend) {
      try {
        const rtdb = getAdminDatabase();
        const sanitizedKey = encodeURIComponent(clientActionId).replace(/\./g, "%2E");
        const claimRef = rtdb.ref(`actionClaims/${sanitizedKey}`);

        let existingGameId: string | undefined;
        let allowed = true;

        await claimRef.transaction((current) => {
          if (current && typeof current === "object" && "gameId" in current) {
            const currentClaim = current as { gameId: string; playerId: string; timestamp: number };
            if (currentClaim.gameId && currentClaim.gameId !== gameId) {
              existingGameId = currentClaim.gameId;
              allowed = false;
              return undefined; // abort transaction in RTDB
            }
            return current; // keep current claim
          }
          return { gameId, playerId, timestamp };
        });

        return { allowed, existingGameId };
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
      if (existing && existing.gameId !== gameId) {
        return { allowed: false, existingGameId: existing.gameId };
      }
      if (!existing) {
        this.testStore!.memoryActionClaims.set(clientActionId, { gameId, playerId, timestamp });
      }
      return { allowed: true };
    });
  }

  async getActionClaim(
    clientActionId: string
  ): Promise<{ gameId: string; playerId: string; timestamp: number } | null> {
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

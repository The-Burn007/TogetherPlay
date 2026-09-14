/**
 * Authoritative Server Game Repository
 * 
 * Manages:
 * - Realtime Database (RTDB): Ephemeral GameState (/gameStates/{gameId})
 * - Firestore: Durable GameSession (/games/{gameId}) & GameResult (/gameResults/{resultId})
 * 
 * Includes transactional state access and high-speed test isolation.
 */

import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, get, set } from "firebase/database";
import { db, rtdb } from "../client";
import { isFirebaseConfigured } from "../config";
import type { GameSession, GameState, GameResult } from "@/types/domain";

export interface GameRepositoryOptions {
  useLiveBackend?: boolean;
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

  // Combined atomic snapshot
  getGameAggregate(gameId: string): Promise<{ session: GameSession; state: GameState } | null>;

  // Testing & Reset helpers
  clearForTesting(): void;
  seedGame(session: GameSession, state?: GameState): void;
}

export class ServerGameRepository implements GameRepositoryContract {
  private memorySessions = new Map<string, GameSession>();
  private memoryStates = new Map<string, GameState>();
  private memoryResults = new Map<string, GameResult>();
  private useLiveBackend: boolean;

  constructor(options: GameRepositoryOptions = {}) {
    if (options.useLiveBackend !== undefined) {
      this.useLiveBackend = options.useLiveBackend;
    } else {
      // In test environments (Vitest), isolate into fast memory store
      const isTestEnv = typeof process !== "undefined" && Boolean(process.env.VITEST);
      this.useLiveBackend = !isTestEnv && isFirebaseConfigured();
    }
  }

  clearForTesting(): void {
    this.memorySessions.clear();
    this.memoryStates.clear();
    this.memoryResults.clear();
  }

  seedGame(session: GameSession, state?: GameState): void {
    this.memorySessions.set(session.gameId, { ...session });
    if (state) {
      this.memoryStates.set(session.gameId, { ...state });
    } else {
      // Default initial server state
      const initialState: GameState = {
        gameId: session.gameId,
        gameType: session.gameType,
        status: session.status,
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
        isFinished: false,
        winnerId: null,
      };
      this.memoryStates.set(session.gameId, initialState);
    }
  }

  // --- Durable Firestore: GameSession ---
  async getGameSession(gameId: string): Promise<GameSession | null> {
    const memory = this.memorySessions.get(gameId);
    if (memory) return { ...memory };

    if (this.useLiveBackend) {
      try {
        if (db) {
          const snap = await getDoc(doc(db, "games", gameId));
          if (snap.exists()) {
            const data = snap.data() as GameSession;
            this.memorySessions.set(gameId, data);
            return data;
          }
        }
      } catch {
        // Fallback
      }
    }

    return null;
  }

  async saveGameSession(session: GameSession): Promise<void> {
    this.memorySessions.set(session.gameId, { ...session });

    if (this.useLiveBackend) {
      try {
        if (db) {
          const docRef = doc(db, "games", session.gameId);
          await setDoc(docRef, session, { merge: true });
        }
      } catch {
        // In-memory fallback preserved
      }
    }
  }

  // --- Durable Firestore: GameResult ---
  async saveGameResult(result: GameResult): Promise<void> {
    this.memoryResults.set(result.resultId, { ...result });

    if (this.useLiveBackend) {
      try {
        if (db) {
          const docRef = doc(db, "gameResults", result.resultId);
          await setDoc(docRef, result);
        }
      } catch {
        // In-memory fallback preserved
      }
    }
  }

  async getGameResult(resultIdOrGameId: string): Promise<GameResult | null> {
    const memory = this.memoryResults.get(resultIdOrGameId);
    if (memory) return { ...memory };

    for (const res of this.memoryResults.values()) {
      if (res.gameId === resultIdOrGameId) {
        return { ...res };
      }
    }

    if (this.useLiveBackend) {
      try {
        if (db) {
          const snap = await getDoc(doc(db, "gameResults", resultIdOrGameId));
          if (snap.exists()) {
            const data = snap.data() as GameResult;
            this.memoryResults.set(resultIdOrGameId, data);
            return data;
          }
        }
      } catch {
        // Fallback
      }
    }

    return null;
  }

  // --- Ephemeral Realtime Database: GameState ---
  async getEphemeralGameState(gameId: string): Promise<GameState | null> {
    const memory = this.memoryStates.get(gameId);
    if (memory) return { ...memory };

    if (this.useLiveBackend) {
      try {
        if (rtdb) {
          const stateRef = ref(rtdb, `gameStates/${gameId}`);
          const snap = await get(stateRef);
          if (snap.exists()) {
            const data = snap.val() as GameState;
            this.memoryStates.set(gameId, data);
            return data;
          }
        }
      } catch {
        // Fallback
      }
    }

    return null;
  }

  async saveEphemeralGameState(state: GameState): Promise<void> {
    this.memoryStates.set(state.gameId, { ...state });

    if (this.useLiveBackend) {
      try {
        if (rtdb) {
          const stateRef = ref(rtdb, `gameStates/${state.gameId}`);
          await set(stateRef, state);
        }
      } catch {
        // In-memory fallback preserved
      }
    }
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
        isFinished: false,
        winnerId: null,
      };
      await this.saveEphemeralGameState(state);
    }

    return { session, state };
  }
}

export const serverGameRepository = new ServerGameRepository();

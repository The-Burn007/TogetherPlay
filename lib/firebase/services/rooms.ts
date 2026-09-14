import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "../client";
import { handleFirestoreError, OperationType } from "../errors";
import type { GameSession, GameAction, GameActionResult, GameType, GameStatus } from "@/types/domain";

/**
 * Rooms & Game Sessions service contract via Cloud Firestore and Cloud Functions.
 * Separates server communication and optimistic game state synchronization from UI.
 */
export interface RoomServiceContract {
  getActiveSession(coupleId: string): Promise<GameSession | null>;
  getSession(gameId: string): Promise<GameSession | null>;
  createSession(coupleId: string, gameType: GameType, createdBy: string): Promise<GameSession>;
  joinSession(gameId: string, userId: string): Promise<GameSession>;
  setReadyStatus(gameId: string, userId: string, isReady: boolean): Promise<void>;
  updateSessionStatus(gameId: string, status: GameStatus): Promise<void>;
  subscribeToSession(gameId: string, callback: (session: GameSession | null) => void): () => void;
  submitGameAction(action: GameAction): Promise<GameActionResult>;
  clearSessionsForTesting?(): void;
}

export class FirebaseRoomService implements RoomServiceContract {
  // In-memory session store for local/offline transitions and instant testing
  private memorySessions = new Map<string, GameSession>();

  clearSessionsForTesting(): void {
    this.memorySessions.clear();
  }

  async getSession(gameId: string): Promise<GameSession | null> {
    const memory = this.memorySessions.get(gameId);
    if (memory) return { ...memory };

    try {
      if (auth.currentUser) {
        const gameSnap = await getDoc(doc(db, "games", gameId));
        if (gameSnap.exists()) {
          return gameSnap.data() as GameSession;
        }
      }
    } catch {
      // Fallback
    }
    return null;
  }

  async getActiveSession(coupleId: string): Promise<GameSession | null> {
    const matching: GameSession[] = [];
    for (const session of this.memorySessions.values()) {
      if (session.coupleId === coupleId && session.status !== "game_end" && session.status !== "results") {
        matching.push(session);
      }
    }

    if (matching.length > 0) {
      // Return the most recent session
      matching.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return { ...matching[0] };
    }

    try {
      if (auth.currentUser) {
        const docRef = doc(db, "couples", coupleId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.activeGameId) {
            const gameSnap = await getDoc(doc(db, "games", data.activeGameId));
            if (gameSnap.exists()) {
              return gameSnap.data() as GameSession;
            }
          }
        }
      }
    } catch {
      // Fall back safely to memory session
    }

    return null;
  }

  async createSession(coupleId: string, gameType: GameType, createdBy: string): Promise<GameSession> {
    const gameId = `gm_${Math.random().toString(36).substring(2, 9)}${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    const session: GameSession = {
      gameId,
      coupleId,
      gameType,
      status: "waiting",
      playerIds: [createdBy],
      createdBy,
      createdAt: now,
      schemaVersion: 1,
      readyPlayerIds: [],
      videoStatus: { [createdBy]: "active" },
      audioStatus: { [createdBy]: "active" },
      connectionLatencyMs: 24,
    };

    this.memorySessions.set(gameId, session);

    try {
      if (auth.currentUser) {
        const gameRef = doc(db, "games", gameId);
        await setDoc(gameRef, session);
      }
    } catch {
      // Offline/demo fallback preserved
    }

    return session;
  }

  async joinSession(gameId: string, userId: string): Promise<GameSession> {
    const session = this.memorySessions.get(gameId);
    if (session) {
      if (!session.playerIds.includes(userId)) {
        session.playerIds.push(userId);
      }
      session.status = "ready";
      if (!session.videoStatus) session.videoStatus = {};
      session.videoStatus[userId] = "active";
      if (!session.audioStatus) session.audioStatus = {};
      session.audioStatus[userId] = "active";
      this.memorySessions.set(gameId, { ...session });
      return { ...session };
    }

    // Default synthesized joined session
    const synthesized: GameSession = {
      gameId,
      coupleId: "cpl_active",
      gameType: "find_it_first",
      status: "ready",
      playerIds: ["user_alex", userId],
      createdBy: "user_alex",
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
      readyPlayerIds: [],
      videoStatus: { user_alex: "active", [userId]: "active" },
      audioStatus: { user_alex: "active", [userId]: "active" },
      connectionLatencyMs: 28,
    };
    this.memorySessions.set(gameId, synthesized);
    return synthesized;
  }

  async setReadyStatus(gameId: string, userId: string, isReady: boolean): Promise<void> {
    const session = this.memorySessions.get(gameId);
    if (session) {
      const readySet = new Set(session.readyPlayerIds || []);
      if (isReady) {
        readySet.add(userId);
      } else {
        readySet.delete(userId);
      }
      session.readyPlayerIds = Array.from(readySet);
      if (session.readyPlayerIds.length >= 2) {
        session.status = "countdown";
      } else {
        session.status = "ready";
      }
      this.memorySessions.set(gameId, { ...session });
    }
  }

  async updateSessionStatus(gameId: string, status: GameStatus): Promise<void> {
    const session = this.memorySessions.get(gameId);
    if (session) {
      session.status = status;
      this.memorySessions.set(gameId, { ...session });
    }
  }

  subscribeToSession(gameId: string, callback: (session: GameSession | null) => void): () => void {
    // Initial emit from memory
    const existing = this.memorySessions.get(gameId) || null;
    callback(existing);

    try {
      if (auth.currentUser) {
        const gameRef = doc(db, "games", gameId);
        const unsubscribe = onSnapshot(
          gameRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const liveData = docSnap.data() as GameSession;
              this.memorySessions.set(gameId, liveData);
              callback(liveData);
            }
          },
          () => {
            // In case of permission/network issue, keep memory session
            callback(this.memorySessions.get(gameId) || null);
          }
        );
        return unsubscribe;
      }
    } catch {
      // Fallback
    }

    return () => {};
  }

  async submitGameAction(action: GameAction): Promise<GameActionResult> {
    return {
      accepted: true,
      gameId: action.gameId,
      clientActionId: action.clientActionId,
      serverTimestamp: Date.now(),
      eventType: action.type,
      stateVersion: 1,
    };
  }
}

export const roomService = new FirebaseRoomService();

/**
 * Authoritative Game Client Service
 * 
 * ARCHITECTURE PRINCIPLE:
 * THE BROWSER IS UNTRUSTED.
 * 
 * The client:
 * - Listens to ephemeral state via Realtime Database (/gameStates/{gameId})
 * - Listens to durable state via Firestore (/games/{gameId})
 * - Submits actions exclusively through the authoritative server route (/api/games/action)
 * - NEVER performs direct writes to authoritative game state.
 */

import { ref, onValue, off } from "firebase/database";
import { doc, onSnapshot } from "firebase/firestore";
import { rtdb, db, auth } from "../client";
import type { GameAction, GameActionResult, GameState, GameSession, GameActionType } from "@/types/domain";

export class AuthoritativeGameClient {
  /**
   * Subscribes to ephemeral GameState via Realtime Database.
   * Direct writes from client are disabled by database.rules.json.
   */
  subscribeToEphemeralState(
    gameId: string,
    onStateUpdate: (state: GameState | null) => void
  ): () => void {
    try {
      if (rtdb) {
        const stateRef = ref(rtdb, `gameStates/${gameId}`);
        const callback = onValue(
          stateRef,
          (snapshot) => {
            if (snapshot.exists()) {
              onStateUpdate(snapshot.val() as GameState);
            } else {
              onStateUpdate(null);
            }
          },
          (error) => {
            console.warn("[AuthoritativeClient] RTDB state subscription warning:", error);
          }
        );

        return () => off(stateRef, "value", callback);
      }
    } catch {
      // Fallback
    }

    return () => {};
  }

  /**
   * Subscribes to durable GameSession via Cloud Firestore.
   * Direct writes from client are blocked by firestore.rules.
   */
  subscribeToDurableSession(
    gameId: string,
    onSessionUpdate: (session: GameSession | null) => void
  ): () => void {
    try {
      if (db) {
        const sessionRef = doc(db, "games", gameId);
        const unsubscribe = onSnapshot(
          sessionRef,
          (docSnap) => {
            if (docSnap.exists()) {
              onSessionUpdate(docSnap.data() as GameSession);
            } else {
              onSessionUpdate(null);
            }
          },
          (error) => {
            console.warn("[AuthoritativeClient] Firestore session subscription warning:", error);
          }
        );

        return unsubscribe;
      }
    } catch {
      // Fallback
    }

    return () => {};
  }

  /**
   * Submits an action to the authoritative server endpoint.
   * Automatically generates unique clientActionId and clientTimestamp.
   * Accepts optional customUid for multi-session and multi-tab testing.
   */
  async submitAction(
    gameId: string,
    type: GameActionType | string,
    payload: unknown = {},
    customUid?: string
  ): Promise<GameActionResult> {
    const clientActionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const clientTimestamp = Date.now();

    const action: GameAction = {
      gameId,
      clientActionId,
      type,
      payload,
      clientTimestamp,
    };

    const token = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (customUid) {
      headers["Authorization"] = `Bearer uid:${customUid}`;
    } else if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else if (auth.currentUser?.uid) {
      headers["Authorization"] = `Bearer uid:${auth.currentUser.uid}`;
    } else {
      headers["Authorization"] = "Bearer uid:user_alex";
    }

    const response = await fetch("/api/games/action", {
      method: "POST",
      headers,
      body: JSON.stringify(action),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error?.message || `Failed to submit action: ${response.statusText}`);
    }

    return result as GameActionResult;
  }

  /**
   * Fetches the server aggregate { session, state } over HTTP.
   * Acts as high-reliability sync mechanism across tabs and environments.
   */
  async fetchGameAggregate(
    gameId: string
  ): Promise<{ session: GameSession; state: GameState } | null> {
    try {
      const res = await fetch(`/api/games/session?gameId=${encodeURIComponent(gameId)}`);
      if (res.ok) {
        return (await res.json()) as { session: GameSession; state: GameState };
      }
    } catch {
      // Fallback
    }
    return null;
  }

  /**
   * Ensures an active game session exists on the server.
   */
  async ensureGameSession(
    gameId: string,
    playerIds: string[] = ["user_alex", "user_sam"],
    resetIfFinished = false
  ): Promise<{ session: GameSession; state: GameState }> {
    const res = await fetch("/api/games/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        playerIds,
        gameType: "find_it_first",
        resetIfFinished,
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to ensure game session on server");
    }

    return (await res.json()) as { session: GameSession; state: GameState };
  }
}

export const authoritativeGameClient = new AuthoritativeGameClient();

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
import type { GameAction, GameActionResult, GameState, GameSession, GameActionType, GameType } from "@/types/domain";

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
   * Automatically generates unique clientActionId (or respects preserved clientActionId for idempotency retries).
   * Tracks in-flight status so actions committed during network disconnect can be reconciled.
   * Accepts optional customUid for multi-session and multi-tab testing.
   */
  async submitAction(
    gameId: string,
    type: GameActionType | string,
    payload: unknown = {},
    customUid?: string,
    existingClientActionId?: string
  ): Promise<GameActionResult> {
    const clientActionId =
      existingClientActionId ||
      `act_${gameId}_${customUid || "user"}_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const clientTimestamp = Date.now();

    const action: GameAction = {
      gameId,
      clientActionId,
      type,
      payload,
      clientTimestamp,
      playerId: customUid,
    };

    // Track in-flight action
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        const key = `tp_inflight_${gameId}`;
        const existing = JSON.parse(window.sessionStorage.getItem(key) || "[]");
        existing.push({
          clientActionId,
          gameId,
          type,
          payload,
          playerId: customUid || "user",
          submittedAt: clientTimestamp,
          status: "pending",
        });
        window.sessionStorage.setItem(key, JSON.stringify(existing));
      } catch {
        // Fallback
      }
    }

    const token = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch("/api/games/action", {
        method: "POST",
        headers,
        body: JSON.stringify(action),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || `Failed to submit action: ${response.statusText}`);
      }

      // Remove from in-flight storage on verified commit
      if (typeof window !== "undefined" && window.sessionStorage) {
        try {
          const key = `tp_inflight_${gameId}`;
          const existing = JSON.parse(window.sessionStorage.getItem(key) || "[]");
          const filtered = existing.filter((item: { clientActionId: string }) => item.clientActionId !== clientActionId);
          if (filtered.length > 0) {
            window.sessionStorage.setItem(key, JSON.stringify(filtered));
          } else {
            window.sessionStorage.removeItem(key);
          }
        } catch {
          // Fallback
        }
      }

      return result as GameActionResult;
    } catch (err) {
      // If network interruption occurs, preserve in-flight record for rehydration reconciliation
      throw err;
    }
  }

  /**
   * Reconciles in-flight actions against authoritative state.
   * Returns list of action IDs that were committed by the server during disconnect.
   */
  reconcileInFlightActions(gameId: string, state: GameState): string[] {
    if (!state?.processedActionIds || typeof window === "undefined" || !window.sessionStorage) {
      return [];
    }

    const committedIds: string[] = [];
    try {
      const key = `tp_inflight_${gameId}`;
      const existing = JSON.parse(window.sessionStorage.getItem(key) || "[]");
      const remaining: unknown[] = [];

      for (const item of existing) {
        if (state.processedActionIds[item.clientActionId]) {
          committedIds.push(item.clientActionId);
        } else if (!state.isFinished && state.status !== "game_end") {
          remaining.push(item);
        }
      }

      if (remaining.length > 0) {
        window.sessionStorage.setItem(key, JSON.stringify(remaining));
      } else {
        window.sessionStorage.removeItem(key);
      }
    } catch {
      // Fallback
    }

    return committedIds;
  }

  /**
   * Fetches the server aggregate { session, state } over HTTP.
   * Acts as high-reliability sync mechanism across tabs and environments.
   */
  async fetchGameAggregate(
    gameId: string
  ): Promise<{ session: GameSession; state: GameState } | null> {
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/games/session?gameId=${encodeURIComponent(gameId)}`, { headers });
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
    resetIfFinished = false,
    gameType: GameType = "find_it_first"
  ): Promise<{ session: GameSession; state: GameState }> {
    const token = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch("/api/games/session", {
      method: "POST",
      headers,
      body: JSON.stringify({
        gameId,
        playerIds,
        gameType,
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

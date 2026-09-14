import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";

const db = getFirestore();

const actionSchema = z.object({
  gameId: z.string().min(1).max(128),
  clientActionId: z.string().uuid(),
  type: z.enum([
    "JOIN_GAME",
    "READY",
    "START_GAME",
    "ROLL_DICE",
    "SELECT_CELL",
    "SUBMIT_REACTION",
    "SUBMIT_CAMERA_CHALLENGE",
    "END_GAME",
    "REMATCH",
  ]),
  payload: z.unknown(),
  clientTimestamp: z.number().int(),
});

export const submitGameAction = onCall(
  {
    enforceAppCheck: true,
    consumeAppCheckToken: false,
    region: "europe-west1",
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const parsed = actionSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Invalid game action.");
    }

    const uid = request.auth.uid;
    const action = parsed.data;
    const gameRef = db.collection("games").doc(action.gameId);
    const eventRef = gameRef.collection("events").doc(action.clientActionId);

    const result = await db.runTransaction(async (tx) => {
      const [gameSnap, existingEvent] = await Promise.all([
        tx.get(gameRef),
        tx.get(eventRef),
      ]);

      if (existingEvent.exists) {
        return existingEvent.data();
      }

      if (!gameSnap.exists) {
        throw new HttpsError("not-found", "Game not found.");
      }

      const game = gameSnap.data()!;

      if (!Array.isArray(game.playerIds) || !game.playerIds.includes(uid)) {
        throw new HttpsError("permission-denied", "Not a player in this game.");
      }

      if (game.status === "game_end" || game.status === "results") {
        throw new HttpsError("failed-precondition", "Game is already finished.");
      }

      // MVP contract:
      // Implement game-specific validation here and update authoritative
      // state inside the same transaction. Never accept client scores,
      // dice values, winner IDs or authoritative timestamps.

      const resultData = {
        accepted: true,
        gameId: action.gameId,
        clientActionId: action.clientActionId,
        playerId: uid,
        eventType: action.type,
        stateVersion: Number(game.stateVersion ?? 0) + 1,
        createdAt: FieldValue.serverTimestamp(),
      };

      tx.update(gameRef, {
        stateVersion: resultData.stateVersion,
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.set(eventRef, resultData);

      return resultData;
    });

    return {
      ...result,
      serverTimestamp: Date.now(),
    };
  },
);

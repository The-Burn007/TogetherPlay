import { describe, it, expect, beforeEach } from "vitest";
import { ServerGameRepository } from "@/lib/firebase/server/gameRepository";
import { submitGameAction } from "@/lib/firebase/server/submitGameAction";
import type { GameSession, GameState, GameAction } from "@/types/domain";

describe("Network Resilience Layer: Disconnect, Latency & State Recovery", () => {
  let repository: ServerGameRepository;
  const GAME_ID = "net_test_game_999";
  const PLAYER_A = "usr_network_alex";
  const PLAYER_B = "usr_network_sam";
  const COUPLE_ID = "cpl_net_test";

  beforeEach(() => {
    repository = new ServerGameRepository();
  });

  function seedActiveGame(round = 2, scores = { [PLAYER_A]: 10, [PLAYER_B]: 15 }) {
    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "find_it_first",
      status: "playing",
      playerIds: [PLAYER_A, PLAYER_B],
      readyPlayerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    const state: GameState = {
      gameId: GAME_ID,
      gameType: "find_it_first",
      status: "playing",
      currentRound: round,
      maxRounds: 5,
      version: 4,
      scores,
      roundStartedAtServer: Date.now(),
      roundDeadlineServer: Date.now() + 30000,
      serverTimestamp: Date.now(),
      processedActionIds: {
        act_round_1_a: Date.now() - 5000,
        act_round_1_b: Date.now() - 4800,
      },
      isFinished: false,
      data: {
        targetId: "compass",
        board: ["watch", "compass", "key", "seal", "pen", "hourglass", "prism", "book", "camera", "bell", "monocle", "mug"],
        roundAnswers: {},
      },
    };

    repository.seedGame(session, state);
    return { session, state };
  }

  describe("1. Disconnect Handling", () => {
    it("marks player disconnected without losing game state or corrupting scores", async () => {
      seedActiveGame();

      // Submit disconnect notification
      const disconnectAction: GameAction = {
        gameId: GAME_ID,
        clientActionId: "act_disconnect_b_1",
        type: "PLAYER_DISCONNECT",
        payload: { reason: "socket_closed" },
        clientTimestamp: Date.now(),
      };

      const result = await submitGameAction(disconnectAction, {
        auth: { uid: PLAYER_B },
        repository,
        enforceAppCheck: false,
      });

      expect(result.accepted).toBe(true);
      const serverState = await repository.getEphemeralGameState(GAME_ID);
      expect(serverState?.scores[PLAYER_A]).toBe(10);
      expect(serverState?.scores[PLAYER_B]).toBe(15);
      expect(serverState?.currentRound).toBe(2);
    });
  });

  describe("2. Reconnect & State Synchronization", () => {
    it("restores active player state upon reconnect and returns authoritative snapshot", async () => {
      seedActiveGame();

      const reconnectAction: GameAction = {
        gameId: GAME_ID,
        clientActionId: "act_reconnect_b_1",
        type: "PLAYER_RECONNECT",
        payload: { clientVersion: 4 },
        clientTimestamp: Date.now(),
      };

      const result = await submitGameAction(reconnectAction, {
        auth: { uid: PLAYER_B },
        repository,
        enforceAppCheck: false,
      });

      expect(result.accepted).toBe(true);
      expect(result.gameState.status).toBe("playing");
      expect(result.gameState.scores[PLAYER_B]).toBe(15);
      expect(result.gameState.version).toBeGreaterThanOrEqual(4);
    });
  });

  describe("3. Slow Network & Out-of-Order Action Resolution", () => {
    it("handles delayed actions and drops duplicate retransmissions via idempotency", async () => {
      seedActiveGame();

      const actionId = "slow_net_tap_101";
      const tapAction: GameAction = {
        gameId: GAME_ID,
        clientActionId: actionId,
        type: "SELECT_CELL",
        payload: { cellId: "compass" },
        clientTimestamp: Date.now() - 1200, // 1.2 second delayed transmission
      };

      // First transmission arrives
      const firstResult = await submitGameAction(tapAction, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      });

      expect(firstResult.accepted).toBe(true);
      expect(firstResult.idempotentDuplicate).toBe(false);
      const scoreAfterFirst = firstResult.gameState.scores[PLAYER_A];

      // Second identical transmission arrives (due to client retry on slow timeout)
      const duplicateResult = await submitGameAction(tapAction, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      });

      expect(duplicateResult.accepted).toBe(true);
      expect(duplicateResult.idempotentDuplicate).toBe(true);
      // Score MUST NOT increment again
      expect(duplicateResult.gameState.scores[PLAYER_A]).toBe(scoreAfterFirst);
    });
  });

  describe("4. Refresh During Game", () => {
    it("allows a browser tab to refresh and fully hydrate the exact ongoing state", async () => {
      const initialScores = { [PLAYER_A]: 25, [PLAYER_B]: 30 };
      seedActiveGame(3, initialScores);

      // Simulated fresh client startup: Client starts with clean state and fetches by gameId
      const hydratedSession = await repository.getGameSession(GAME_ID);
      const hydratedState = await repository.getEphemeralGameState(GAME_ID);

      expect(hydratedSession).not.toBeNull();
      expect(hydratedState).not.toBeNull();
      expect(hydratedSession?.status).toBe("playing");
      expect(hydratedState?.currentRound).toBe(3);
      expect(hydratedState?.scores[PLAYER_A]).toBe(25);
      expect(hydratedState?.scores[PLAYER_B]).toBe(30);
      expect(hydratedState?.isFinished).toBe(false);

      // Client can immediately execute the next move
      const nextMove: GameAction = {
        gameId: GAME_ID,
        clientActionId: "act_post_refresh_move",
        type: "SELECT_CELL",
        payload: { cellId: "compass" },
        clientTimestamp: Date.now(),
      };

      const result = await submitGameAction(nextMove, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      });

      expect(result.accepted).toBe(true);
      expect(result.gameState.scores[PLAYER_A]).toBeGreaterThan(25);
    });
  });

  describe("5. Partner Leaves and Returns Flow", () => {
    it("handles partner departure, pause notification, and seamless return to gameplay", async () => {
      seedActiveGame();

      // Partner B disconnects
      const leaveAction: GameAction = {
        gameId: GAME_ID,
        clientActionId: "act_leave_partner_b",
        type: "PLAYER_DISCONNECT",
        payload: { reason: "window_hidden" },
        clientTimestamp: Date.now(),
      };

      const leaveResult = await submitGameAction(leaveAction, {
        auth: { uid: PLAYER_B },
        repository,
        enforceAppCheck: false,
      });

      expect(leaveResult.accepted).toBe(true);

      // Partner A continues waiting, state remains preserved
      const stateDuringAbsence = await repository.getEphemeralGameState(GAME_ID);
      expect(stateDuringAbsence?.scores[PLAYER_A]).toBe(10);
      expect(stateDuringAbsence?.scores[PLAYER_B]).toBe(15);

      // Partner B returns
      const returnAction: GameAction = {
        gameId: GAME_ID,
        clientActionId: "act_return_partner_b",
        type: "PLAYER_RECONNECT",
        payload: { resumed: true },
        clientTimestamp: Date.now(),
      };

      const returnResult = await submitGameAction(returnAction, {
        auth: { uid: PLAYER_B },
        repository,
        enforceAppCheck: false,
      });

      expect(returnResult.accepted).toBe(true);
      expect(returnResult.gameState.status).toBe("playing");
      expect(returnResult.gameState.scores[PLAYER_B]).toBe(15);
    });
  });
});

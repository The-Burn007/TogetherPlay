import { describe, it, expect, beforeEach } from "vitest";
import { submitGameAction, ActionValidationError } from "@/lib/firebase/server/submitGameAction";
import { ServerGameRepository } from "@/lib/firebase/server/gameRepository";
import type { GameSession, GameAction, GameState } from "@/types/domain";

describe("TogetherPlay Multiplayer Infrastructure & Security Architecture", () => {
  let repository: ServerGameRepository;
  const VALID_APP_CHECK_TOKEN = "valid-test-app-check-token";
  const PLAYER_A = "user_alex";
  const PLAYER_B = "user_sam";
  const OUTSIDER_USER = "user_malicious_attacker";
  const GAME_ID = "game_couples_duel_123";
  const COUPLE_ID = "cpl_tokyo_london_456";

  beforeEach(() => {
    repository = new ServerGameRepository();
    repository.clearForTesting();

    // Seed an active game session with exactly two couple members
    const initialSession: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "find_it_first",
      status: "playing",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date(Date.now() - 60000).toISOString(),
      startedAt: new Date(Date.now() - 30000).toISOString(),
      schemaVersion: 1,
      readyPlayerIds: [PLAYER_A, PLAYER_B],
    };

    const initialState: GameState = {
      gameId: GAME_ID,
      gameType: "find_it_first",
      status: "playing",
      currentRound: 1,
      maxRounds: 3,
      version: 1,
      scores: {
        [PLAYER_A]: 0,
        [PLAYER_B]: 0,
      },
      turnPlayerId: PLAYER_A,
      roundStartedAtServer: Date.now() - 5000,
      roundDeadlineServer: Date.now() + 25000, // 25 seconds remaining
      serverTimestamp: Date.now(),
      data: {
        targetAnswer: "TARGET_LOTUS",
      },
      processedActionIds: {},
      isFinished: false,
      winnerId: null,
    };

    repository.seedGame(initialSession, initialState);
  });

  describe("Validation 1 & 2: Authentication & App Check Enforcement", () => {
    it("rejects unauthenticated requests (missing auth context)", async () => {
      const action: GameAction = {
        gameId: GAME_ID,
        clientActionId: "act_unauth_1",
        type: "ROLL_DICE",
        payload: {},
        clientTimestamp: Date.now(),
      };

      await expect(
        submitGameAction(action, {
          auth: null,
          appCheckToken: VALID_APP_CHECK_TOKEN,
          enforceAppCheck: true,
          repository,
        })
      ).rejects.toThrowError(ActionValidationError);

      try {
        await submitGameAction(action, {
          auth: null,
          appCheckToken: VALID_APP_CHECK_TOKEN,
          enforceAppCheck: true,
          repository,
        });
      } catch (err: unknown) {
        const error = err as ActionValidationError;
        expect(error.code).toBe("UNAUTHENTICATED");
        expect(error.statusCode).toBe(401);
      }
    });

    it("rejects requests with missing or invalid App Check tokens", async () => {
      const action: GameAction = {
        gameId: GAME_ID,
        clientActionId: "act_appcheck_fail_1",
        type: "ROLL_DICE",
        payload: {},
        clientTimestamp: Date.now(),
      };

      // Missing App Check token
      await expect(
        submitGameAction(action, {
          auth: { uid: PLAYER_A },
          appCheckToken: null,
          enforceAppCheck: true,
          repository,
        })
      ).rejects.toThrowError(ActionValidationError);

      // Explicitly invalid App Check token
      try {
        await submitGameAction(action, {
          auth: { uid: PLAYER_A },
          appCheckToken: "invalid-token",
          enforceAppCheck: true,
          repository,
        });
      } catch (err: unknown) {
        const error = err as ActionValidationError;
        expect(error.code).toBe("APP_CHECK_INVALID");
        expect(error.statusCode).toBe(403);
      }
    });
  });

  describe("Validation 3 & 4: Game Existence & Player Membership", () => {
    it("rejects actions on non-existent games", async () => {
      const action: GameAction = {
        gameId: "non_existent_game_999",
        clientActionId: "act_not_found_1",
        type: "ROLL_DICE",
        payload: {},
        clientTimestamp: Date.now(),
      };

      try {
        await submitGameAction(action, {
          auth: { uid: PLAYER_A },
          appCheckToken: VALID_APP_CHECK_TOKEN,
          repository,
        });
        expect.unreachable("Expected submitGameAction to throw");
      } catch (err: unknown) {
        const error = err as ActionValidationError;
        expect(error.code).toBe("GAME_NOT_FOUND");
        expect(error.statusCode).toBe(404);
      }
    });

    it("rejects unauthorized users not belonging to the game session", async () => {
      const action: GameAction = {
        gameId: GAME_ID,
        clientActionId: "act_outsider_attack_1",
        type: "ROLL_DICE",
        payload: {},
        clientTimestamp: Date.now(),
      };

      try {
        await submitGameAction(action, {
          auth: { uid: OUTSIDER_USER },
          appCheckToken: VALID_APP_CHECK_TOKEN,
          repository,
        });
        expect.unreachable("Expected submitGameAction to throw");
      } catch (err: unknown) {
        const error = err as ActionValidationError;
        expect(error.code).toBe("PLAYER_NOT_IN_GAME");
        expect(error.statusCode).toBe(403);
      }
    });
  });

  describe("Validation 5 & 7: Game Active & State Permission", () => {
    it("rejects actions when game has already concluded", async () => {
      // Seed a finished game
      const finishedSession: GameSession = {
        gameId: "finished_game_777",
        coupleId: COUPLE_ID,
        gameType: "find_it_first",
        status: "game_end",
        playerIds: [PLAYER_A, PLAYER_B],
        createdBy: PLAYER_A,
        createdAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        winnerId: PLAYER_A,
        schemaVersion: 1,
      };

      const finishedState: GameState = {
        gameId: "finished_game_777",
        gameType: "find_it_first",
        status: "game_end",
        currentRound: 3,
        maxRounds: 3,
        version: 5,
        scores: { [PLAYER_A]: 30, [PLAYER_B]: 10 },
        roundStartedAtServer: Date.now() - 40000,
        roundDeadlineServer: Date.now() - 10000,
        serverTimestamp: Date.now(),
        data: {},
        processedActionIds: {},
        isFinished: true,
        winnerId: PLAYER_A,
      };

      repository.seedGame(finishedSession, finishedState);

      const action: GameAction = {
        gameId: "finished_game_777",
        clientActionId: "act_after_game_1",
        type: "ROLL_DICE",
        payload: {},
        clientTimestamp: Date.now(),
      };

      try {
        await submitGameAction(action, {
          auth: { uid: PLAYER_A },
          appCheckToken: VALID_APP_CHECK_TOKEN,
          repository,
        });
        expect.unreachable("Expected submitGameAction to throw");
      } catch (err: unknown) {
        const error = err as ActionValidationError;
        expect(error.code).toBe("GAME_NOT_ACTIVE");
        expect(error.statusCode).toBe(409);
      }
    });

    it("rejects actions disallowed for current game state (e.g. gameplay action in waiting state)", async () => {
      // Seed a waiting session
      const waitingSession: GameSession = {
        gameId: "waiting_game_888",
        coupleId: COUPLE_ID,
        gameType: "find_it_first",
        status: "waiting",
        playerIds: [PLAYER_A, PLAYER_B],
        createdBy: PLAYER_A,
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
      };

      const waitingState: GameState = {
        gameId: "waiting_game_888",
        gameType: "find_it_first",
        status: "waiting",
        currentRound: 1,
        maxRounds: 3,
        version: 1,
        scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
        roundStartedAtServer: Date.now(),
        roundDeadlineServer: 0,
        serverTimestamp: Date.now(),
        data: {},
        processedActionIds: {},
        isFinished: false,
      };

      repository.seedGame(waitingSession, waitingState);

      const action: GameAction = {
        gameId: "waiting_game_888",
        clientActionId: "act_premature_move",
        type: "ROLL_DICE",
        payload: {},
        clientTimestamp: Date.now(),
      };

      try {
        await submitGameAction(action, {
          auth: { uid: PLAYER_A },
          appCheckToken: VALID_APP_CHECK_TOKEN,
          repository,
        });
        expect.unreachable("Expected submitGameAction to throw");
      } catch (err: unknown) {
        const error = err as ActionValidationError;
        expect(error.code).toBe("ACTION_DISALLOWED_FOR_STATE");
        expect(error.statusCode).toBe(400);
      }
    });

    it("rejects action when server round timer has expired", async () => {
      const serverExpiredTimestamp = Date.now() + 50000; // Well past roundDeadlineServer

      const action: GameAction = {
        gameId: GAME_ID,
        clientActionId: "act_late_submission",
        type: "ROLL_DICE",
        payload: {},
        clientTimestamp: Date.now(),
      };

      try {
        await submitGameAction(action, {
          auth: { uid: PLAYER_A },
          appCheckToken: VALID_APP_CHECK_TOKEN,
          serverTimestamp: serverExpiredTimestamp,
          repository,
        });
        expect.unreachable("Expected submitGameAction to throw on expired timer");
      } catch (err: unknown) {
        const error = err as ActionValidationError;
        expect(error.code).toBe("ACTION_DISALLOWED_FOR_STATE");
        expect(error.message).toContain("deadline has expired");
      }
    });
  });

  describe("Validation 8 & Idempotency: Duplicate Action Protection", () => {
    it("executes an action once on initial submission", async () => {
      const action: GameAction = {
        gameId: GAME_ID,
        clientActionId: "unique_client_action_abc_1",
        type: "ROLL_DICE",
        payload: {},
        clientTimestamp: Date.now(),
      };

      const result = await submitGameAction(action, {
        auth: { uid: PLAYER_A },
        appCheckToken: VALID_APP_CHECK_TOKEN,
        repository,
      });

      expect(result.accepted).toBe(true);
      expect(result.idempotentDuplicate).toBe(false);
      expect(result.clientActionId).toBe("unique_client_action_abc_1");
      expect(result.stateVersion).toBe(2);
      expect(result.gameState.scores[PLAYER_A]).toBeGreaterThan(0);
    });

    it("enforces idempotency: duplicate action is executed ONLY ONCE and does not duplicate state changes", async () => {
      const duplicateActionId = "idempotent_action_uuid_999";
      const action: GameAction = {
        gameId: GAME_ID,
        clientActionId: duplicateActionId,
        type: "ROLL_DICE",
        payload: {},
        clientTimestamp: Date.now(),
      };

      // First submission
      const firstResult = await submitGameAction(action, {
        auth: { uid: PLAYER_A },
        appCheckToken: VALID_APP_CHECK_TOKEN,
        repository,
      });

      expect(firstResult.accepted).toBe(true);
      expect(firstResult.idempotentDuplicate).toBe(false);
      const scoreAfterFirstExecution = firstResult.gameState.scores[PLAYER_A];
      const stateVersionAfterFirst = firstResult.stateVersion;

      // Second submission with exact same clientActionId
      const secondResult = await submitGameAction(action, {
        auth: { uid: PLAYER_A },
        appCheckToken: VALID_APP_CHECK_TOKEN,
        repository,
      });

      expect(secondResult.accepted).toBe(true);
      expect(secondResult.idempotentDuplicate).toBe(true);
      expect(secondResult.clientActionId).toBe(duplicateActionId);

      // Score must NOT be incremented twice!
      expect(secondResult.gameState.scores[PLAYER_A]).toBe(scoreAfterFirstExecution);

      // State version must remain identical!
      expect(secondResult.stateVersion).toBe(stateVersionAfterFirst);
    });
  });

  describe("Server Authoritative Rule: Browser is Untrusted", () => {
    it("ignores client-controlled scores or outcomes in payload and enforces server calculation", async () => {
      const hackedPayload = {
        score: 999999, // Malicious client attempts to inject massive score
        winner: PLAYER_A,
        serverDiceValue: 100, // Malicious client attempts to rig dice
      };

      const action: GameAction = {
        gameId: GAME_ID,
        clientActionId: "act_tamper_scores_1",
        type: "ROLL_DICE",
        payload: hackedPayload,
        clientTimestamp: Date.now(),
      };

      const result = await submitGameAction(action, {
        auth: { uid: PLAYER_A },
        appCheckToken: VALID_APP_CHECK_TOKEN,
        repository,
      });

      // Score must be calculated server-side between 1 and 6, NOT 999999 or 100!
      const finalScore = result.gameState.scores[PLAYER_A];
      expect(finalScore).toBeGreaterThanOrEqual(1);
      expect(finalScore).toBeLessThanOrEqual(6);
      expect(finalScore).not.toBe(999999);
      expect(finalScore).not.toBe(100);
    });

    it("generates durable GameResult in Firestore upon game completion with server-evaluated winner", async () => {
      // Advance rounds until game concludes
      let currentState = (await repository.getEphemeralGameState(GAME_ID))!;
      currentState.currentRound = 3;
      currentState.scores = {
        [PLAYER_A]: 50,
        [PLAYER_B]: 30,
      };
      await repository.saveEphemeralGameState(currentState);

      const action: GameAction = {
        gameId: GAME_ID,
        clientActionId: "act_final_winning_move",
        type: "END_GAME",
        payload: {},
        clientTimestamp: Date.now(),
      };

      const result = await submitGameAction(action, {
        auth: { uid: PLAYER_A },
        appCheckToken: VALID_APP_CHECK_TOKEN,
        repository,
      });

      expect(result.gameState.isFinished).toBe(true);
      expect(result.gameState.status).toBe("game_end");
      expect(result.gameState.winnerId).toBe(PLAYER_A);

      // Durable GameResult persisted
      expect(result.gameResult).toBeDefined();
      expect(result.gameResult?.winnerId).toBe(PLAYER_A);
      expect(result.gameResult?.finalScores[PLAYER_A]).toBe(50);
      expect(result.gameResult?.finalScores[PLAYER_B]).toBe(30);

      // Durable session updated in Firestore repository
      const savedSession = await repository.getGameSession(GAME_ID);
      expect(savedSession?.status).toBe("game_end");
      expect(savedSession?.winnerId).toBe(PLAYER_A);
    });
  });
});

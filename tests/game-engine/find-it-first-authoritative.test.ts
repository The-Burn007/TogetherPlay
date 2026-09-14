import { describe, it, expect, beforeEach } from "vitest";
import { AuthoritativeGameEngine, ARTIFACT_CATALOG } from "@/lib/firebase/server/authoritativeGameEngine";
import { submitGameAction, ActionValidationError } from "@/lib/firebase/server/submitGameAction";
import { ServerGameRepository } from "@/lib/firebase/server/gameRepository";
import type { GameSession, GameState, GameAction } from "@/types/domain";

describe("Find It First - Authoritative Multiplayer Engine", () => {
  let repository: ServerGameRepository;
  const GAME_ID = "fif_test_game_123";
  const PLAYER_A = "user_alex";
  const PLAYER_B = "user_sam";
  const COUPLE_ID = "couple_london_tokyo";
  const VALID_APP_CHECK_TOKEN = "valid-test-app-check-token";

  beforeEach(() => {
    repository = new ServerGameRepository();
  });

  it("server generates an authoritative target and a 12-cell board", () => {
    const roundGen = AuthoritativeGameEngine.generateAuthoritativeRound(1, []);
    expect(roundGen.targetId).toBeDefined();
    expect(roundGen.target.name).toBeDefined();
    expect(roundGen.board).toHaveLength(12);
    expect(roundGen.board).toContain(roundGen.targetId);

    // Check that target is from catalog
    const inCatalog = ARTIFACT_CATALOG.some((a) => a.id === roundGen.targetId);
    expect(inCatalog).toBe(true);
  });

  it("server rejects client attempts to submit score, winner, or target in payload", async () => {
    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "find_it_first",
      status: "playing",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    const state: GameState = {
      gameId: GAME_ID,
      gameType: "find_it_first",
      status: "playing",
      currentRound: 1,
      maxRounds: 5,
      version: 1,
      scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
      roundStartedAtServer: Date.now(),
      roundDeadlineServer: Date.now() + 15000,
      serverTimestamp: Date.now(),
      data: {
        targetId: "watch",
        board: ["watch", "compass", "key", "seal", "pen", "hourglass", "prism", "book", "camera", "bell", "monocle", "mug"],
      },
      processedActionIds: {},
      isFinished: false,
    };

    repository.seedGame(session, state);

    // Client attempts to sneak in authoritative parameters
    const maliciousAction = {
      gameId: GAME_ID,
      clientActionId: "act_tamper_score",
      type: "SELECT_CELL",
      payload: {
        cellId: "watch",
        score: 9999, // FORBIDDEN
      },
      clientTimestamp: Date.now(),
    } as unknown as GameAction;

    try {
      await submitGameAction(maliciousAction, {
        auth: { uid: PLAYER_A },
        appCheckToken: VALID_APP_CHECK_TOKEN,
        repository,
        serverTimestamp: Date.now(),
      });
      expect.unreachable("Expected tamper action to throw");
    } catch (err) {
      const error = err as ActionValidationError;
      expect(error.code).toBe("INVALID_ACTION");
    }
  });

  it("server awards score authoritatively on correct SELECT_CELL and resolves round", async () => {
    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "find_it_first",
      status: "playing",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    const now = Date.now();
    const state: GameState = {
      gameId: GAME_ID,
      gameType: "find_it_first",
      status: "playing",
      currentRound: 1,
      maxRounds: 5,
      version: 1,
      scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
      roundStartedAtServer: now,
      roundDeadlineServer: now + 15000,
      serverTimestamp: now,
      data: {
        targetId: "watch",
        board: ["watch", "compass", "key", "seal", "pen", "hourglass", "prism", "book", "camera", "bell", "monocle", "mug"],
        roundWinnerId: null,
      },
      processedActionIds: {},
      isFinished: false,
    };

    repository.seedGame(session, state);

    // Player A selects correct cell
    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_correct_1",
      type: "SELECT_CELL",
      payload: { cellId: "watch" },
      clientTimestamp: now,
    };

    const result = await submitGameAction(action, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK_TOKEN,
      repository,
      serverTimestamp: now + 2000, // 2s after start
    });

    expect(result.accepted).toBe(true);
    expect(result.gameState.scores[PLAYER_A]).toBeGreaterThan(100); // 100 base + speed bonus
    expect(result.gameState.scores[PLAYER_B]).toBe(0);
    expect(result.gameState.data.roundWinnerId).toBe(PLAYER_A);
    expect(result.gameState.status).toBe("round_end");
  });

  it("server deducts penalty on incorrect SELECT_CELL and keeps round playing", async () => {
    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "find_it_first",
      status: "playing",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    const now = Date.now();
    const state: GameState = {
      gameId: GAME_ID,
      gameType: "find_it_first",
      status: "playing",
      currentRound: 1,
      maxRounds: 5,
      version: 1,
      scores: { [PLAYER_A]: 50, [PLAYER_B]: 50 },
      roundStartedAtServer: now,
      roundDeadlineServer: now + 15000,
      serverTimestamp: now,
      data: {
        targetId: "watch",
        board: ["watch", "compass", "key", "seal", "pen", "hourglass", "prism", "book", "camera", "bell", "monocle", "mug"],
        roundWinnerId: null,
      },
      processedActionIds: {},
      isFinished: false,
    };

    repository.seedGame(session, state);

    // Player B selects incorrect cell
    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_incorrect_1",
      type: "SELECT_CELL",
      payload: { cellId: "compass" },
      clientTimestamp: now,
    };

    const result = await submitGameAction(action, {
      auth: { uid: PLAYER_B },
      appCheckToken: VALID_APP_CHECK_TOKEN,
      repository,
      serverTimestamp: now + 1000,
    });

    expect(result.accepted).toBe(true);
    // Player B received -10 penalty
    expect(result.gameState.scores[PLAYER_B]).toBe(40);
    // Round is still playing so players can keep searching
    expect(result.gameState.status).toBe("playing");
  });

  it("transitions through 5 rounds and concludes with GameResult on round 5", async () => {
    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "find_it_first",
      status: "playing",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    const now = Date.now();
    // Simulate Round 5 (Final Round)
    const state: GameState = {
      gameId: GAME_ID,
      gameType: "find_it_first",
      status: "playing",
      currentRound: 5,
      maxRounds: 5,
      version: 5,
      scores: { [PLAYER_A]: 400, [PLAYER_B]: 350 },
      roundStartedAtServer: now,
      roundDeadlineServer: now + 15000,
      serverTimestamp: now,
      data: {
        targetId: "sextant",
        board: ["sextant", "compass", "key", "seal", "pen", "hourglass", "prism", "book", "camera", "bell", "monocle", "mug"],
        roundWinnerId: null,
      },
      processedActionIds: {},
      isFinished: false,
    };

    repository.seedGame(session, state);

    // Player A wins Round 5
    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_round_5_win",
      type: "SELECT_CELL",
      payload: { cellId: "sextant" },
      clientTimestamp: now,
    };

    const result = await submitGameAction(action, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK_TOKEN,
      repository,
      serverTimestamp: now + 1000,
    });

    expect(result.accepted).toBe(true);
    expect(result.gameState.status).toBe("game_end");
    expect(result.gameState.isFinished).toBe(true);
    expect(result.gameState.winnerId).toBe(PLAYER_A);

    // Check durable GameResult
    const savedResult = await repository.getGameResult(GAME_ID);
    expect(savedResult).not.toBeNull();
    expect(savedResult?.winnerId).toBe(PLAYER_A);
    expect(savedResult?.totalRounds).toBe(5);
  });

  it("handles REMATCH by resetting scores and setting up Round 1", async () => {
    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "find_it_first",
      status: "game_end",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    const now = Date.now();
    const state: GameState = {
      gameId: GAME_ID,
      gameType: "find_it_first",
      status: "game_end",
      currentRound: 5,
      maxRounds: 5,
      version: 10,
      scores: { [PLAYER_A]: 500, [PLAYER_B]: 350 },
      roundStartedAtServer: now - 30000,
      roundDeadlineServer: now - 15000,
      serverTimestamp: now,
      data: {
        targetId: "sextant",
        board: ["sextant", "compass"],
      },
      processedActionIds: {},
      isFinished: true,
      winnerId: PLAYER_A,
    };

    repository.seedGame(session, state);

    const rematchAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_rematch_1",
      type: "REMATCH",
      payload: {},
      clientTimestamp: now,
    };

    const result = await submitGameAction(rematchAction, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK_TOKEN,
      repository,
      serverTimestamp: now,
    });

    expect(result.accepted).toBe(true);
    expect(result.gameState.status).toBe("playing");
    expect(result.gameState.currentRound).toBe(1);
    expect(result.gameState.scores[PLAYER_A]).toBe(0);
    expect(result.gameState.scores[PLAYER_B]).toBe(0);
    expect(result.gameState.isFinished).toBe(false);
    expect(result.gameState.winnerId).toBeNull();
  });
});

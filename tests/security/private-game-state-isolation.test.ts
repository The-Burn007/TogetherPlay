import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthoritativeGameEngine } from "@/lib/firebase/server/authoritativeGameEngine";
import { submitGameAction } from "@/lib/firebase/server/submitGameAction";
import { ServerGameRepository } from "@/lib/firebase/server/gameRepository";
import { POST as handleGameSessionPost } from "@/app/api/games/session/route";
import { NextRequest } from "next/server";
import type { GameSession, GameState, GameAction } from "@/types/domain";
import * as fs from "fs";
import * as path from "path";

vi.mock("@/lib/firebase/server/admin", () => ({
  getAdminAuth: vi.fn(() => ({
    verifyIdToken: vi.fn(async (token: string) => {
      if (token && (token.startsWith("valid_token_") || token === "valid_id_token")) {
        const uid = token.startsWith("valid_token_") ? token.replace("valid_token_", "") : "user_alex";
        return {
          uid,
          sub: uid,
          email: `${uid}@example.com`,
          email_verified: true,
          auth_time: Math.floor(Date.now() / 1000),
        };
      }
      const err = new Error("Invalid or unverified Firebase ID token.");
      (err as unknown as { code: string }).code = "auth/invalid-id-token";
      throw err;
    }),
  })),
  getAdminFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(async () => ({ exists: false, data: () => null })),
        set: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  })),
  getAdminDatabase: vi.fn(() => ({
    ref: vi.fn(() => ({
      get: vi.fn(async () => ({ exists: () => false, val: () => null })),
      set: vi.fn().mockResolvedValue(undefined),
    })),
  })),
  getAdminApp: vi.fn(() => ({})),
  isAdminFirebaseConfigured: vi.fn(() => true),
}));

describe("Private Game State & Secret Isolation (Find It First)", () => {
  let repository: ServerGameRepository;
  const GAME_ID = "fif_private_state_game_test";
  const PLAYER_A = "user_alex";
  const PLAYER_B = "user_sam";
  const COUPLE_ID = "couple_private_test";
  const VALID_APP_CHECK_TOKEN = "valid-test-app-check-token";

  beforeEach(() => {
    repository = new ServerGameRepository();
  });

  function createBaseSession(): GameSession {
    return {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "find_it_first",
      status: "ready",
      playerIds: [PLAYER_A, PLAYER_B],
      readyPlayerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    };
  }

  function createBaseReadyState(): GameState {
    const now = Date.now();
    return {
      gameId: GAME_ID,
      gameType: "find_it_first",
      status: "ready",
      currentRound: 1,
      maxRounds: 5,
      version: 1,
      scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
      roundStartedAtServer: now,
      roundDeadlineServer: now + 15000,
      serverTimestamp: now,
      data: {
        roundStage: "ready",
      },
      processedActionIds: {},
      isFinished: false,
    };
  }

  it("START_GAME: stores target in privateGameStates and strips secret target fields from public gameState", async () => {
    const session = createBaseSession();
    const state = createBaseReadyState();
    repository.seedGame(session, state);

    const startAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_start_fif_1",
      type: "START_GAME",
      payload: {},
      clientTimestamp: Date.now(),
    };

    const outcome = await submitGameAction(startAction, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK_TOKEN,
      repository,
      serverTimestamp: Date.now(),
    });

    expect(outcome.accepted).toBe(true);

    // 1. Verify Public State does NOT contain secret fields
    const publicState = outcome.gameState;
    expect(publicState.data).toBeDefined();
    expect(publicState.data.targetId).toBeUndefined();
    expect(publicState.data.targetCode).toBeUndefined();
    expect(publicState.data.targetName).toBeUndefined();
    expect(publicState.data.targetAnswer).toBeUndefined();
    expect(publicState.data.usedTargetIds).toBeUndefined();

    // Board and clue are public so the player can see what to look for and the board tiles
    expect(publicState.data.board).toBeDefined();
    expect(Array.isArray(publicState.data.board)).toBe(true);
    expect((publicState.data.board as string[]).length).toBe(12);
    expect(publicState.data.targetClue).toBeDefined();

    // 2. Verify authoritativePayload does NOT leak targetId or targetCode
    expect(outcome.payload).toBeDefined();
    expect(outcome.payload?.targetId).toBeUndefined();
    expect(outcome.payload?.targetCode).toBeUndefined();
    expect(outcome.payload?.targetName).toBeUndefined();

    // 3. Verify Private State exists in isolated server storage
    const privateState = await repository.getPrivateGameState(GAME_ID);
    expect(privateState).not.toBeNull();
    expect(privateState?.targetId).toBeDefined();
    expect(typeof privateState?.targetId).toBe("string");
    expect(privateState?.targetName).toBeDefined();
    expect(privateState?.usedTargetIds).toContain(privateState?.targetId);

    // The secret target must be on the board
    expect((publicState.data.board as string[])).toContain(privateState!.targetId);
  });

  it("SELECT_CELL: validates answer against private state; public state and mistakes never reveal targetId", async () => {
    const session = createBaseSession();
    session.status = "playing";
    const state = createBaseReadyState();
    state.status = "playing";
    state.data = {
      board: ["watch", "compass", "key", "seal", "pen", "hourglass", "prism", "book", "camera", "bell", "monocle", "mug"],
      targetClue: "Precision horology with mechanical escapement",
      roundStage: "playing",
    };

    // Seed private state with secret answer
    repository.seedGame(
      session,
      state,
      {
        gameId: GAME_ID,
        targetId: "watch",
        targetName: "Pocket Watch",
        targetCode: "#01",
        targetClue: "Precision horology with mechanical escapement",
        usedTargetIds: ["watch"],
      }
    );

    // Incorrect selection by Player B
    const wrongAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_guess_wrong_1",
      type: "SELECT_CELL",
      payload: { cellId: "compass" },
      clientTimestamp: Date.now(),
    };

    const wrongOutcome = await submitGameAction(wrongAction, {
      auth: { uid: PLAYER_B },
      appCheckToken: VALID_APP_CHECK_TOKEN,
      repository,
      serverTimestamp: Date.now() + 1000,
    });

    expect(wrongOutcome.accepted).toBe(true);
    expect(wrongOutcome.payload?.isCorrect).toBe(false);
    expect(wrongOutcome.gameState.scores[PLAYER_B]).toBe(0); // 0 after penalty
    expect(wrongOutcome.gameState.data.targetId).toBeUndefined();
    expect(wrongOutcome.gameState.data.targetCode).toBeUndefined();
    expect(wrongOutcome.gameState.data.lastMistake).toEqual({
      playerId: PLAYER_B,
      cellId: "compass",
      penalty: 10,
      serverTimestamp: expect.any(Number),
    });

    // Correct selection by Player A matching private state target
    const correctAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_guess_correct_1",
      type: "SELECT_CELL",
      payload: { cellId: "watch" },
      clientTimestamp: Date.now(),
    };

    const correctOutcome = await submitGameAction(correctAction, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK_TOKEN,
      repository,
      serverTimestamp: Date.now() + 2000,
    });

    expect(correctOutcome.accepted).toBe(true);
    expect(correctOutcome.payload?.isCorrect).toBe(true);
    expect(correctOutcome.gameState.scores[PLAYER_A]).toBeGreaterThan(100);
    expect(correctOutcome.gameState.data.roundWinnerId).toBe(PLAYER_A);
    expect(correctOutcome.gameState.data.targetId).toBeUndefined();
    expect(correctOutcome.gameState.data.targetCode).toBeUndefined();
  });

  it("NEXT_ROUND: updates private state with new target and keeps public gameState secret-free", async () => {
    const session = createBaseSession();
    session.status = "playing";
    const state = createBaseReadyState();
    state.status = "round_end";
    state.currentRound = 1;
    state.data = {
      roundWinnerId: PLAYER_A,
      roundStage: "round_result",
      targetClue: "Previous round clue",
    };

    repository.seedGame(
      session,
      state,
      {
        gameId: GAME_ID,
        targetId: "watch",
        targetName: "Pocket Watch",
        targetCode: "#01",
        targetClue: "Precision horology with mechanical escapement",
        usedTargetIds: ["watch"],
      }
    );

    const nextRoundAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_next_round_1",
      type: "NEXT_ROUND",
      payload: {},
      clientTimestamp: Date.now(),
    };

    const outcome = await submitGameAction(nextRoundAction, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK_TOKEN,
      repository,
      serverTimestamp: Date.now() + 3000,
    });

    expect(outcome.accepted).toBe(true);
    expect(outcome.gameState.currentRound).toBe(2);
    expect(outcome.gameState.status).toBe("playing");

    // Public state must NOT contain secret target fields
    expect(outcome.gameState.data.targetId).toBeUndefined();
    expect(outcome.gameState.data.targetCode).toBeUndefined();
    expect(outcome.gameState.data.targetName).toBeUndefined();
    expect(outcome.gameState.data.usedTargetIds).toBeUndefined();
    expect(outcome.payload?.targetId).toBeUndefined();
    expect(outcome.payload?.targetCode).toBeUndefined();

    // Private state must be updated for round 2
    const updatedPrivateState = await repository.getPrivateGameState(GAME_ID);
    expect(updatedPrivateState).not.toBeNull();
    expect(updatedPrivateState?.targetId).toBeDefined();
    expect(updatedPrivateState?.usedTargetIds).toContain(updatedPrivateState?.targetId);
    expect(updatedPrivateState?.usedTargetIds).toContain("watch");
    expect(updatedPrivateState?.usedTargetIds?.length).toBe(2);
  });

  it("REMATCH: resets game with fresh private state and clean public state", async () => {
    const session = createBaseSession();
    session.status = "game_end";
    const state = createBaseReadyState();
    state.status = "game_end";
    state.currentRound = 5;
    state.isFinished = true;
    state.winnerId = PLAYER_A;
    state.data = {
      roundStage: "game_end",
    };

    repository.seedGame(session, state);

    const rematchAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_rematch_test_1",
      type: "REMATCH",
      payload: {},
      clientTimestamp: Date.now(),
    };

    const outcome = await submitGameAction(rematchAction, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK_TOKEN,
      repository,
      serverTimestamp: Date.now(),
    });

    expect(outcome.accepted).toBe(true);
    expect(outcome.gameState.status).toBe("playing");
    expect(outcome.gameState.currentRound).toBe(1);
    expect(outcome.gameState.data.targetId).toBeUndefined();
    expect(outcome.gameState.data.targetCode).toBeUndefined();
    expect(outcome.gameState.data.targetName).toBeUndefined();
    expect(outcome.payload?.targetId).toBeUndefined();

    const privateState = await repository.getPrivateGameState(GAME_ID);
    expect(privateState).not.toBeNull();
    expect(privateState?.targetId).toBeDefined();
    expect(privateState?.usedTargetIds?.length).toBe(1);
  });

  it("Database Rules: database.rules.json explicitly denies all client reads and writes to privateGameStates", () => {
    const rulesPath = path.resolve(process.cwd(), "database.rules.json");
    const rulesRaw = fs.readFileSync(rulesPath, "utf-8");
    const rulesJson = JSON.parse(rulesRaw);

    expect(rulesJson.rules).toBeDefined();
    expect(rulesJson.rules.privateGameStates).toBeDefined();
    expect(rulesJson.rules.privateGameStates[".read"]).toBe(false);
    expect(rulesJson.rules.privateGameStates[".write"]).toBe(false);
  });

  it("Pre-Game Isolation: POST /api/games/session generates no target secrets in pre-game ready state", async () => {
    const req = new NextRequest("http://localhost:3000/api/games/session", {
      method: "POST",
      headers: {
        authorization: "Bearer valid_token_user_alex",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        coupleId: "couple_pregame_isolation_test",
        gameType: "find_it_first",
        playerIds: [PLAYER_A, PLAYER_B],
      }),
    });

    const response = await handleGameSessionPost(req);
    expect(response.status).toBe(201);
    const json = await response.json();

    // 1. Session created in ready status
    expect(json.session).toBeDefined();
    expect(json.session.status).toBe("ready");
    expect(json.session.gameType).toBe("find_it_first");
    expect(json.session.playerIds).toContain(PLAYER_A);

    // 2-7. Pre-game state must contain NO secret target fields or clues
    const readyState = json.state;
    expect(readyState).toBeDefined();
    expect(readyState.status).toBe("ready");
    expect(readyState.data.targetId).toBeUndefined();
    expect(readyState.data.targetName).toBeUndefined();
    expect(readyState.data.targetCode).toBeUndefined();
    expect(readyState.data.targetAnswer).toBeUndefined();
    expect(readyState.data.usedTargetIds).toBeUndefined();
    expect(readyState.data.targetClue).toBeUndefined();

    // Verify pre-game state in repository contains no secrets
    repository.seedGame(json.session, json.state);
    const storedState = await repository.getEphemeralGameState(json.session.gameId);
    expect(storedState?.data.targetId).toBeUndefined();
    expect(storedState?.data.targetName).toBeUndefined();
    expect(storedState?.data.targetCode).toBeUndefined();
    expect(storedState?.data.targetAnswer).toBeUndefined();
    expect(storedState?.data.usedTargetIds).toBeUndefined();
    expect(storedState?.data.targetClue).toBeUndefined();

    // 8-10. START_GAME generates fresh authoritative target in privateGameStates
    const startAction: GameAction = {
      gameId: json.session.gameId,
      clientActionId: `act_start_pregame_${Date.now()}`,
      type: "START_GAME",
      payload: {},
      clientTimestamp: Date.now(),
    };

    const outcome = await submitGameAction(startAction, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK_TOKEN,
      repository,
      serverTimestamp: Date.now(),
    });

    expect(outcome.accepted).toBe(true);
    expect(outcome.gameState.status).toBe("playing");
    // Public active state remains sanitized
    expect(outcome.gameState.data.targetId).toBeUndefined();
    expect(outcome.gameState.data.targetCode).toBeUndefined();
    expect(outcome.gameState.data.targetName).toBeUndefined();
    expect(outcome.gameState.data.targetAnswer).toBeUndefined();
    expect(outcome.gameState.data.usedTargetIds).toBeUndefined();

    // Public active state provides clue and board for players to see
    expect(outcome.gameState.data.targetClue).toBeDefined();
    expect(Array.isArray(outcome.gameState.data.board)).toBe(true);
    expect((outcome.gameState.data.board as string[]).length).toBe(12);

    // Secret target is saved exclusively in privateGameStates
    const privState = await repository.getPrivateGameState(json.session.gameId);
    expect(privState).not.toBeNull();
    expect(privState?.targetId).toBeDefined();
    expect(typeof privState?.targetId).toBe("string");
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { submitGameAction } from "@/lib/firebase/server/submitGameAction";
import { ServerGameRepository } from "@/lib/firebase/server/gameRepository";
import type { GameSession, GameState, GameAction } from "@/types/domain";

describe("Speed Duel - Authoritative Multiplayer Engine", () => {
  let repository: ServerGameRepository;
  const GAME_ID = "speed_duel_test_game_1";
  const PLAYER_A = "user_alex";
  const PLAYER_B = "user_sam";
  const COUPLE_ID = "couple_london_tokyo";
  const VALID_APP_CHECK = "valid-test-app-check-token";

  beforeEach(() => {
    repository = new ServerGameRepository();
  });

  it("START_GAME establishes authoritative tension delay and target appearance time", async () => {
    const now = 1700000000000;
    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "speed_duel",
      status: "ready",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date(now).toISOString(),
      schemaVersion: 1,
    };

    const state: GameState = {
      gameId: GAME_ID,
      gameType: "speed_duel",
      status: "ready",
      currentRound: 1,
      maxRounds: 5,
      version: 1,
      scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
      roundStartedAtServer: now,
      roundDeadlineServer: now + 15000,
      serverTimestamp: now,
      data: {
        gameType: "speed_duel",
        roundStage: "ready",
      },
      processedActionIds: {},
      isFinished: false,
    };

    repository.seedGame(session, state);

    const action: GameAction = {
      clientActionId: "act_start_speed_duel_1",
      gameId: GAME_ID,
      type: "START_GAME",
      payload: {},
      clientTimestamp: now,
    };

    const result = await submitGameAction(action, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK,
      repository,
      serverTimestamp: now,
    });

    expect(result.accepted).toBe(true);
    expect(result.gameState?.status).toBe("playing");
    expect(result.gameState?.currentRound).toBe(1);

    const data = result.gameState?.data as Record<string, unknown>;
    expect(data.roundStage).toBe("tension");
    expect(data.tensionDelayMs).toBeGreaterThanOrEqual(1800);
    expect(data.tensionDelayMs).toBeLessThanOrEqual(4200);
    expect(Number(data.targetAppearedAtServer)).toBe(now + Number(data.tensionDelayMs));
  });

  it("Server penalizes False Start if player strikes before target appearance time", async () => {
    const now = 1700000000000;
    const targetAppearanceTime = now + 2500; // Target will appear in 2.5s

    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "speed_duel",
      status: "playing",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date(now).toISOString(),
      schemaVersion: 1,
    };

    const state: GameState = {
      gameId: GAME_ID,
      gameType: "speed_duel",
      status: "playing",
      currentRound: 1,
      maxRounds: 5,
      version: 1,
      scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
      roundStartedAtServer: now,
      roundDeadlineServer: targetAppearanceTime + 6000,
      serverTimestamp: now,
      data: {
        gameType: "speed_duel",
        roundStage: "tension",
        tensionStartedAtServer: now,
        tensionDelayMs: 2500,
        targetAppearedAtServer: targetAppearanceTime,
        roundWinnerId: null,
        roundHistory: [],
        competitiveMode: "first_to_3",
      },
      processedActionIds: {},
      isFinished: false,
    };

    repository.seedGame(session, state);

    // Player A strikes early (1000ms before target appears)
    const earlyActionTime = now + 1500;
    const action: GameAction = {
      clientActionId: "act_false_start_1",
      gameId: GAME_ID,
      type: "SUBMIT_REACTION",
      payload: {},
      clientTimestamp: earlyActionTime,
    };

    const result = await submitGameAction(action, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK,
      repository,
      serverTimestamp: earlyActionTime,
    });

    expect(result.accepted).toBe(true);
    const data = result.gameState?.data as Record<string, unknown>;
    expect(data.roundWinnerReason).toBe("opponent_false_start");
    expect(data.roundWinnerId).toBe(PLAYER_B); // Sam awarded win
    expect(result.gameState?.scores[PLAYER_B]).toBe(100); // Sam gets 100 points
    expect(result.gameState?.scores[PLAYER_A]).toBe(0);

    const payload = result.payload as Record<string, unknown>;
    expect(payload.isFalseStart).toBe(true);
    expect(payload.falseStartPlayerId).toBe(PLAYER_A);
    expect(payload.roundWinnerId).toBe(PLAYER_B);
  });

  it("First valid reaction after target appearance claims round with speed bonus", async () => {
    const targetAppeared = 1700000000000;
    const reactionTime = targetAppeared + 220; // 220ms after target appeared

    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "speed_duel",
      status: "playing",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date(targetAppeared - 2000).toISOString(),
      schemaVersion: 1,
    };

    const state: GameState = {
      gameId: GAME_ID,
      gameType: "speed_duel",
      status: "playing",
      currentRound: 1,
      maxRounds: 5,
      version: 1,
      scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
      roundStartedAtServer: targetAppeared - 2000,
      roundDeadlineServer: targetAppeared + 6000,
      serverTimestamp: targetAppeared,
      data: {
        gameType: "speed_duel",
        roundStage: "active",
        targetAppearedAtServer: targetAppeared,
        roundWinnerId: null,
        roundWinnerReactionMs: null,
        roundHistory: [],
        competitiveMode: "first_to_3",
      },
      processedActionIds: {},
      isFinished: false,
    };

    repository.seedGame(session, state);

    const action: GameAction = {
      clientActionId: "act_reaction_alex_win",
      gameId: GAME_ID,
      type: "SUBMIT_REACTION",
      payload: {},
      clientTimestamp: reactionTime,
    };

    const result = await submitGameAction(action, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK,
      repository,
      serverTimestamp: reactionTime,
    });

    expect(result.accepted).toBe(true);
    const data = result.gameState?.data as Record<string, unknown>;
    expect(data.roundWinnerId).toBe(PLAYER_A);
    expect(data.roundWinnerReason).toBe("fastest_reaction");
    expect(data.roundWinnerReactionMs).toBe(220);

    // Speed bonus awarded: 100 + floor((1000 - 220)/3) = 100 + 260 => capped at 250 => 350
    expect(result.gameState?.scores[PLAYER_A]).toBe(350);
    expect(result.gameState?.status).toBe("round_end");

    const payload = result.payload as Record<string, unknown>;
    expect(payload.isWinner).toBe(true);
    expect(payload.roundWinnerId).toBe(PLAYER_A);
  });

  it("Server enforces accepted action ordering: second arrival does not overwrite winner", async () => {
    const targetAppeared = 1700000000000;
    const samReactionTime = targetAppeared + 350;

    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "speed_duel",
      status: "playing",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date(targetAppeared - 2000).toISOString(),
      schemaVersion: 1,
    };

    // Alex already recorded winner at 220ms
    const state: GameState = {
      gameId: GAME_ID,
      gameType: "speed_duel",
      status: "playing",
      currentRound: 1,
      maxRounds: 5,
      version: 1,
      scores: { [PLAYER_A]: 350, [PLAYER_B]: 0 },
      roundStartedAtServer: targetAppeared - 2000,
      roundDeadlineServer: targetAppeared + 6000,
      serverTimestamp: targetAppeared + 220,
      data: {
        gameType: "speed_duel",
        roundStage: "round_result",
        targetAppearedAtServer: targetAppeared,
        roundWinnerId: PLAYER_A,
        roundWinnerReactionMs: 220,
        roundWinnerReason: "fastest_reaction",
        playerReactions: { [PLAYER_A]: 220 },
        roundHistory: [],
        competitiveMode: "first_to_3",
      },
      processedActionIds: {},
      isFinished: false,
    };

    repository.seedGame(session, state);

    // Sam reacts later (arrives at 350ms)
    const action: GameAction = {
      clientActionId: "act_reaction_sam_late",
      gameId: GAME_ID,
      type: "SUBMIT_REACTION",
      payload: {},
      clientTimestamp: samReactionTime,
    };

    const result = await submitGameAction(action, {
      auth: { uid: PLAYER_B },
      appCheckToken: VALID_APP_CHECK,
      repository,
      serverTimestamp: samReactionTime,
    });

    expect(result.accepted).toBe(true);
    // Alex remains the authoritative winner
    expect(result.gameState?.data?.roundWinnerId).toBe(PLAYER_A);

    const payload = result.payload as Record<string, unknown>;
    expect(payload.alreadyResolved).toBe(true);
    expect(payload.roundWinnerId).toBe(PLAYER_A);
    expect(payload.deltaMs).toBe(130); // 350ms - 220ms = 130ms behind Alex
  });

  it("Competitive Mode: First to 3 wins triggers definitive match conclusion", async () => {
    const targetAppeared = 1700000000000;
    const reactionTime = targetAppeared + 200;

    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "speed_duel",
      status: "playing",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date(targetAppeared - 10000).toISOString(),
      schemaVersion: 1,
    };

    // Alex already has 2 wins in round history
    const existingHistory = [
      { round: 1, winnerId: PLAYER_A, reactionMs: 240, pointsAwarded: 350, serverTimestamp: targetAppeared - 10000 },
      { round: 2, winnerId: PLAYER_A, reactionMs: 210, pointsAwarded: 360, serverTimestamp: targetAppeared - 5000 },
    ];

    const state: GameState = {
      gameId: GAME_ID,
      gameType: "speed_duel",
      status: "playing",
      currentRound: 3,
      maxRounds: 5,
      version: 3,
      scores: { [PLAYER_A]: 710, [PLAYER_B]: 0 },
      roundStartedAtServer: targetAppeared - 2000,
      roundDeadlineServer: targetAppeared + 6000,
      serverTimestamp: targetAppeared,
      data: {
        gameType: "speed_duel",
        roundStage: "active",
        targetAppearedAtServer: targetAppeared,
        roundWinnerId: null,
        roundHistory: existingHistory,
        competitiveMode: "first_to_3",
      },
      processedActionIds: {},
      isFinished: false,
    };

    repository.seedGame(session, state);

    // Alex claims 3rd win
    const action: GameAction = {
      clientActionId: "act_alex_championship_win",
      gameId: GAME_ID,
      type: "SUBMIT_REACTION",
      payload: {},
      clientTimestamp: reactionTime,
    };

    const result = await submitGameAction(action, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK,
      repository,
      serverTimestamp: reactionTime,
    });

    expect(result.accepted).toBe(true);
    expect(result.gameState?.status).toBe("game_end");
    expect(result.gameState?.isFinished).toBe(true);
    expect(result.gameState?.winnerId).toBe(PLAYER_A);

    const data = result.gameState?.data as Record<string, unknown>;
    expect(data.roundStage).toBe("game_end");
  });

  it("REMATCH resets scores and starts round 1 with new tension delay", async () => {
    const now = 1700000000000;
    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "speed_duel",
      status: "game_end",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date(now - 20000).toISOString(),
      schemaVersion: 1,
    };

    const state: GameState = {
      gameId: GAME_ID,
      gameType: "speed_duel",
      status: "game_end",
      currentRound: 3,
      maxRounds: 5,
      version: 5,
      scores: { [PLAYER_A]: 1050, [PLAYER_B]: 100 },
      roundStartedAtServer: now,
      roundDeadlineServer: now + 5000,
      serverTimestamp: now,
      data: {
        gameType: "speed_duel",
        roundStage: "game_end",
        roundWinnerId: PLAYER_A,
        roundHistory: [{ round: 1, winnerId: PLAYER_A }, { round: 2, winnerId: PLAYER_A }, { round: 3, winnerId: PLAYER_A }],
      },
      processedActionIds: {},
      isFinished: true,
      winnerId: PLAYER_A,
    };

    repository.seedGame(session, state);

    const action: GameAction = {
      clientActionId: "act_rematch_speed_duel",
      gameId: GAME_ID,
      type: "REMATCH",
      payload: {},
      clientTimestamp: now,
    };

    const result = await submitGameAction(action, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK,
      repository,
      serverTimestamp: now,
    });

    expect(result.accepted).toBe(true);
    expect(result.gameState?.status).toBe("playing");
    expect(result.gameState?.currentRound).toBe(1);
    expect(result.gameState?.isFinished).toBe(false);
    expect(result.gameState?.winnerId).toBeNull();
    expect(result.gameState?.scores[PLAYER_A]).toBe(0);
    expect(result.gameState?.scores[PLAYER_B]).toBe(0);

    const data = result.gameState?.data as Record<string, unknown>;
    expect(data.roundStage).toBe("tension");
    expect(data.roundHistory).toEqual([]);
    expect(data.tensionDelayMs).toBeGreaterThanOrEqual(1800);
  });
});

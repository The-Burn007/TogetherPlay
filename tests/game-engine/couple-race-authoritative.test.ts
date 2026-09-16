import { describe, it, expect, beforeEach } from "vitest";
import { submitGameAction, ActionValidationError } from "@/lib/firebase/server/submitGameAction";
import { ServerGameRepository } from "@/lib/firebase/server/gameRepository";
import type { GameSession, GameState, GameAction } from "@/types/domain";

describe("Couple Race - Authoritative Multiplayer Engine", () => {
  let repository: ServerGameRepository;
  const GAME_ID = "couple_race_test_1";
  const PLAYER_A = "user_alex";
  const PLAYER_B = "user_sam";
  const COUPLE_ID = "couple_london_tokyo";
  const VALID_APP_CHECK = "valid-test-app-check-token";

  beforeEach(() => {
    repository = new ServerGameRepository();
  });

  it("server computes authoritative dice roll and ignores client-provided dice values", async () => {
    const now = 1700000000000;
    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "couple_race",
      status: "playing",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date(now).toISOString(),
      schemaVersion: 1,
    };

    const state: GameState = {
      gameId: GAME_ID,
      gameType: "couple_race",
      status: "playing",
      currentRound: 1,
      maxRounds: 2,
      version: 1,
      scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
      turnPlayerId: PLAYER_A,
      roundStartedAtServer: now,
      roundDeadlineServer: 0,
      serverTimestamp: now,
      data: {
        boardSize: 24,
        targetLaps: 2,
        currentTurnPlayerId: PLAYER_A,
        hasRolledThisTurn: false,
        hasMovedThisTurn: false,
        currentDiceValue: null,
        players: {
          [PLAYER_A]: {
            playerId: PLAYER_A,
            position: 0,
            lapsCompleted: 0,
            powers: ["WIND_STRIDE"],
            shieldActive: false,
            activeEffects: [],
            totalRolls: 0,
            connectionStatus: "connected",
          },
          [PLAYER_B]: {
            playerId: PLAYER_B,
            position: 0,
            lapsCompleted: 0,
            powers: [],
            shieldActive: false,
            activeEffects: [],
            totalRolls: 0,
            connectionStatus: "connected",
          },
        },
      },
      processedActionIds: {},
      isFinished: false,
    };

    repository.seedGame(session, state);

    // Client attempts to sneak in their own dice roll of 6
    const action: GameAction = {
      clientActionId: "act_dice_roll_1",
      gameId: GAME_ID,
      type: "ROLL_DICE",
      payload: { cheatDice: 6 },
      clientTimestamp: now,
    };

    const result = await submitGameAction(action, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK,
      repository,
      serverTimestamp: now,
    });

    expect(result.accepted).toBe(true);
    const data = result.gameState?.data as Record<string, unknown>;
    expect(data.hasRolledThisTurn).toBe(true);
    expect(typeof data.currentDiceValue).toBe("number");
    // Dice value must be in authoritative 1..6 range
    expect(data.currentDiceValue as number).toBeGreaterThanOrEqual(1);
    expect(data.currentDiceValue as number).toBeLessThanOrEqual(6);
  });

  it("server rejects rolls or moves out of turn", async () => {
    const now = 1700000000000;
    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "couple_race",
      status: "playing",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date(now).toISOString(),
      schemaVersion: 1,
    };

    const state: GameState = {
      gameId: GAME_ID,
      gameType: "couple_race",
      status: "playing",
      currentRound: 1,
      maxRounds: 2,
      version: 1,
      scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
      turnPlayerId: PLAYER_A, // Alex's turn
      roundStartedAtServer: now,
      roundDeadlineServer: 0,
      serverTimestamp: now,
      data: {
        currentTurnPlayerId: PLAYER_A,
        hasRolledThisTurn: false,
        players: {
          [PLAYER_A]: { playerId: PLAYER_A, position: 0, lapsCompleted: 0, powers: [] },
          [PLAYER_B]: { playerId: PLAYER_B, position: 0, lapsCompleted: 0, powers: [] },
        },
      },
      processedActionIds: {},
      isFinished: false,
    };

    repository.seedGame(session, state);

    // Sam tries to roll out of turn
    const action: GameAction = {
      clientActionId: "act_sam_out_of_turn",
      gameId: GAME_ID,
      type: "ROLL_DICE",
      payload: {},
      clientTimestamp: now,
    };

    await expect(
      submitGameAction(action, {
        auth: { uid: PLAYER_B },
        appCheckToken: VALID_APP_CHECK,
        repository,
        serverTimestamp: now,
      })
    ).rejects.toThrow(ActionValidationError);
  });

  it("server enforces game pause and rejects gameplay actions until resumed", async () => {
    const now = 1700000000000;
    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "couple_race",
      status: "playing",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date(now).toISOString(),
      schemaVersion: 1,
    };

    const state: GameState = {
      gameId: GAME_ID,
      gameType: "couple_race",
      status: "playing",
      currentRound: 1,
      maxRounds: 2,
      version: 1,
      scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
      turnPlayerId: PLAYER_A,
      roundStartedAtServer: now,
      roundDeadlineServer: 0,
      serverTimestamp: now,
      data: {
        boardSize: 24,
        targetLaps: 2,
        currentTurnPlayerId: PLAYER_A,
        hasRolledThisTurn: false,
        isPaused: true, // PAUSED
        players: {
          [PLAYER_A]: { playerId: PLAYER_A, position: 0, lapsCompleted: 0, powers: [] },
          [PLAYER_B]: { playerId: PLAYER_B, position: 0, lapsCompleted: 0, powers: [] },
        },
      },
      processedActionIds: {},
      isFinished: false,
    };

    repository.seedGame(session, state);

    // Alex tries to roll while paused
    const action: GameAction = {
      clientActionId: "act_roll_while_paused",
      gameId: GAME_ID,
      type: "ROLL_DICE",
      payload: {},
      clientTimestamp: now,
    };

    await expect(
      submitGameAction(action, {
        auth: { uid: PLAYER_A },
        appCheckToken: VALID_APP_CHECK,
        repository,
        serverTimestamp: now,
      })
    ).rejects.toThrow(ActionValidationError);

    // Now resume the game
    const resumeAction: GameAction = {
      clientActionId: "act_resume_race",
      gameId: GAME_ID,
      type: "RESUME_GAME",
      payload: {},
      clientTimestamp: now + 500,
    };

    const resumeResult = await submitGameAction(resumeAction, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK,
      repository,
      serverTimestamp: now + 500,
    });

    expect(resumeResult.accepted).toBe(true);
    const updatedData = resumeResult.gameState?.data as Record<string, unknown>;
    expect(updatedData.isPaused).toBe(false);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { submitGameAction, ActionValidationError } from "@/lib/firebase/server/submitGameAction";
import { ServerGameRepository } from "@/lib/firebase/server/gameRepository";
import type { GameSession, GameState, GameAction, GameResult } from "@/types/domain";

describe("Hardened Game Action Idempotency Scoping & Atomicity", () => {
  let repository: ServerGameRepository;
  const GAME_ID = "game_idempotency_session_1";
  const OTHER_GAME_ID = "game_idempotency_session_2";
  const PLAYER_A = "player_alice";
  const PLAYER_B = "player_bob";

  beforeEach(() => {
    repository = new ServerGameRepository({ useLiveBackend: false });
    repository.clearForTesting();
  });

  function seedGame(
    gameId: string = GAME_ID,
    gameType: "speed_duel" | "couple_race" | "find_it_first" = "couple_race",
    status: GameState["status"] = "playing",
    overrides: Partial<GameState> = {}
  ): { session: GameSession; state: GameState } {
    const session: GameSession = {
      gameId,
      coupleId: `couple_${gameId}`,
      gameType,
      status,
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    const state: GameState = {
      gameId,
      gameType,
      status,
      currentRound: 1,
      maxRounds: 3,
      version: 1,
      scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
      turnPlayerId: gameType === "couple_race" ? PLAYER_A : null,
      roundStartedAtServer: Date.now(),
      roundDeadlineServer: Date.now() + 60000,
      serverTimestamp: Date.now(),
      data: {
        scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
        ...(gameType === "couple_race"
          ? {
              boardSize: 20,
              playerPositions: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
              turnPlayerId: PLAYER_A,
            }
          : {}),
        ...(gameType === "speed_duel"
          ? {
              targetTime: Date.now() + 10000,
            }
          : {}),
      },
      processedActionIds: {},
      processedActions: {},
      isFinished: false,
      winnerId: null,
      ...overrides,
    };

    repository.seedGame(session, state);
    return { session, state };
  }

  // ----------------------------------------------------------
  // 1. Sequential duplicate
  // ----------------------------------------------------------
  it("executes the first request and returns identical logical result on sequential duplicate", async () => {
    seedGame(GAME_ID, "couple_race", "playing", {
      turnPlayerId: PLAYER_A,
      data: {
        boardSize: 24,
        players: {
          [PLAYER_A]: { playerId: PLAYER_A, position: 0, totalRolls: 0, powers: [] },
          [PLAYER_B]: { playerId: PLAYER_B, position: 0, totalRolls: 0, powers: [] },
        },
      },
    });

    const actionId = "action_seq_dup_001";
    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: actionId,
      type: "ROLL_DICE",
      payload: {},
      clientTimestamp: Date.now(),
    };

    // First execution
    const firstResult = await submitGameAction(action, {
      auth: { uid: PLAYER_A },
      repository,
      enforceAppCheck: false,
    });

    expect(firstResult.accepted).toBe(true);
    expect(firstResult.idempotentDuplicate).toBe(false);
    expect(firstResult.stateVersion).toBe(2);
    expect(firstResult.payload).toBeDefined();
    const originalDiceValue = (firstResult.payload as { diceValue: number }).diceValue;
    expect(typeof originalDiceValue).toBe("number");
    expect(originalDiceValue).toBeGreaterThanOrEqual(1);
    expect(originalDiceValue).toBeLessThanOrEqual(6);

    // Sequential duplicate with exact same clientActionId
    const secondResult = await submitGameAction(action, {
      auth: { uid: PLAYER_A },
      repository,
      enforceAppCheck: false,
    });

    expect(secondResult.accepted).toBe(true);
    expect(secondResult.idempotentDuplicate).toBe(true);
    expect(secondResult.stateVersion).toBe(2); // Must NOT increment again
    expect(secondResult.clientActionId).toBe(actionId);

    // Must return the same logical result (exact same dice roll and payload)
    const duplicateDiceValue = (secondResult.payload as { diceValue: number }).diceValue;
    expect(duplicateDiceValue).toBe(originalDiceValue);

    // Authoritative state must NOT have incremented rolls twice
    const finalState = await repository.getEphemeralGameState(GAME_ID);
    expect(finalState?.version).toBe(2);
    expect(finalState?.data.currentDiceValue).toBe(originalDiceValue);
    const players = finalState?.data.players as Record<string, { totalRolls: number }>;
    expect(players[PLAYER_A].totalRolls).toBe(1);
    expect(Object.keys(finalState?.processedActionIds || {}).length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 2. Simultaneous duplicate
  // --------------------------------------------------------------------------
  it("handles simultaneous duplicate requests atomically without double mutation", async () => {
    seedGame(GAME_ID, "couple_race", "playing", {
      turnPlayerId: PLAYER_A,
      data: {
        boardSize: 24,
        players: {
          [PLAYER_A]: { playerId: PLAYER_A, position: 0, totalRolls: 0, powers: [] },
          [PLAYER_B]: { playerId: PLAYER_B, position: 0, totalRolls: 0, powers: [] },
        },
      },
    });

    const actionId = "action_simul_dup_002";
    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: actionId,
      type: "ROLL_DICE",
      payload: {},
      clientTimestamp: Date.now(),
    };

    // 4 simultaneous requests with identical clientActionId
    const promises = Array.from({ length: 4 }, () =>
      submitGameAction(action, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      })
    );

    const results = await Promise.all(promises);

    for (const res of results) {
      expect(res.accepted).toBe(true);
      expect(res.stateVersion).toBe(2);
      expect(res.clientActionId).toBe(actionId);
    }

    const nonDuplicates = results.filter((r) => !r.idempotentDuplicate);
    const duplicates = results.filter((r) => r.idempotentDuplicate);

    // Exactly one executes, the other three resolve as idempotent duplicates
    expect(nonDuplicates.length).toBe(1);
    expect(duplicates.length).toBe(3);

    // All must agree on the same logical payload
    const originalDiceValue = (nonDuplicates[0].payload as { diceValue: number }).diceValue;
    for (const dup of duplicates) {
      expect((dup.payload as { diceValue: number }).diceValue).toBe(originalDiceValue);
    }

    // State version incremented only once
    const finalState = await repository.getEphemeralGameState(GAME_ID);
    expect(finalState?.version).toBe(2);
    expect(finalState?.data.currentDiceValue).toBe(originalDiceValue);
    const players = finalState?.data.players as Record<string, { totalRolls: number }>;
    expect(players[PLAYER_A].totalRolls).toBe(1);
    expect(Object.keys(finalState?.processedActionIds || {}).length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 3. Duplicate after reconnect
  // --------------------------------------------------------------------------
  it("safely handles duplicate actions re-sent after player disconnect and reconnect", async () => {
    seedGame(GAME_ID, "couple_race", "playing", {
      turnPlayerId: PLAYER_A,
      data: {
        boardSize: 24,
        players: {
          [PLAYER_A]: { playerId: PLAYER_A, position: 0, totalRolls: 0, powers: [] },
          [PLAYER_B]: { playerId: PLAYER_B, position: 0, totalRolls: 0, powers: [] },
        },
      },
    });

    // Step 1: Player A rolls dice
    const originalActionId = "action_reconnect_test_003";
    const rollAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: originalActionId,
      type: "ROLL_DICE",
      payload: {},
      clientTimestamp: Date.now(),
    };

    const initialRoll = await submitGameAction(rollAction, {
      auth: { uid: PLAYER_A },
      repository,
      enforceAppCheck: false,
    });
    expect(initialRoll.accepted).toBe(true);
    expect(initialRoll.idempotentDuplicate).toBe(false);
    expect(initialRoll.stateVersion).toBe(2);
    const originalDice = (initialRoll.payload as { diceValue: number }).diceValue;

    // Step 2: Player A disconnects
    const disconnectAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: "action_disconnect_003",
      type: "PLAYER_DISCONNECT",
      payload: {},
      clientTimestamp: Date.now(),
    };
    const disconnectRes = await submitGameAction(disconnectAction, {
      auth: { uid: PLAYER_A },
      repository,
      enforceAppCheck: false,
    });
    expect(disconnectRes.accepted).toBe(true);
    expect(disconnectRes.stateVersion).toBe(3);

    // Step 3: Player A reconnects
    const reconnectAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: "action_reconnect_003",
      type: "PLAYER_RECONNECT",
      payload: {},
      clientTimestamp: Date.now(),
    };
    const reconnectRes = await submitGameAction(reconnectAction, {
      auth: { uid: PLAYER_A },
      repository,
      enforceAppCheck: false,
    });
    expect(reconnectRes.accepted).toBe(true);
    expect(reconnectRes.stateVersion).toBe(4);

    // Step 4: Client reconnect queue re-sends original action
    const duplicateReplay = await submitGameAction(rollAction, {
      auth: { uid: PLAYER_A },
      repository,
      enforceAppCheck: false,
    });

    expect(duplicateReplay.accepted).toBe(true);
    expect(duplicateReplay.idempotentDuplicate).toBe(true);
    expect(duplicateReplay.clientActionId).toBe(originalActionId);
    expect((duplicateReplay.payload as { diceValue: number }).diceValue).toBe(originalDice);

    // State version remains at 4 (not incremented by duplicate)
    const finalState = await repository.getEphemeralGameState(GAME_ID);
    expect(finalState?.version).toBe(4);
    const players = finalState?.data.players as Record<string, { totalRolls: number }>;
    expect(players[PLAYER_A].totalRolls).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 4. Duplicate after server retry
  // --------------------------------------------------------------------------
  it("resolves duplicate after network retry with stale expectedVersion without error", async () => {
    seedGame(GAME_ID, "speed_duel", "playing", {
      data: {
        roundStage: "active",
        targetAppearedAtServer: Date.now() - 500,
      },
    });

    const actionId = "action_retry_stale_ver_004";
    const retryAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: actionId,
      type: "SUBMIT_REACTION",
      payload: { clientReactionMs: 310 },
      clientTimestamp: Date.now(),
    };
    (retryAction as unknown as { expectedVersion: number }).expectedVersion = 1;

    // Attempt 1: Server executes, state advances to version 2
    const firstAttempt = await submitGameAction(retryAction, {
      auth: { uid: PLAYER_A },
      repository,
      enforceAppCheck: false,
    });
    expect(firstAttempt.accepted).toBe(true);
    expect(firstAttempt.idempotentDuplicate).toBe(false);
    expect(firstAttempt.stateVersion).toBe(2);
    const originalScore = firstAttempt.gameState.scores[PLAYER_A];
    expect(originalScore).toBeGreaterThan(0);

    // Attempt 2: Client timed out waiting for response, retries the exact same request
    // with initial expectedVersion = 1 (even though server is now at version 2)
    const retryAttempt = await submitGameAction(retryAction, {
      auth: { uid: PLAYER_A },
      repository,
      enforceAppCheck: false,
    });

    // Idempotency check precedes version check: duplicate accepted safely
    expect(retryAttempt.accepted).toBe(true);
    expect(retryAttempt.idempotentDuplicate).toBe(true);
    expect(retryAttempt.stateVersion).toBe(2);

    // Scores only incremented once
    const finalState = await repository.getEphemeralGameState(GAME_ID);
    expect(finalState?.version).toBe(2);
    expect(finalState?.scores[PLAYER_A]).toBe(originalScore);
  });

  // --------------------------------------------------------------------------
  // 5. Duplicate after game completion
  // --------------------------------------------------------------------------
  it("safely handles duplicate of final action after game is finished and preserves GameResult", async () => {
    // Seed game in final round (round 3 of 3) with roundStage active
    const winningActionId = "action_final_finish_005";
    seedGame(GAME_ID, "speed_duel", "playing", {
      currentRound: 3,
      maxRounds: 3,
      scores: { [PLAYER_A]: 200, [PLAYER_B]: 0 },
      data: {
        roundStage: "active",
        targetAppearedAtServer: Date.now() - 500,
        roundHistory: [
          { round: 1, winnerId: PLAYER_A },
          { round: 2, winnerId: PLAYER_A },
        ],
      },
    });

    const finishAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: winningActionId,
      type: "SUBMIT_REACTION",
      payload: { clientReactionMs: 250 },
      clientTimestamp: Date.now(),
    };

    // First execution: wins round 3 and completes the game
    const firstExec = await submitGameAction(finishAction, {
      auth: { uid: PLAYER_A },
      repository,
      enforceAppCheck: false,
    });

    expect(firstExec.accepted).toBe(true);
    expect(firstExec.idempotentDuplicate).toBe(false);
    expect(firstExec.gameState.isFinished).toBe(true);
    expect(firstExec.gameState.status).toBe("game_end");
    expect(firstExec.gameState.winnerId).toBe(PLAYER_A);
    expect(firstExec.gameResult).not.toBeNull();

    // Client retries the winning action after game completion
    const duplicateExec = await submitGameAction(finishAction, {
      auth: { uid: PLAYER_A },
      repository,
      enforceAppCheck: false,
    });

    expect(duplicateExec.accepted).toBe(true);
    expect(duplicateExec.idempotentDuplicate).toBe(true);
    expect(duplicateExec.gameState.isFinished).toBe(true);
    expect(duplicateExec.gameState.status).toBe("game_end");
    expect(duplicateExec.gameResult).not.toBeNull();
    expect(duplicateExec.gameResult?.winnerId).toBe(PLAYER_A);
  });

  // --------------------------------------------------------------------------
  // 6. Cross-game reuse prevention & scoping
  // --------------------------------------------------------------------------
  it("prevents an attacker from reusing an action ID against a different game", async () => {
    seedGame(GAME_ID, "speed_duel", "playing");
    seedGame(OTHER_GAME_ID, "speed_duel", "playing");

    const reusedActionId = "action_cross_game_attack_006";

    // 1. Legitimate action in GAME_ID
    const validAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: reusedActionId,
      type: "TRIGGER_TARGET",
      payload: { clientReactionMs: 350 },
      clientTimestamp: Date.now(),
    };

    const resGame1 = await submitGameAction(validAction, {
      auth: { uid: PLAYER_A },
      repository,
      enforceAppCheck: false,
    });
    expect(resGame1.accepted).toBe(true);
    expect(resGame1.stateVersion).toBe(2);

    // 2. Attacker attempts to replay the same actionId in OTHER_GAME_ID
    const attackAction: GameAction = {
      gameId: OTHER_GAME_ID,
      clientActionId: reusedActionId,
      type: "TRIGGER_TARGET",
      payload: { clientReactionMs: 350 },
      clientTimestamp: Date.now(),
    };

    await expect(
      submitGameAction(attackAction, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      })
    ).rejects.toThrow(ActionValidationError);

    try {
      await submitGameAction(attackAction, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      });
      expect.unreachable("Should have thrown ACTION_ID_REUSED_CROSS_GAME");
    } catch (err) {
      expect(err).toBeInstanceOf(ActionValidationError);
      expect((err as ActionValidationError).code).toBe("ACTION_ID_REUSED_CROSS_GAME");
      expect((err as ActionValidationError).statusCode).toBe(403);
    }

    // Target game must remain unmutated at version 1
    const otherState = await repository.getEphemeralGameState(OTHER_GAME_ID);
    expect(otherState?.version).toBe(1);
    expect(otherState?.processedActionIds[reusedActionId]).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // 7. Authoritative idempotency store persistence
  // --------------------------------------------------------------------------
  it("persists authoritative idempotency information in GameState and action claims", async () => {
    seedGame(GAME_ID, "couple_race", "playing", { turnPlayerId: PLAYER_A });

    const actionId = "action_persistence_check_007";
    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: actionId,
      type: "ROLL_DICE",
      payload: {},
      clientTimestamp: Date.now(),
    };

    await submitGameAction(action, {
      auth: { uid: PLAYER_A },
      repository,
      enforceAppCheck: false,
    });

    // Verify stored state in repository
    const storedState = await repository.getEphemeralGameState(GAME_ID);
    expect(storedState).not.toBeNull();
    expect(storedState?.processedActionIds[actionId]).toBeDefined();
    expect(typeof storedState?.processedActionIds[actionId]).toBe("number");

    // Verify processedActions record
    const record = storedState?.processedActions?.[actionId];
    expect(record).toBeDefined();
    expect(record?.clientActionId).toBe(actionId);
    expect(record?.gameId).toBe(GAME_ID);
    expect(record?.playerId).toBe(PLAYER_A);
    expect(record?.type).toBe("ROLL_DICE");
    expect(record?.stateVersion).toBe(2);

    // Verify action claim store
    const claim = await repository.getActionClaim(actionId);
    expect(claim).not.toBeNull();
    expect(claim?.gameId).toBe(GAME_ID);
    expect(claim?.playerId).toBe(PLAYER_A);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { submitGameAction, ActionValidationError } from "@/lib/firebase/server/submitGameAction";
import { ServerGameRepository } from "@/lib/firebase/server/gameRepository";
import type { GameSession, GameState, GameAction } from "@/types/domain";

describe("Atomic Authoritative Game State Concurrency & RTDB Transactions", () => {
  let repository: ServerGameRepository;
  const GAME_ID = "concurrency_game_test_101";
  const PLAYER_A = "user_ember_alpha";
  const PLAYER_B = "user_sage_beta";

  beforeEach(() => {
    repository = new ServerGameRepository({ useLiveBackend: false });
    repository.clearForTesting();
  });

  function seedActiveGame(
    gameType: "speed_duel" | "couple_race" | "find_it_first" = "speed_duel",
    status: GameState["status"] = "playing",
    overrides: Partial<GameState> = {}
  ): { session: GameSession; state: GameState } {
    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: "couple_concurrency_77",
      gameType,
      status,
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    const state: GameState = {
      gameId: GAME_ID,
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
        targetTime: Date.now() + 10000,
        scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
        ...(gameType === "couple_race"
          ? {
              boardSize: 20,
              playerPositions: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
              turnPlayerId: PLAYER_A,
            }
          : {}),
        ...(gameType === "find_it_first"
          ? {
              targetItem: { id: "item_heart_gem", label: "Heart Gem" },
              gridItems: [{ id: "item_heart_gem", label: "Heart Gem" }, { id: "item_star", label: "Star" }],
            }
          : {}),
      },
      processedActionIds: {},
      isFinished: false,
      winnerId: null,
      ...overrides,
    };

    repository.seedGame(session, state);
    return { session, state };
  }

  // --------------------------------------------------------------------------
  // 1. Two different players acting simultaneously
  // --------------------------------------------------------------------------
  it("handles two different players acting simultaneously with atomic state updates", async () => {
    seedActiveGame("speed_duel", "playing");

    const actionA: GameAction = {
      gameId: GAME_ID,
      clientActionId: "simultaneous_action_player_a",
      type: "TRIGGER_TARGET",
      payload: { clientReactionMs: 320 },
      clientTimestamp: Date.now(),
    };

    const actionB: GameAction = {
      gameId: GAME_ID,
      clientActionId: "simultaneous_action_player_b",
      type: "TRIGGER_TARGET",
      payload: { clientReactionMs: 380 },
      clientTimestamp: Date.now(),
    };

    // Both players fire action concurrently
    const [resultA, resultB] = await Promise.all([
      submitGameAction(actionA, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      }),
      submitGameAction(actionB, {
        auth: { uid: PLAYER_B },
        repository,
        enforceAppCheck: false,
      }),
    ]);

    expect(resultA.accepted).toBe(true);
    expect(resultB.accepted).toBe(true);
    expect(resultA.idempotentDuplicate).toBe(false);
    expect(resultB.idempotentDuplicate).toBe(false);

    // Verify sequential version progression (e.g. 1 -> 2 -> 3)
    const versions = [resultA.stateVersion, resultB.stateVersion].sort((a, b) => a - b);
    expect(versions).toEqual([2, 3]);

    // Single authoritative state invariant
    const finalState = await repository.getEphemeralGameState(GAME_ID);
    expect(finalState).not.toBeNull();
    expect(finalState?.version).toBe(3);
    // Both action IDs must be recorded in the final committed state
    expect(finalState?.processedActionIds[actionA.clientActionId]).toBeDefined();
    expect(finalState?.processedActionIds[actionB.clientActionId]).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 2. Same player double-clicking
  // --------------------------------------------------------------------------
  it("handles same player double-clicking via atomic idempotency guard", async () => {
    seedActiveGame("couple_race", "playing", { turnPlayerId: PLAYER_A });

    const doubleClickActionId = "double_click_action_777";
    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: doubleClickActionId,
      type: "ROLL_DICE",
      payload: {},
      clientTimestamp: Date.now(),
    };

    // Fired concurrently (rapid double-click)
    const [click1, click2] = await Promise.all([
      submitGameAction(action, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      }),
      submitGameAction(action, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      }),
    ]);

    expect(click1.accepted).toBe(true);
    expect(click2.accepted).toBe(true);

    // Exactly one is accepted as original, the other as idempotent duplicate
    const nonDuplicates = [click1, click2].filter((r) => !r.idempotentDuplicate);
    const duplicates = [click1, click2].filter((r) => r.idempotentDuplicate);

    expect(nonDuplicates.length).toBe(1);
    expect(duplicates.length).toBe(1);

    // State version incremented ONLY ONCE
    expect(nonDuplicates[0].stateVersion).toBe(2);
    expect(duplicates[0].stateVersion).toBe(2);

    const finalState = await repository.getEphemeralGameState(GAME_ID);
    expect(finalState?.version).toBe(2);
    expect(Object.keys(finalState?.processedActionIds || {}).length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 3. Identical action submitted simultaneously
  // --------------------------------------------------------------------------
  it("handles identical action submitted simultaneously without double-mutating", async () => {
    seedActiveGame("couple_race", "playing");

    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: "identical_simultaneous_roll",
      type: "ROLL_DICE",
      payload: {},
      clientTimestamp: Date.now(),
    };

    const results = await Promise.all([
      submitGameAction(action, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      }),
      submitGameAction(action, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      }),
      submitGameAction(action, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      }),
    ]);

    const initialExecution = results.filter((r) => !r.idempotentDuplicate);
    const duplicateExecutions = results.filter((r) => r.idempotentDuplicate);

    expect(initialExecution.length).toBe(1);
    expect(duplicateExecutions.length).toBe(2);

    const finalState = await repository.getEphemeralGameState(GAME_ID);
    expect(finalState?.version).toBe(2);
  });

  // --------------------------------------------------------------------------
  // 4. Stale version
  // --------------------------------------------------------------------------
  it("rejects actions submitting a stale expected version with 409 STALE_VERSION", async () => {
    seedActiveGame("speed_duel", "playing", { version: 5 });

    const staleAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_stale_ver_1",
      type: "TRIGGER_TARGET",
      payload: {},
      clientTimestamp: Date.now(),
    };
    (staleAction as unknown as { expectedVersion: number }).expectedVersion = 4; // Current is 5

    await expect(
      submitGameAction(staleAction, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      })
    ).rejects.toMatchObject({
      code: "STALE_VERSION",
      statusCode: 409,
    });

    // Authoritative state remains at version 5
    const finalState = await repository.getEphemeralGameState(GAME_ID);
    expect(finalState?.version).toBe(5);
  });

  // --------------------------------------------------------------------------
  // 5. Stale client (expired round deadline)
  // --------------------------------------------------------------------------
  it("rejects actions from stale client when server round deadline has expired", async () => {
    const expiredDeadline = Date.now() - 5000;
    seedActiveGame("speed_duel", "playing", { roundDeadlineServer: expiredDeadline });

    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_expired_client",
      type: "TRIGGER_TARGET",
      payload: {},
      clientTimestamp: Date.now(),
    };

    await expect(
      submitGameAction(action, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
        serverTimestamp: Date.now(),
      })
    ).rejects.toMatchObject({
      code: "ACTION_DISALLOWED_FOR_STATE",
      statusCode: 400,
    });
  });

  // --------------------------------------------------------------------------
  // 6. Action after GAME_END
  // --------------------------------------------------------------------------
  it("rejects gameplay actions submitted after GAME_END with 409 GAME_NOT_ACTIVE", async () => {
    seedActiveGame("speed_duel", "game_end", {
      isFinished: true,
      status: "game_end",
      winnerId: PLAYER_A,
    });

    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_after_game_end",
      type: "TRIGGER_TARGET",
      payload: {},
      clientTimestamp: Date.now(),
    };

    await expect(
      submitGameAction(action, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      })
    ).rejects.toMatchObject({
      code: "GAME_NOT_ACTIVE",
      statusCode: 409,
    });
  });

  // --------------------------------------------------------------------------
  // 7. Action after ROUND_END
  // --------------------------------------------------------------------------
  it("rejects gameplay actions submitted after ROUND_END with 400 ACTION_DISALLOWED_FOR_STATE", async () => {
    seedActiveGame("find_it_first", "round_end", {
      status: "round_end",
    });

    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_after_round_end",
      type: "SELECT_CELL",
      payload: { cellId: "cell_1" },
      clientTimestamp: Date.now(),
    };

    await expect(
      submitGameAction(action, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      })
    ).rejects.toMatchObject({
      code: "ACTION_DISALLOWED_FOR_STATE",
      statusCode: 400,
    });
  });

  // --------------------------------------------------------------------------
  // 8. Wrong player's turn
  // --------------------------------------------------------------------------
  it("rejects turn-based action if submitted by wrong player with 400 NOT_PLAYER_TURN", async () => {
    seedActiveGame("couple_race", "playing", {
      turnPlayerId: PLAYER_A,
    });

    // Player B attempts to roll when it is Player A's turn
    const actionWrongPlayer: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_player_b_out_of_turn",
      type: "ROLL_DICE",
      payload: {},
      clientTimestamp: Date.now(),
    };

    await expect(
      submitGameAction(actionWrongPlayer, {
        auth: { uid: PLAYER_B },
        repository,
        enforceAppCheck: false,
      })
    ).rejects.toMatchObject({
      code: "NOT_PLAYER_TURN",
      statusCode: 400,
    });

    // Verify turn remained Player A
    const finalState = await repository.getEphemeralGameState(GAME_ID);
    expect(finalState?.turnPlayerId).toBe(PLAYER_A);
    expect(finalState?.version).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 9. Reconnect followed by an action
  // --------------------------------------------------------------------------
  it("atomically processes player disconnect, reconnect, and subsequent gameplay action", async () => {
    seedActiveGame("couple_race", "playing", {
      turnPlayerId: PLAYER_A,
    });

    // 1. Player A disconnects
    const disconnectAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_disconnect_a",
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
    expect(disconnectRes.stateVersion).toBe(2);

    // 2. Player A reconnects
    const reconnectAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_reconnect_a",
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
    expect(reconnectRes.stateVersion).toBe(3);

    // 3. Player A takes their turn
    const rollAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_roll_after_reconnect",
      type: "ROLL_DICE",
      payload: {},
      clientTimestamp: Date.now(),
    };

    const rollRes = await submitGameAction(rollAction, {
      auth: { uid: PLAYER_A },
      repository,
      enforceAppCheck: false,
    });
    expect(rollRes.accepted).toBe(true);
    expect(rollRes.stateVersion).toBe(4);

    const finalState = await repository.getEphemeralGameState(GAME_ID);
    expect(finalState?.version).toBe(4);
    expect(finalState?.processedActionIds["act_roll_after_reconnect"]).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 10. Multi-action burst concurrency & invariant verification
  // --------------------------------------------------------------------------
  it("preserves authoritative single-state invariant during high concurrent action bursts", async () => {
    seedActiveGame("speed_duel", "playing");

    // 8 concurrent actions
    const burstPromises = Array.from({ length: 8 }, (_, i) => {
      const pid = i % 2 === 0 ? PLAYER_A : PLAYER_B;
      const action: GameAction = {
        gameId: GAME_ID,
        clientActionId: `burst_act_${i}_${pid}`,
        type: "TRIGGER_TARGET",
        payload: { clientReactionMs: 300 + i * 10 },
        clientTimestamp: Date.now(),
      };
      return submitGameAction(action, {
        auth: { uid: pid },
        repository,
        enforceAppCheck: false,
      });
    });

    const results = await Promise.all(burstPromises);
    for (const r of results) {
      expect(r.accepted).toBe(true);
    }

    // Ensure all versions are strictly ordered and unique
    const versions = results.map((r) => r.stateVersion);
    const uniqueVersions = new Set(versions);
    expect(uniqueVersions.size).toBe(8);

    const finalState = await repository.getEphemeralGameState(GAME_ID);
    expect(finalState?.version).toBe(9); // Started at 1, +8 actions = 9
    expect(Object.keys(finalState?.processedActionIds || {}).length).toBe(8);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { submitGameAction, ActionValidationError } from "@/lib/firebase/server/submitGameAction";
import { ServerGameRepository } from "@/lib/firebase/server/gameRepository";
import type { GameSession, GameState, GameAction } from "@/types/domain";
import { MAX_BOUNDED_PROCESSED_ACTIONS, ACTION_CLAIM_TTL_MS } from "@/types/domain";

describe("Bounded Game Action History & Concurrency Idempotency", () => {
  let repository: ServerGameRepository;
  const GAME_ID = "game_concurrency_bounded_1";
  const PLAYER_A = "player_alice";
  const PLAYER_B = "player_bob";

  beforeEach(() => {
    repository = new ServerGameRepository({ useLiveBackend: false });
    repository.clearForTesting();
  });

  function seedGame(
    gameId: string = GAME_ID,
    gameType: "speed_duel" | "couple_race" = "couple_race",
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
      maxRounds: 50,
      version: 1,
      scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
      turnPlayerId: PLAYER_A,
      roundStartedAtServer: Date.now(),
      roundDeadlineServer: Date.now() + 60000,
      serverTimestamp: Date.now(),
      data: {
        scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
        boardSize: 100,
        playerPositions: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
        turnPlayerId: PLAYER_A,
        players: {
          [PLAYER_A]: { playerId: PLAYER_A, position: 0, totalRolls: 0, powers: [] },
          [PLAYER_B]: { playerId: PLAYER_B, position: 0, totalRolls: 0, powers: [] },
        },
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

  // -------------------------------------------------------------------------
  // 1. Same action submitted twice simultaneously
  // -------------------------------------------------------------------------
  it("processes exactly-once effect when same action is submitted twice simultaneously", async () => {
    seedGame(GAME_ID, "couple_race");
    const actionId = `act_${GAME_ID}_simultaneous_001`;

    const action: GameAction = {
      clientActionId: actionId,
      gameId: GAME_ID,
      playerId: PLAYER_A,
      type: "ROLL_DICE",
      payload: {},
      clientTimestamp: Date.now(),
    };

    const [res1, res2] = await Promise.all([
      submitGameAction(action, { auth: { uid: PLAYER_A }, repository, enforceAppCheck: false }),
      submitGameAction(action, { auth: { uid: PLAYER_A }, repository, enforceAppCheck: false }),
    ]);

    expect(res1.accepted).toBe(true);
    expect(res2.accepted).toBe(true);

    // Exactly one is the primary executor; the other is the idempotent duplicate
    const duplicates = [res1.idempotentDuplicate, res2.idempotentDuplicate];
    expect(duplicates).toContain(false);
    expect(duplicates).toContain(true);

    // Both return identical authoritative payload and state version
    expect(res1.stateVersion).toBe(2);
    expect(res2.stateVersion).toBe(2);
    expect(res1.payload).toEqual(res2.payload);

    // State version in store must be exactly 2 (incremented once, not twice)
    const finalState = await repository.getEphemeralGameState(GAME_ID);
    expect(finalState?.version).toBe(2);
    expect(finalState?.processedActionIds[actionId]).toBeDefined();
    expect(Object.keys(finalState?.processedActionIds || {}).length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 2. Same action from two server instances
  // -------------------------------------------------------------------------
  it("preserves exactly-once effect when same action is processed across two server instances", async () => {
    seedGame(GAME_ID, "couple_race");

    // Instantiate two server repositories sharing the isolated fixture testStore
    const instanceA = repository;
    const instanceB = new ServerGameRepository({
      useLiveBackend: false,
      testStore: (instanceA as any).testStore,
    });

    const actionId = `act_${GAME_ID}_multi_instance_001`;
    const action: GameAction = {
      clientActionId: actionId,
      gameId: GAME_ID,
      playerId: PLAYER_A,
      type: "ROLL_DICE",
      payload: {},
      clientTimestamp: Date.now(),
    };

    // First request processed by Instance A
    const resA = await submitGameAction(
      action,
      { auth: { uid: PLAYER_A }, repository: instanceA, enforceAppCheck: false }
    );
    expect(resA.accepted).toBe(true);
    expect(resA.idempotentDuplicate).toBe(false);
    expect(resA.stateVersion).toBe(2);

    // Duplicate request arrives at Instance B
    const resB = await submitGameAction(
      action,
      { auth: { uid: PLAYER_A }, repository: instanceB, enforceAppCheck: false }
    );
    expect(resB.accepted).toBe(true);
    expect(resB.idempotentDuplicate).toBe(true);
    expect(resB.stateVersion).toBe(2);
    expect(resB.payload).toEqual(resA.payload);

    const finalState = await instanceB.getEphemeralGameState(GAME_ID);
    expect(finalState?.version).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 3. Same action ID with different payload
  // -------------------------------------------------------------------------
  it("rejects duplicate action ID submission when payload is altered", async () => {
    seedGame(GAME_ID, "couple_race");
    const actionId = `act_${GAME_ID}_payload_mismatch_001`;

    const originalAction: GameAction = {
      clientActionId: actionId,
      gameId: GAME_ID,
      playerId: PLAYER_A,
      type: "ROLL_DICE",
      payload: { strategicChoice: "standard" },
      clientTimestamp: Date.now(),
    };

    const res1 = await submitGameAction(
      originalAction,
      { auth: { uid: PLAYER_A }, repository, enforceAppCheck: false }
    );
    expect(res1.accepted).toBe(true);
    expect(res1.stateVersion).toBe(2);

    // Submit same action ID with altered payload
    const alteredAction: GameAction = {
      clientActionId: actionId,
      gameId: GAME_ID,
      playerId: PLAYER_A,
      type: "ROLL_DICE",
      payload: { strategicChoice: "boosted_cheat" },
      clientTimestamp: Date.now() + 100,
    };

    await expect(
      submitGameAction(alteredAction, { auth: { uid: PLAYER_A }, repository, enforceAppCheck: false })
    ).rejects.toThrow(ActionValidationError);

    try {
      await submitGameAction(alteredAction, { auth: { uid: PLAYER_A }, repository, enforceAppCheck: false });
    } catch (err) {
      expect(err).toBeInstanceOf(ActionValidationError);
      expect((err as ActionValidationError).code).toBe("INVALID_ACTION_PAYLOAD");
      expect((err as ActionValidationError).statusCode).toBe(400);
    }

    // Ephemeral state must remain unmutated at version 2
    const finalState = await repository.getEphemeralGameState(GAME_ID);
    expect(finalState?.version).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 4. Same action ID used by another player
  // -------------------------------------------------------------------------
  it("rejects reuse of an action ID by a different player", async () => {
    seedGame(GAME_ID, "couple_race");
    const actionId = `act_${GAME_ID}_cross_player_001`;

    const playerAAction: GameAction = {
      clientActionId: actionId,
      gameId: GAME_ID,
      playerId: PLAYER_A,
      type: "ROLL_DICE",
      payload: {},
      clientTimestamp: Date.now(),
    };

    const resA = await submitGameAction(
      playerAAction,
      { auth: { uid: PLAYER_A }, repository, enforceAppCheck: false }
    );
    expect(resA.accepted).toBe(true);
    expect(resA.stateVersion).toBe(2);

    // Player B attempts to reuse Player A's action ID
    const playerBAction: GameAction = {
      clientActionId: actionId,
      gameId: GAME_ID,
      playerId: PLAYER_B,
      type: "ROLL_DICE",
      payload: {},
      clientTimestamp: Date.now(),
    };

    await expect(
      submitGameAction(playerBAction, { auth: { uid: PLAYER_B }, repository, enforceAppCheck: false })
    ).rejects.toThrow(ActionValidationError);

    try {
      await submitGameAction(playerBAction, { auth: { uid: PLAYER_B }, repository, enforceAppCheck: false });
    } catch (err) {
      expect(err).toBeInstanceOf(ActionValidationError);
      expect((err as ActionValidationError).code).toBe("ACTION_ID_REUSED_BY_OTHER_PLAYER");
      expect((err as ActionValidationError).statusCode).toBe(403);
    }

    const finalState = await repository.getEphemeralGameState(GAME_ID);
    expect(finalState?.version).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 5. Retry after server error
  // -------------------------------------------------------------------------
  it("allows client retry after an unexpected server persistence error", async () => {
    seedGame(GAME_ID, "couple_race");
    const actionId = `act_${GAME_ID}_retry_after_error_001`;

    const action: GameAction = {
      clientActionId: actionId,
      gameId: GAME_ID,
      playerId: PLAYER_A,
      type: "ROLL_DICE",
      payload: {},
      clientTimestamp: Date.now(),
    };

    // Simulate database failure during state transaction
    repository.simulatePersistenceFailure({ failTransactEphemeralGameState: true });

    await expect(
      submitGameAction(action, { auth: { uid: PLAYER_A }, repository, enforceAppCheck: false })
    ).rejects.toThrow();

    // Verify state was not committed
    let currentState = await repository.getEphemeralGameState(GAME_ID);
    expect(currentState?.version).toBe(1);
    expect(currentState?.processedActionIds[actionId]).toBeUndefined();

    // Clear the error simulation
    repository.clearPersistenceFailureSimulation();

    // Client retries the same action with the same actionId
    const retryRes = await submitGameAction(
      action,
      { auth: { uid: PLAYER_A }, repository, enforceAppCheck: false }
    );
    expect(retryRes.accepted).toBe(true);
    expect(retryRes.idempotentDuplicate).toBe(false);
    expect(retryRes.stateVersion).toBe(2);

    // Confirm state has committed action
    currentState = await repository.getEphemeralGameState(GAME_ID);
    expect(currentState?.version).toBe(2);
    expect(currentState?.processedActionIds[actionId]).toBeDefined();

    // Durable claim is now marked completed
    const claim = await repository.getActionClaim(actionId);
    expect(claim?.status).toBe("completed");
  });

  // -------------------------------------------------------------------------
  // 6. Bounded live state collection verification
  // -------------------------------------------------------------------------
  it("bounds live state action collections to MAX_BOUNDED_PROCESSED_ACTIONS", async () => {
    seedGame(GAME_ID, "couple_race", "playing");

    const totalActions = 35;
    expect(totalActions).toBeGreaterThan(MAX_BOUNDED_PROCESSED_ACTIONS);

    for (let i = 1; i <= totalActions; i++) {
      const actionId = `act_${GAME_ID}_bounded_seq_${String(i).padStart(3, "0")}`;
      const actionType = i % 2 === 1 ? "PLAYER_DISCONNECT" : "PLAYER_RECONNECT";
      const action: GameAction = {
        clientActionId: actionId,
        gameId: GAME_ID,
        playerId: PLAYER_A,
        type: actionType,
        payload: { sequence: i },
        clientTimestamp: Date.now() + i * 10,
      };

      const res = await submitGameAction(
        action,
        { auth: { uid: PLAYER_A }, repository, enforceAppCheck: false }
      );
      expect(res.accepted).toBe(true);
    }

    const finalState = await repository.getEphemeralGameState(GAME_ID);
    expect(finalState).not.toBeNull();

    // Both processedActionIds and processedActions must be strictly bounded
    const processedIdsCount = Object.keys(finalState?.processedActionIds || {}).length;
    const processedActionsCount = Object.keys(finalState?.processedActions || {}).length;

    expect(processedIdsCount).toBeLessThanOrEqual(MAX_BOUNDED_PROCESSED_ACTIONS);
    expect(processedActionsCount).toBeLessThanOrEqual(MAX_BOUNDED_PROCESSED_ACTIONS);
    expect(processedIdsCount).toBe(MAX_BOUNDED_PROCESSED_ACTIONS);

    // Earliest action (e.g. action 1) must have been pruned from live state
    const earliestActionId = `act_${GAME_ID}_bounded_seq_001`;
    expect(finalState?.processedActionIds[earliestActionId]).toBeUndefined();
    expect(finalState?.processedActions?.[earliestActionId]).toBeUndefined();

    // Latest action (action 35) must be present in live state
    const latestActionId = `act_${GAME_ID}_bounded_seq_035`;
    expect(finalState?.processedActionIds[latestActionId]).toBeDefined();
    expect(finalState?.processedActions?.[latestActionId]).toBeDefined();

    // Durable claim for earliest action still exists in durable storage
    const durableClaim = await repository.getActionClaim(earliestActionId);
    expect(durableClaim).not.toBeNull();
    expect(durableClaim?.status).toBe("completed");

    // Retrying the pruned action via durable claim safely returns idempotent duplicate
    const prunedRetryAction: GameAction = {
      clientActionId: earliestActionId,
      gameId: GAME_ID,
      playerId: PLAYER_A,
      type: "PLAYER_DISCONNECT",
      payload: { sequence: 1 },
      clientTimestamp: Date.now(),
    };

    const duplicateRes = await submitGameAction(
      prunedRetryAction,
      { auth: { uid: PLAYER_A }, repository, enforceAppCheck: false }
    );

    expect(duplicateRes.accepted).toBe(true);
    expect(duplicateRes.idempotentDuplicate).toBe(true);
    // Action was originally executed at version 2, and live gameState version remains unmutated
    expect(duplicateRes.stateVersion).toBe(2);
    expect(duplicateRes.gameState.version).toBe(finalState?.version);
  });

  // -------------------------------------------------------------------------
  // 7. Cleanup/expiration of old action claims
  // -------------------------------------------------------------------------
  it("cleans up expired action claims while retaining active claims", async () => {
    const now = Date.now();
    const expiredTimestamp = now - ACTION_CLAIM_TTL_MS - 5000;
    const activeTimestamp = now - 5000;

    // Directly seed claims via repository
    await repository.checkAndClaimActionId(
      "act_expired_1",
      GAME_ID,
      PLAYER_A,
      expiredTimestamp,
      "ROLL_DICE",
      {}
    );
    await repository.checkAndClaimActionId(
      "act_expired_2",
      GAME_ID,
      PLAYER_B,
      expiredTimestamp,
      "ROLL_DICE",
      {}
    );
    await repository.checkAndClaimActionId(
      "act_active_1",
      GAME_ID,
      PLAYER_A,
      activeTimestamp,
      "ROLL_DICE",
      {}
    );

    const cleanupResult = await repository.cleanupExpiredActionClaims(now);
    expect(cleanupResult.cleanedCount).toBe(2);

    expect(await repository.getActionClaim("act_expired_1")).toBeNull();
    expect(await repository.getActionClaim("act_expired_2")).toBeNull();
    expect(await repository.getActionClaim("act_active_1")).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // 8. Action ID cannot bypass turn or version checks
  // -------------------------------------------------------------------------
  it("ensures an action ID cannot bypass turn or version checks", async () => {
    seedGame(GAME_ID, "couple_race", "playing", {
      turnPlayerId: PLAYER_A,
      version: 5,
    });

    // Player B cannot use a new action ID during Player A's turn
    const wrongTurnAction: GameAction = {
      clientActionId: `act_${GAME_ID}_bypass_turn`,
      gameId: GAME_ID,
      playerId: PLAYER_B,
      type: "ROLL_DICE",
      payload: {},
      clientTimestamp: Date.now(),
    };

    await expect(
      submitGameAction(
        wrongTurnAction,
        { auth: { uid: PLAYER_B }, repository, enforceAppCheck: false }
      )
    ).rejects.toThrow(ActionValidationError);

    // Player A cannot provide a stale version for a new action
    const staleVersionAction = {
      clientActionId: `act_${GAME_ID}_stale_version`,
      gameId: GAME_ID,
      playerId: PLAYER_A,
      type: "ROLL_DICE",
      payload: {},
      expectedVersion: 3, // Current version is 5
      clientTimestamp: Date.now(),
    } as GameAction;

    await expect(
      submitGameAction(
        staleVersionAction,
        { auth: { uid: PLAYER_A }, repository, enforceAppCheck: false }
      )
    ).rejects.toThrow(ActionValidationError);
  });
});

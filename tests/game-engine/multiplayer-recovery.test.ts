import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MultiplayerRecoveryCoordinator,
  computeAuthoritativePhase,
  inFlightActionStorage,
  type InFlightActionRecord,
  type GamePhase,
} from "@/lib/multiplayer/multiplayerRecovery";
import { ServerGameRepository } from "@/lib/firebase/server/gameRepository";
import { submitGameAction } from "@/lib/firebase/server/submitGameAction";
import type { GameSession, GameState, GameAction } from "@/types/domain";

describe("Multiplayer Recovery Architecture Tests", () => {
  let repository: ServerGameRepository;
  const GAME_ID = "game_recovery_session_test";
  const PLAYER_A = "player_alice";
  const PLAYER_B = "player_bob";

  beforeEach(() => {
    repository = new ServerGameRepository({ useLiveBackend: false });
    repository.clearForTesting();
    inFlightActionStorage.clear(GAME_ID);
  });

  function seedTestGame(
    status: GameState["status"] = "playing",
    overrides: Partial<GameState> = {},
    sessionOverrides: Partial<GameSession> = {}
  ): { session: GameSession; state: GameState } {
    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: `couple_${GAME_ID}`,
      gameType: "couple_race",
      status,
      playerIds: [PLAYER_A, PLAYER_B],
      readyPlayerIds: [PLAYER_A],
      createdBy: PLAYER_A,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
      ...sessionOverrides,
    };

    const state: GameState = {
      gameId: GAME_ID,
      gameType: "couple_race",
      status,
      currentRound: 1,
      maxRounds: 3,
      version: 1,
      scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
      turnPlayerId: PLAYER_A,
      roundStartedAtServer: Date.now(),
      roundDeadlineServer: Date.now() + 60000,
      serverTimestamp: Date.now(),
      data: {
        boardSize: 20,
        playerPositions: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
        turnPlayerId: PLAYER_A,
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

  function createMockCoordinator(
    playerId: string = PLAYER_A,
    tabId: string = "tab_test_1"
  ): {
    coordinator: MultiplayerRecoveryCoordinator;
    callbacks: {
      onStateReconciled: ReturnType<typeof vi.fn>;
      onActionCommittedDuringDisconnect: ReturnType<typeof vi.fn>;
      onGameEndedWhileOffline: ReturnType<typeof vi.fn>;
      onPartnerConnectionChange: ReturnType<typeof vi.fn>;
      onPhaseChange: ReturnType<typeof vi.fn>;
      onConnectionStatusChange: ReturnType<typeof vi.fn>;
    };
  } {
    const callbacks = {
      onStateReconciled: vi.fn(),
      onActionCommittedDuringDisconnect: vi.fn(),
      onGameEndedWhileOffline: vi.fn(),
      onPartnerConnectionChange: vi.fn(),
      onPhaseChange: vi.fn(),
      onConnectionStatusChange: vi.fn(),
    };

    const coordinator = new MultiplayerRecoveryCoordinator({
      gameId: GAME_ID,
      playerId,
      tabId,
      fetchAggregateFn: async (id) => repository.getGameAggregate(id),
      submitActionFn: async (action, actingUid) => {
        const res = await submitGameAction(action, {
          auth: { uid: actingUid || playerId },
          repository,
          enforceAppCheck: false,
        });
        return {
          ...res,
          gameResult: res.gameResult ?? undefined,
        };
      },
      subscribeEphemeralFn: (id, cb) => {
        // Mock subscription by retrieving current state
        repository.getEphemeralGameState(id).then(cb);
        return () => {};
      },
      subscribeDurableFn: (id, cb) => {
        repository.getGameSession(id).then(cb);
        return () => {};
      },
      ...callbacks,
    });

    return { coordinator, callbacks };
  }

  // =========================================================================
  // TEST 1: Refresh during lobby
  // =========================================================================
  it("Scenario 1: Refresh during lobby restores authoritative lobby state without duplicate session", async () => {
    // Seed lobby session with Player A and Player B joined, Player A ready
    seedTestGame(
      "ready",
      { status: "ready", isFinished: false },
      { status: "ready", readyPlayerIds: [PLAYER_A] }
    );

    // Client reloads browser: React state is empty
    const { coordinator, callbacks } = createMockCoordinator(PLAYER_A, "tab_refresh_lobby");

    const result = await coordinator.start();

    expect(result.session).not.toBeNull();
    expect(result.state).not.toBeNull();
    expect(result.session?.gameId).toBe(GAME_ID);
    expect(result.session?.readyPlayerIds).toContain(PLAYER_A);

    // Phase must be authoritatively computed as 'ready'
    expect(coordinator.phase).toBe("ready");
    expect(callbacks.onStateReconciled).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: GAME_ID, status: "ready" }),
      expect.objectContaining({ gameId: GAME_ID }),
      "ready",
      undefined
    );

    coordinator.destroy();
  });

  // =========================================================================
  // TEST 2: Refresh during countdown
  // =========================================================================
  it("Scenario 2: Refresh during countdown rehydrates countdown state without resetting round", async () => {
    const countdownStartTime = Date.now() - 1000; // 1s into countdown
    seedTestGame(
      "countdown",
      {
        status: "countdown",
        roundStartedAtServer: countdownStartTime,
        currentRound: 1,
      },
      { status: "countdown" }
    );

    // Client refreshes in the middle of countdown
    const { coordinator } = createMockCoordinator(PLAYER_A, "tab_refresh_countdown");
    await coordinator.start();

    expect(coordinator.phase).toBe("countdown");
    expect(coordinator.state?.status).toBe("countdown");
    expect(coordinator.state?.roundStartedAtServer).toBe(countdownStartTime);
    expect(coordinator.state?.currentRound).toBe(1);

    coordinator.destroy();
  });

  // =========================================================================
  // TEST 3: Refresh during gameplay
  // =========================================================================
  it("Scenario 3: Refresh during gameplay does not trust stale React state and restores round and scores", async () => {
    // Gameplay in progress at Round 2 with scores 3 - 2
    seedTestGame("playing", {
      status: "playing",
      currentRound: 2,
      scores: { [PLAYER_A]: 3, [PLAYER_B]: 2 },
      turnPlayerId: PLAYER_B,
      data: {
        boardSize: 20,
        playerPositions: { [PLAYER_A]: 5, [PLAYER_B]: 4 },
        turnPlayerId: PLAYER_B,
      },
    });

    // Client refreshes
    const { coordinator } = createMockCoordinator(PLAYER_A, "tab_refresh_gameplay");
    await coordinator.start();

    // Verifies stale default state is ignored
    expect(coordinator.phase).toBe("playing");
    expect(coordinator.state?.currentRound).toBe(2);
    expect(coordinator.state?.scores[PLAYER_A]).toBe(3);
    expect(coordinator.state?.scores[PLAYER_B]).toBe(2);
    expect(coordinator.state?.turnPlayerId).toBe(PLAYER_B);

    coordinator.destroy();
  });

  // =========================================================================
  // TEST 4: Refresh after game end
  // =========================================================================
  it("Scenario 4: Refresh after game end preserves final scores, winner, and locked state", async () => {
    seedTestGame(
      "game_end",
      {
        status: "game_end",
        isFinished: true,
        winnerId: PLAYER_A,
        scores: { [PLAYER_A]: 10, [PLAYER_B]: 7 },
      },
      {
        status: "game_end",
        winnerId: PLAYER_A,
      }
    );

    const { coordinator } = createMockCoordinator(PLAYER_B, "tab_refresh_game_end");
    await coordinator.start();

    expect(coordinator.phase).toBe("game_end");
    expect(coordinator.state?.isFinished).toBe(true);
    expect(coordinator.state?.winnerId).toBe(PLAYER_A);
    expect(coordinator.state?.scores[PLAYER_A]).toBe(10);

    coordinator.destroy();
  });

  // =========================================================================
  // TEST 5: Disconnect during action
  // =========================================================================
  it("Scenario 5: Disconnect during action preserves action in storage for idempotency retry", async () => {
    seedTestGame("playing", { turnPlayerId: PLAYER_A });

    const { coordinator } = createMockCoordinator(PLAYER_A, "tab_action_disconnect");
    await coordinator.start();

    // Simulate network loss where submitActionFn fails before server receives it
    const mockFailingSubmitter = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    (coordinator as any).config.submitActionFn = mockFailingSubmitter;

    // Player attempts action
    let actionError: Error | null = null;
    try {
      await coordinator.submitAction("ROLL_DICE", {});
    } catch (e) {
      actionError = e as Error;
    }

    expect(actionError).not.toBeNull();
    // Action record was kept in inFlightActionStorage
    const pendingActions = inFlightActionStorage.getAll(GAME_ID);
    expect(pendingActions.length).toBe(1);
    expect(pendingActions[0].type).toBe("ROLL_DICE");
    expect(pendingActions[0].status).toBe("pending");

    // Network recovers: coordinator reconnects
    (coordinator as any).config.submitActionFn = async (action: GameAction, uid: string) =>
      submitGameAction(action, {
        auth: { uid: uid || PLAYER_A },
        repository,
        enforceAppCheck: false,
      });

    // Client resubmits using the preserved clientActionId
    const preservedId = pendingActions[0].clientActionId;
    const retryResult = await coordinator.submitAction(
      "ROLL_DICE",
      {},
      PLAYER_A
    );

    expect(retryResult.accepted).toBe(true);
    expect(coordinator.state?.turnPlayerId).toBeDefined();

    coordinator.destroy();
  });

  // =========================================================================
  // TEST 6: Disconnect immediately after action
  // =========================================================================
  it("Scenario 6: Disconnect immediately after action reconciles committed action on rehydrate", async () => {
    seedTestGame("playing", { turnPlayerId: PLAYER_A });

    const clientActionId = `act_committed_during_disconnect_${Date.now()}`;

    // Simulate action was committed by server while network dropped before response arrived
    const serverResult = await submitGameAction(
      {
        gameId: GAME_ID,
        clientActionId,
        type: "ROLL_DICE",
        payload: {},
        clientTimestamp: Date.now(),
        playerId: PLAYER_A,
      },
      {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      }
    );
    expect(serverResult.accepted).toBe(true);

    // Client's in-flight record still has it as pending
    inFlightActionStorage.set({
      clientActionId,
      gameId: GAME_ID,
      type: "ROLL_DICE",
      payload: {},
      playerId: PLAYER_A,
      submittedAt: Date.now(),
      status: "pending",
    });

    const { coordinator, callbacks } = createMockCoordinator(PLAYER_A, "tab_reconcile_committed");

    // Client reconnects
    await coordinator.start();

    // Must detect action committed during disconnect
    expect(callbacks.onActionCommittedDuringDisconnect).toHaveBeenCalledWith(
      expect.objectContaining({
        clientActionId,
        status: "committed_during_disconnect",
      })
    );

    // Storage is cleaned up
    expect(inFlightActionStorage.getAll(GAME_ID).length).toBe(0);

    coordinator.destroy();
  });

  // =========================================================================
  // TEST 7: Reconnect after opponent acted
  // =========================================================================
  it("Scenario 7: Reconnect after opponent acted immediately updates to latest state version", async () => {
    seedTestGame("playing", {
      turnPlayerId: PLAYER_B,
      scores: { [PLAYER_A]: 1, [PLAYER_B]: 1 },
      version: 1,
    });

    const { coordinator } = createMockCoordinator(PLAYER_A, "tab_player_a");
    await coordinator.start();

    expect(coordinator.state?.scores[PLAYER_B]).toBe(1);

    // Opponent (Player B) acts while Player A is disconnected/offline
    await submitGameAction(
      {
        gameId: GAME_ID,
        clientActionId: `act_bob_move_${Date.now()}`,
        type: "ROLL_DICE",
        payload: {},
        clientTimestamp: Date.now(),
        playerId: PLAYER_B,
      },
      {
        auth: { uid: PLAYER_B },
        repository,
        enforceAppCheck: false,
      }
    );

    // Player A reconnects / wakes up
    await coordinator.rehydrate("NETWORK_RESTORE");

    // Player A state is refreshed to latest version with Bob's action
    expect(coordinator.state?.version).toBeGreaterThan(1);
    expect(coordinator.state?.processedActionIds).toBeDefined();

    coordinator.destroy();
  });

  // =========================================================================
  // TEST 8: Reconnect after game ended
  // =========================================================================
  it("Scenario 8: Reconnect after game ended triggers onGameEndedWhileOffline and displays results", async () => {
    seedTestGame("playing", {
      status: "playing",
      isFinished: false,
    });

    const { coordinator, callbacks } = createMockCoordinator(PLAYER_A, "tab_offline_until_end");
    await coordinator.start();

    expect(coordinator.phase).toBe("playing");

    // While Player A is offline, game concludes on server
    const currentAggregate = await repository.getGameAggregate(GAME_ID);
    if (currentAggregate) {
      repository.seedGame(
        {
          ...currentAggregate.session,
          status: "game_end",
          winnerId: PLAYER_B,
        },
        {
          ...currentAggregate.state,
          status: "game_end",
          isFinished: true,
          winnerId: PLAYER_B,
          version: currentAggregate.state.version + 1,
        }
      );
    }

    // Player A reconnects
    await coordinator.rehydrate("NETWORK_RESTORE");

    expect(callbacks.onGameEndedWhileOffline).toHaveBeenCalled();
    expect(coordinator.phase).toBe("game_end");
    expect(coordinator.state?.winnerId).toBe(PLAYER_B);

    coordinator.destroy();
  });

  // =========================================================================
  // TEST 9: Two tabs for same user
  // =========================================================================
  it("Scenario 9: Two tabs for same user synchronize state without duplicate sessions or conflicts", async () => {
    seedTestGame("playing", {
      turnPlayerId: PLAYER_A,
      scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
      version: 1,
    });

    // Tab 1 and Tab 2 for Player A
    const tab1 = createMockCoordinator(PLAYER_A, "tab_user_alex_1");
    const tab2 = createMockCoordinator(PLAYER_A, "tab_user_alex_2");

    await tab1.coordinator.start();
    await tab2.coordinator.start();

    expect(tab1.coordinator.session?.gameId).toBe(GAME_ID);
    expect(tab2.coordinator.session?.gameId).toBe(GAME_ID);

    // Tab 1 submits action
    const actionResult = await tab1.coordinator.submitAction("ROLL_DICE", {}, PLAYER_A);
    expect(actionResult.accepted).toBe(true);
    expect(tab1.coordinator.state?.version).toBe(2);

    // Tab 2 rehydrates (e.g. from tab sync or focus)
    await tab2.coordinator.rehydrate("TAB_SYNC");

    // Both tabs now reflect the updated authoritative state version
    expect(tab2.coordinator.state?.version).toBe(2);
    expect(tab2.coordinator.state?.turnPlayerId).toBe(tab1.coordinator.state?.turnPlayerId);

    // Idempotent duplicate check: If Tab 2 sends the identical action, server rejects it or treats it idempotently
    const duplicateSubmission = await submitGameAction(
      {
        gameId: GAME_ID,
        clientActionId: actionResult.clientActionId,
        type: "ROLL_DICE",
        payload: {},
        clientTimestamp: Date.now(),
        playerId: PLAYER_A,
      },
      {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      }
    );

    expect(duplicateSubmission.accepted).toBe(true);
    expect(duplicateSubmission.idempotentDuplicate).toBe(true);

    tab1.coordinator.destroy();
    tab2.coordinator.destroy();
  });
});

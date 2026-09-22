import { describe, it, expect, beforeEach } from "vitest";
import { submitGameAction, ActionValidationError } from "@/lib/firebase/server/submitGameAction";
import { ServerGameRepository } from "@/lib/firebase/server/gameRepository";
import { AuthoritativeGameEngine } from "@/lib/firebase/server/authoritativeGameEngine";
import type { GameSession, GameState, GameAction, PrivateGameState } from "@/types/domain";

describe("Game State Machine Security Hardening - Round Advancement Invariants", () => {
  let repository: ServerGameRepository;
  const GAME_ID = "hardening_test_game_1";
  const PLAYER_A = "player_alex";
  const PLAYER_B = "player_sam";
  const COUPLE_ID = "couple_london_tokyo";
  const VALID_APP_CHECK = "valid-test-app-check-token";
  const BASE_TIME = 1750000000000;

  beforeEach(() => {
    repository = new ServerGameRepository();
  });

  function createFindItFirstSession(): GameSession {
    return {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "find_it_first",
      status: "playing",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date(BASE_TIME).toISOString(),
      schemaVersion: 1,
    };
  }

  function createFindItFirstState(overrides?: Partial<GameState>): GameState {
    return {
      gameId: GAME_ID,
      gameType: "find_it_first",
      status: "playing",
      currentRound: 1,
      maxRounds: 5,
      version: 1,
      scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
      turnPlayerId: null,
      roundStartedAtServer: BASE_TIME,
      roundDeadlineServer: BASE_TIME + 15000,
      serverTimestamp: BASE_TIME,
      data: {
        roundStage: "playing",
        roundWinnerId: null,
        roundWinningCell: null,
        targetClue: "Find the red vintage clock",
        board: [{ id: "c1", icon: "clock", label: "Clock" }],
      },
      processedActionIds: {},
      isFinished: false,
      ...overrides,
    };
  }

  function createFindItFirstPrivateState(): PrivateGameState {
    return {
      gameId: GAME_ID,
      targetId: "target_clock_1",
      targetName: "Vintage Clock",
      targetCode: "#99",
      targetClue: "Find the red vintage clock",
      usedTargetIds: ["target_clock_1"],
    };
  }

  // 1. NEXT_ROUND during active Find It First round before resolution → reject.
  it("1. NEXT_ROUND during active Find It First round before resolution → reject", async () => {
    const session = createFindItFirstSession();
    const state = createFindItFirstState();
    const privateState = createFindItFirstPrivateState();

    repository.seedGame(session, state, privateState);

    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_skip_round_exploit",
      type: "NEXT_ROUND",
      payload: {},
      clientTimestamp: BASE_TIME + 2000,
    };

    // Client attempts to call NEXT_ROUND at t = BASE_TIME + 2000 (deadline is BASE_TIME + 15000, round unresolved)
    await expect(
      submitGameAction(action, {
        auth: { uid: PLAYER_A },
        appCheckToken: VALID_APP_CHECK,
        repository,
        serverTimestamp: BASE_TIME + 2000,
      })
    ).rejects.toThrow(ActionValidationError);

    // Direct AuthoritativeGameEngine call must also reject (defense in depth)
    expect(() =>
      AuthoritativeGameEngine.applyAction(
        session,
        state,
        action,
        PLAYER_A,
        BASE_TIME + 2000,
        privateState
      )
    ).toThrow(ActionValidationError);
  });

  // 2. NEXT_ROUND after legitimate round resolution → accept.
  it("2. NEXT_ROUND after legitimate round resolution → accept", async () => {
    const session = createFindItFirstSession();
    const state = createFindItFirstState({
      status: "round_end",
      data: {
        roundStage: "round_result",
        roundWinnerId: PLAYER_A,
        roundWinningCell: "c1",
        targetClue: "Find the red vintage clock",
      },
    });
    const privateState = createFindItFirstPrivateState();

    repository.seedGame(session, state, privateState);

    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_legit_next_round",
      type: "NEXT_ROUND",
      payload: {},
      clientTimestamp: BASE_TIME + 5000,
    };

    const outcome = await submitGameAction(action, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK,
      repository,
      serverTimestamp: BASE_TIME + 5000,
    });

    expect(outcome.accepted).toBe(true);
    expect(outcome.gameState.currentRound).toBe(2);
    expect(outcome.gameState.status).toBe("playing");
    expect(outcome.gameState.data.roundWinnerId).toBeNull();
    expect(outcome.gameState.roundDeadlineServer).toBeGreaterThan(BASE_TIME + 5000);
  });

  // 3. NEXT_ROUND after deadline expiration → accept.
  it("3. NEXT_ROUND after deadline expiration → accept", async () => {
    const session = createFindItFirstSession();
    // Deadline was BASE_TIME + 15000. Round is still unresolved (roundWinnerId is null).
    const state = createFindItFirstState({
      status: "playing",
      roundDeadlineServer: BASE_TIME + 15000,
      data: {
        roundStage: "playing",
        roundWinnerId: null,
        targetClue: "Find the red vintage clock",
      },
    });
    const privateState = createFindItFirstPrivateState();

    repository.seedGame(session, state, privateState);

    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_timeout_next_round",
      type: "NEXT_ROUND",
      payload: {},
      clientTimestamp: BASE_TIME + 16000,
    };

    // Submitting action AFTER deadline expiration (BASE_TIME + 16000 > BASE_TIME + 15000)
    const outcome = await submitGameAction(action, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK,
      repository,
      serverTimestamp: BASE_TIME + 16000,
    });

    expect(outcome.accepted).toBe(true);
    expect(outcome.gameState.currentRound).toBe(2);
    expect(outcome.gameState.status).toBe("playing");
    expect(outcome.gameState.roundDeadlineServer).toBe(BASE_TIME + 16000 + 15000);
  });

  // 4. NEXT_ROUND repeated concurrently → only one transition.
  it("4. NEXT_ROUND repeated concurrently → only one transition", async () => {
    const session = createFindItFirstSession();
    const state = createFindItFirstState({
      status: "round_end",
      currentRound: 1,
      data: {
        roundStage: "round_result",
        roundWinnerId: PLAYER_A,
        targetClue: "Round 1 target clue",
      },
    });
    const privateState = createFindItFirstPrivateState();

    repository.seedGame(session, state, privateState);

    // Player A and Player B concurrently submit NEXT_ROUND with different clientActionIds
    const actionA: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_concurrent_next_round_A",
      type: "NEXT_ROUND",
      payload: {},
      clientTimestamp: BASE_TIME + 3000,
    };

    const actionB: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_concurrent_next_round_B",
      type: "NEXT_ROUND",
      payload: {},
      clientTimestamp: BASE_TIME + 3001,
    };

    const promiseA = submitGameAction(actionA, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK,
      repository,
      serverTimestamp: BASE_TIME + 3010,
    });

    const promiseB = submitGameAction(actionB, {
      auth: { uid: PLAYER_B },
      appCheckToken: VALID_APP_CHECK,
      repository,
      serverTimestamp: BASE_TIME + 3010,
    });

    const results = await Promise.allSettled([promiseA, promiseB]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one transition must succeed, and the other must be rejected
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Final state must be at round 2, never jumped to round 3!
    const finalState = await repository.getEphemeralGameState(GAME_ID);
    expect(finalState?.currentRound).toBe(2);
    expect(finalState?.status).toBe("playing");
  });

  // 5. NEXT_ROUND from the wrong player → reject if the game requires a specific player.
  it("5. NEXT_ROUND from the wrong player → reject if the game requires a specific player", async () => {
    const session = createFindItFirstSession();
    const state = createFindItFirstState({
      status: "round_end",
      turnPlayerId: PLAYER_A, // specifically configured that it is PLAYER_A's turn
      data: {
        roundStage: "round_result",
        roundWinnerId: PLAYER_A,
      },
    });
    const privateState = createFindItFirstPrivateState();

    repository.seedGame(session, state, privateState);

    // PLAYER_B tries to advance when turnPlayerId is PLAYER_A
    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_wrong_player_next_round",
      type: "NEXT_ROUND",
      payload: {},
      clientTimestamp: BASE_TIME + 5000,
    };

    await expect(
      submitGameAction(action, {
        auth: { uid: PLAYER_B },
        appCheckToken: VALID_APP_CHECK,
        repository,
        serverTimestamp: BASE_TIME + 5000,
      })
    ).rejects.toThrow(ActionValidationError);

    // Also verify non-session player is rejected
    await expect(
      submitGameAction(action, {
        auth: { uid: "unauthorized_stranger" },
        appCheckToken: VALID_APP_CHECK,
        repository,
        serverTimestamp: BASE_TIME + 5000,
      })
    ).rejects.toThrow(ActionValidationError);
  });

  // 6. NEXT_ROUND after game over → reject.
  it("6. NEXT_ROUND after game over → reject", async () => {
    const session = createFindItFirstSession();
    session.status = "game_end";
    const state = createFindItFirstState({
      status: "game_end",
      isFinished: true,
      currentRound: 5,
      maxRounds: 5,
      winnerId: PLAYER_A,
    });
    const privateState = createFindItFirstPrivateState();

    repository.seedGame(session, state, privateState);

    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_after_game_over",
      type: "NEXT_ROUND",
      payload: {},
      clientTimestamp: BASE_TIME + 50000,
    };

    await expect(
      submitGameAction(action, {
        auth: { uid: PLAYER_A },
        appCheckToken: VALID_APP_CHECK,
        repository,
        serverTimestamp: BASE_TIME + 50000,
      })
    ).rejects.toThrow(ActionValidationError);
  });

  // 7. NEXT_ROUND cannot increase round beyond configured maximum.
  it("7. NEXT_ROUND cannot increase round beyond configured maximum", async () => {
    const session = createFindItFirstSession();
    // At round 5 of 5, round ended via timeout or resolution
    const state = createFindItFirstState({
      status: "round_end",
      currentRound: 5,
      maxRounds: 5,
      data: {
        roundStage: "round_result",
        roundWinnerId: PLAYER_A,
      },
    });
    const privateState = createFindItFirstPrivateState();

    repository.seedGame(session, state, privateState);

    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_max_round_next",
      type: "NEXT_ROUND",
      payload: {},
      clientTimestamp: BASE_TIME + 60000,
    };

    const outcome = await submitGameAction(action, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK,
      repository,
      serverTimestamp: BASE_TIME + 60000,
    });

    // It must finalize the game, never increment currentRound to 6
    expect(outcome.gameState.currentRound).toBe(5);
    expect(outcome.gameState.status).toBe("game_end");
    expect(outcome.gameState.isFinished).toBe(true);
    expect(outcome.gameResult).not.toBeNull();

    // Subsequent NEXT_ROUND must be rejected
    const nextAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_beyond_max_round",
      type: "NEXT_ROUND",
      payload: {},
      clientTimestamp: BASE_TIME + 61000,
    };

    await expect(
      submitGameAction(nextAction, {
        auth: { uid: PLAYER_A },
        appCheckToken: VALID_APP_CHECK,
        repository,
        serverTimestamp: BASE_TIME + 61000,
      })
    ).rejects.toThrow(ActionValidationError);
  });

  // 8. Similar illegal transition tests for other games: Speed Duel, Camera Challenge, Couple Race.
  describe("8. Game-specific transition tests for other games", () => {
    it("Speed Duel: NEXT_ROUND rejected during active tension/play, accepted after resolution or deadline", async () => {
      const session: GameSession = {
        gameId: "speed_duel_test_1",
        coupleId: COUPLE_ID,
        gameType: "speed_duel",
        status: "playing",
        playerIds: [PLAYER_A, PLAYER_B],
        createdBy: PLAYER_A,
        createdAt: new Date(BASE_TIME).toISOString(),
        schemaVersion: 1,
      };

      // State is in active tension phase, deadline has not expired, no winner
      const state: GameState = {
        gameId: "speed_duel_test_1",
        gameType: "speed_duel",
        status: "playing",
        currentRound: 1,
        maxRounds: 5,
        version: 1,
        scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
        turnPlayerId: null,
        roundStartedAtServer: BASE_TIME,
        roundDeadlineServer: BASE_TIME + 10000,
        serverTimestamp: BASE_TIME,
        data: {
          roundStage: "tension",
          roundWinnerId: null,
          falseStartPlayerId: null,
        },
        processedActionIds: {},
        isFinished: false,
      };

      repository.seedGame(session, state);

      const action: GameAction = {
        gameId: "speed_duel_test_1",
        clientActionId: "act_speed_duel_skip",
        type: "NEXT_ROUND",
        payload: {},
        clientTimestamp: BASE_TIME + 1000,
      };

      // 1. Rejected while round is unresolved and deadline active
      await expect(
        submitGameAction(action, {
          auth: { uid: PLAYER_A },
          appCheckToken: VALID_APP_CHECK,
          repository,
          serverTimestamp: BASE_TIME + 1000,
        })
      ).rejects.toThrow(ActionValidationError);

      // 2. Accepted after round is legitimately resolved (e.g. false start or reaction)
      state.status = "round_end";
      state.data = {
        roundStage: "round_result",
        roundWinnerId: PLAYER_B,
        falseStartPlayerId: PLAYER_A,
      };
      repository.seedGame(session, state);

      const resolvedOutcome = await submitGameAction(action, {
        auth: { uid: PLAYER_A },
        appCheckToken: VALID_APP_CHECK,
        repository,
        serverTimestamp: BASE_TIME + 2000,
      });

      expect(resolvedOutcome.accepted).toBe(true);
      expect(resolvedOutcome.gameState.currentRound).toBe(2);

      // 3. Accepted after deadline expiration
      const timeoutState: GameState = {
        ...state,
        currentRound: 2,
        status: "playing",
        roundDeadlineServer: BASE_TIME + 10000,
        data: {
          roundStage: "tension",
          roundWinnerId: null,
          falseStartPlayerId: null,
        },
      };
      repository.seedGame(session, timeoutState);

      const timeoutAction: GameAction = {
        gameId: "speed_duel_test_1",
        clientActionId: "act_speed_duel_timeout_next",
        type: "NEXT_ROUND",
        payload: {},
        clientTimestamp: BASE_TIME + 12000,
      };

      const timeoutOutcome = await submitGameAction(timeoutAction, {
        auth: { uid: PLAYER_B },
        appCheckToken: VALID_APP_CHECK,
        repository,
        serverTimestamp: BASE_TIME + 12000,
      });

      expect(timeoutOutcome.accepted).toBe(true);
      expect(timeoutOutcome.gameState.currentRound).toBe(3);
    });

    it("Camera Challenge: NEXT_CHALLENGE rejected during active perform/countdown, accepted after completion or deadline", async () => {
      const session: GameSession = {
        gameId: "cam_chal_test_1",
        coupleId: COUPLE_ID,
        gameType: "camera_challenge",
        status: "playing",
        playerIds: [PLAYER_A, PLAYER_B],
        createdBy: PLAYER_A,
        createdAt: new Date(BASE_TIME).toISOString(),
        schemaVersion: 1,
      };

      const state: GameState = {
        gameId: "cam_chal_test_1",
        gameType: "camera_challenge",
        status: "playing",
        currentRound: 1,
        maxRounds: 5,
        version: 1,
        scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
        turnPlayerId: null,
        roundStartedAtServer: BASE_TIME,
        roundDeadlineServer: BASE_TIME + 60000,
        serverTimestamp: BASE_TIME,
        data: {
          stage: "perform",
          stageDeadlineServer: BASE_TIME + 60000,
          currentPromptIndex: 0,
          submissions: { [PLAYER_A]: { score: 85 } }, // Only Player A submitted
        },
        processedActionIds: {},
        isFinished: false,
      };

      repository.seedGame(session, state);

      const action: GameAction = {
        gameId: "cam_chal_test_1",
        clientActionId: "act_cam_chal_premature",
        type: "NEXT_CHALLENGE",
        payload: {},
        clientTimestamp: BASE_TIME + 5000,
      };

      // 1. Rejected while still performing and deadline active
      await expect(
        submitGameAction(action, {
          auth: { uid: PLAYER_A },
          appCheckToken: VALID_APP_CHECK,
          repository,
          serverTimestamp: BASE_TIME + 5000,
        })
      ).rejects.toThrow(ActionValidationError);

      // 2. Accepted after stage becomes "result" (both submitted)
      state.status = "round_end";
      state.data = {
        ...state.data,
        stage: "result",
        submissions: {
          [PLAYER_A]: { score: 85 },
          [PLAYER_B]: { score: 92 },
        },
      };
      repository.seedGame(session, state);

      const resultOutcome = await submitGameAction(action, {
        auth: { uid: PLAYER_A },
        appCheckToken: VALID_APP_CHECK,
        repository,
        serverTimestamp: BASE_TIME + 10000,
      });

      expect(resultOutcome.accepted).toBe(true);
      expect(resultOutcome.gameState.currentRound).toBe(2);

      // 3. Accepted after deadline expiration
      const timeoutState: GameState = {
        ...state,
        currentRound: 2,
        status: "playing",
        roundDeadlineServer: BASE_TIME + 70000,
        data: {
          stage: "perform",
          stageDeadlineServer: BASE_TIME + 70000,
          currentPromptIndex: 1,
          submissions: {},
        },
      };
      repository.seedGame(session, timeoutState);

      const timeoutAction: GameAction = {
        gameId: "cam_chal_test_1",
        clientActionId: "act_cam_chal_timeout_next",
        type: "NEXT_CHALLENGE",
        payload: {},
        clientTimestamp: BASE_TIME + 75000,
      };

      const timeoutOutcome = await submitGameAction(timeoutAction, {
        auth: { uid: PLAYER_A },
        appCheckToken: VALID_APP_CHECK,
        repository,
        serverTimestamp: BASE_TIME + 75000,
      });

      expect(timeoutOutcome.accepted).toBe(true);
      expect(timeoutOutcome.gameState.currentRound).toBe(3);
    });

    it("Couple Race: NEXT_ROUND action is disallowed on turn-based couple_race", async () => {
      const session: GameSession = {
        gameId: "couple_race_test_inv",
        coupleId: COUPLE_ID,
        gameType: "couple_race",
        status: "playing",
        playerIds: [PLAYER_A, PLAYER_B],
        createdBy: PLAYER_A,
        createdAt: new Date(BASE_TIME).toISOString(),
        schemaVersion: 1,
      };

      const state: GameState = {
        gameId: "couple_race_test_inv",
        gameType: "couple_race",
        status: "playing",
        currentRound: 1,
        maxRounds: 2,
        version: 1,
        scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
        turnPlayerId: PLAYER_A,
        roundStartedAtServer: BASE_TIME,
        roundDeadlineServer: 0,
        serverTimestamp: BASE_TIME,
        data: {
          boardSize: 24,
          targetLaps: 2,
          currentTurnPlayerId: PLAYER_A,
          hasRolledThisTurn: false,
          hasMovedThisTurn: false,
          players: {
            [PLAYER_A]: { playerId: PLAYER_A, position: 0, lapsCompleted: 0, powers: [] },
            [PLAYER_B]: { playerId: PLAYER_B, position: 0, lapsCompleted: 0, powers: [] },
          },
        },
        processedActionIds: {},
        isFinished: false,
      };

      repository.seedGame(session, state);

      const action: GameAction = {
        gameId: "couple_race_test_inv",
        clientActionId: "act_race_illegal_next_round",
        type: "NEXT_ROUND",
        payload: {},
        clientTimestamp: BASE_TIME + 1000,
      };

      await expect(
        submitGameAction(action, {
          auth: { uid: PLAYER_A },
          appCheckToken: VALID_APP_CHECK,
          repository,
          serverTimestamp: BASE_TIME + 1000,
        })
      ).rejects.toThrow(ActionValidationError);
    });
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { submitGameAction } from "@/lib/firebase/server/submitGameAction";
import { ServerGameRepository } from "@/lib/firebase/server/gameRepository";
import { CAMERA_CHALLENGES } from "@/lib/firebase/server/authoritativeGameEngine";
import type { GameSession, GameState, GameAction } from "@/types/domain";

describe("Camera Challenge - Authoritative Multiplayer Engine", () => {
  let repository: ServerGameRepository;
  const GAME_ID = "camera_challenge_test_room_1";
  const PLAYER_A = "user_alex";
  const PLAYER_B = "user_sam";
  const COUPLE_ID = "couple_london_tokyo";
  const VALID_APP_CHECK = "valid-test-app-check-token";

  beforeEach(() => {
    repository = new ServerGameRepository();
  });

  function createInitialCameraChallengeGame(now: number) {
    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "camera_challenge",
      status: "ready",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date(now).toISOString(),
      schemaVersion: 1,
    };

    const state: GameState = {
      gameId: GAME_ID,
      gameType: "camera_challenge",
      status: "ready",
      currentRound: 1,
      maxRounds: 5,
      version: 1,
      scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
      roundStartedAtServer: now,
      roundDeadlineServer: now + 60000,
      serverTimestamp: now,
      data: {
        gameType: "camera_challenge",
        stage: "challenge",
        currentPromptIndex: 0,
        currentPrompt: CAMERA_CHALLENGES[0],
        submissions: {},
        stageStartedAtServer: now,
        stageDeadlineServer: now + 60000,
        roundHistory: [],
        skips: {},
        isGameEnd: false,
      },
      processedActionIds: {},
      isFinished: false,
    };

    repository.seedGame(session, state);
    return { session, state };
  }

  it("START_GAME transitions status to playing and stage to challenge", async () => {
    const now = 1700000000000;
    createInitialCameraChallengeGame(now);

    const action: GameAction = {
      clientActionId: "act_start_cc_1",
      gameId: GAME_ID,
      type: "START_GAME",
      payload: {},
      clientTimestamp: now,
    };

    const result = await submitGameAction(action, {
      auth: { uid: PLAYER_A },
      appCheckToken: VALID_APP_CHECK,
      repository,
      serverTimestamp: now + 50,
    });

    expect(result.accepted).toBe(true);
    expect(result.gameState?.status).toBe("playing");
    const data = result.gameState?.data as Record<string, unknown>;
    expect(data.stage).toBe("challenge");
    expect(data.currentPrompt).toBeDefined();
  });

  it("Full Event Flow: challenge -> countdown -> perform -> submit -> result", async () => {
    const now = 1700000000000;
    createInitialCameraChallengeGame(now);

    // 1. Start Game
    await submitGameAction(
      {
        clientActionId: "act_flow_start",
        gameId: GAME_ID,
        type: "START_GAME",
        payload: {},
        clientTimestamp: now,
      },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 10 }
    );

    // 2. Start Countdown
    const countdownResult = await submitGameAction(
      {
        clientActionId: "act_flow_countdown",
        gameId: GAME_ID,
        type: "START_COUNTDOWN",
        payload: { stage: "countdown" },
        clientTimestamp: now + 500,
      },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 520 }
    );
    expect(countdownResult.accepted).toBe(true);
    expect((countdownResult.gameState?.data as Record<string, unknown>).stage).toBe("countdown");

    // 3. Start Perform
    const performResult = await submitGameAction(
      {
        clientActionId: "act_flow_perform",
        gameId: GAME_ID,
        type: "START_PERFORM",
        payload: { stage: "perform" },
        clientTimestamp: now + 3500,
      },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 3520 }
    );
    expect(performResult.accepted).toBe(true);
    expect((performResult.gameState?.data as Record<string, unknown>).stage).toBe("perform");

    // 4. Player A submits (locks in)
    const sub1 = await submitGameAction(
      {
        clientActionId: "act_flow_sub_a",
        gameId: GAME_ID,
        type: "SUBMIT_CAMERA_CHALLENGE",
        payload: { submittedAt: now + 6000 },
        clientTimestamp: now + 6000,
      },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 6020 }
    );
    expect(sub1.accepted).toBe(true);
    const dataSub1 = sub1.gameState?.data as Record<string, unknown>;
    expect(dataSub1.stage).toBe("submit");

    // 5. Player B submits (locks in) -> Both locked in -> Result / round_end
    const sub2 = await submitGameAction(
      {
        clientActionId: "act_flow_sub_b",
        gameId: GAME_ID,
        type: "SUBMIT_CAMERA_CHALLENGE",
        payload: { submittedAt: now + 7000 },
        clientTimestamp: now + 7000,
      },
      { auth: { uid: PLAYER_B }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 7020 }
    );
    expect(sub2.accepted).toBe(true);
    expect(sub2.gameState?.status).toBe("round_end");
    const dataSub2 = sub2.gameState?.data as Record<string, unknown>;
    expect(dataSub2.stage).toBe("result");
    // Scores awarded
    expect(sub2.gameState?.scores[PLAYER_A]).toBe(100);
    expect(sub2.gameState?.scores[PLAYER_B]).toBe(100);
  });

  it("SKIP_CHALLENGE transitions to next prompt without penalizing scores", async () => {
    const now = 1700000000000;
    createInitialCameraChallengeGame(now);

    await submitGameAction(
      {
        clientActionId: "act_skip_start",
        gameId: GAME_ID,
        type: "START_GAME",
        payload: {},
        clientTimestamp: now,
      },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 10 }
    );

    const skipResult = await submitGameAction(
      {
        clientActionId: "act_skip_action",
        gameId: GAME_ID,
        type: "SKIP_CHALLENGE",
        payload: { nextIndex: 2 },
        clientTimestamp: now + 200,
      },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 220 }
    );

    expect(skipResult.accepted).toBe(true);
    const data = skipResult.gameState?.data as Record<string, unknown>;
    expect(data.currentPromptIndex).toBe(1);
    expect(data.stage).toBe("challenge");
    expect(skipResult.gameState?.scores[PLAYER_A]).toBe(0);
  });

  it("NEXT_CHALLENGE advances the round", async () => {
    const now = 1700000000000;
    createInitialCameraChallengeGame(now);

    // Start game & submit both to get to round_end
    await submitGameAction(
      { clientActionId: "a1", gameId: GAME_ID, type: "START_GAME", payload: {}, clientTimestamp: now },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 10 }
    );
    await submitGameAction(
      { clientActionId: "a2", gameId: GAME_ID, type: "SUBMIT_CAMERA_CHALLENGE", payload: {}, clientTimestamp: now + 100 },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 120 }
    );
    await submitGameAction(
      { clientActionId: "a3", gameId: GAME_ID, type: "SUBMIT_CAMERA_CHALLENGE", payload: {}, clientTimestamp: now + 150 },
      { auth: { uid: PLAYER_B }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 160 }
    );

    // Call NEXT_CHALLENGE
    const nextResult = await submitGameAction(
      {
        clientActionId: "act_next_challenge",
        gameId: GAME_ID,
        type: "NEXT_CHALLENGE",
        payload: { nextRound: 2 },
        clientTimestamp: now + 300,
      },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 320 }
    );

    expect(nextResult.accepted).toBe(true);
    expect(nextResult.gameState?.status).toBe("playing");
    expect(nextResult.gameState?.currentRound).toBe(2);
    const data = nextResult.gameState?.data as Record<string, unknown>;
    expect(data.stage).toBe("challenge");
  });

  it("REMATCH resets game to round 1 with zeroed scores", async () => {
    const now = 1700000000000;
    const { state } = createInitialCameraChallengeGame(now);
    state.status = "game_end";
    state.isFinished = true;
    state.scores = { [PLAYER_A]: 300, [PLAYER_B]: 300 };
    repository.seedGame(
      {
        gameId: GAME_ID,
        coupleId: COUPLE_ID,
        gameType: "camera_challenge",
        status: "game_end",
        playerIds: [PLAYER_A, PLAYER_B],
        createdBy: PLAYER_A,
        createdAt: new Date(now).toISOString(),
        schemaVersion: 1,
      },
      state
    );

    const rematchResult = await submitGameAction(
      {
        clientActionId: "act_rematch_cc",
        gameId: GAME_ID,
        type: "REMATCH",
        payload: {},
        clientTimestamp: now + 500,
      },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 520 }
    );

    expect(rematchResult.accepted).toBe(true);
    expect(rematchResult.gameState?.status).toBe("playing");
    expect(rematchResult.gameState?.currentRound).toBe(1);
    expect(rematchResult.gameState?.scores[PLAYER_A]).toBe(0);
    expect(rematchResult.gameState?.scores[PLAYER_B]).toBe(0);
  });
});

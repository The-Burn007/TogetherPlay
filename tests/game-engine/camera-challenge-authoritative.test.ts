import { describe, it, expect, beforeEach } from "vitest";
import { submitGameAction, ActionValidationError } from "@/lib/firebase/server/submitGameAction";
import { ServerGameRepository } from "@/lib/firebase/server/gameRepository";
import { CAMERA_CHALLENGES } from "@/lib/firebase/server/authoritativeGameEngine";
import { getPublicState } from "@/lib/games/gameStateContract";
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

    // 5. Player B submits (locks in) -> Both locked in -> Transition to partner_review
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
    const dataSub2 = sub2.gameState?.data as Record<string, unknown>;
    expect(dataSub2.stage).toBe("partner_review");

    // 6. Player A reviews & approves Player B
    const revA = await submitGameAction(
      {
        clientActionId: "act_flow_rev_a",
        gameId: GAME_ID,
        type: "APPROVE_CHALLENGE",
        payload: { targetPlayerId: PLAYER_B },
        clientTimestamp: now + 8000,
      },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 8020 }
    );
    expect(revA.accepted).toBe(true);
    expect(revA.gameState?.status).toBe("playing");

    // 7. Player B reviews & approves Player A -> Both approved -> Result / round_end
    const revB = await submitGameAction(
      {
        clientActionId: "act_flow_rev_b",
        gameId: GAME_ID,
        type: "APPROVE_CHALLENGE",
        payload: { targetPlayerId: PLAYER_A },
        clientTimestamp: now + 8500,
      },
      { auth: { uid: PLAYER_B }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 8520 }
    );
    expect(revB.accepted).toBe(true);
    expect(revB.gameState?.status).toBe("round_end");
    const dataRevB = revB.gameState?.data as Record<string, unknown>;
    expect(dataRevB.stage).toBe("result");
    // Authoritative scores awarded
    expect(revB.gameState?.scores[PLAYER_A]).toBe(100);
    expect(revB.gameState?.scores[PLAYER_B]).toBe(100);
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
    await submitGameAction(
      { clientActionId: "a4", gameId: GAME_ID, type: "APPROVE_CHALLENGE", payload: { targetPlayerId: PLAYER_B }, clientTimestamp: now + 180 },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 190 }
    );
    await submitGameAction(
      { clientActionId: "a5", gameId: GAME_ID, type: "APPROVE_CHALLENGE", payload: { targetPlayerId: PLAYER_A }, clientTimestamp: now + 200 },
      { auth: { uid: PLAYER_B }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 210 }
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

  it("prevents self-approval: player cannot review or approve their own submission", async () => {
    const now = 1700000000000;
    createInitialCameraChallengeGame(now);

    // Start game & submit both
    await submitGameAction(
      { clientActionId: "sa_1", gameId: GAME_ID, type: "START_GAME", payload: {}, clientTimestamp: now },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 10 }
    );
    await submitGameAction(
      { clientActionId: "sa_2", gameId: GAME_ID, type: "SUBMIT_CAMERA_CHALLENGE", payload: {}, clientTimestamp: now + 20 },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 30 }
    );
    await submitGameAction(
      { clientActionId: "sa_3", gameId: GAME_ID, type: "SUBMIT_CAMERA_CHALLENGE", payload: {}, clientTimestamp: now + 40 },
      { auth: { uid: PLAYER_B }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 50 }
    );

    // Player A attempts to approve Player A (themselves) -> must throw ActionValidationError
    await expect(
      submitGameAction(
        {
          clientActionId: "sa_self_approve",
          gameId: GAME_ID,
          type: "APPROVE_CHALLENGE",
          payload: { targetPlayerId: PLAYER_A },
          clientTimestamp: now + 60,
        },
        { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 70 }
      )
    ).rejects.toThrow(ActionValidationError);
  });

  it("prevents non-participant from submitting reviews", async () => {
    const now = 1700000000000;
    createInitialCameraChallengeGame(now);

    // Start game & submit both
    await submitGameAction(
      { clientActionId: "np_1", gameId: GAME_ID, type: "START_GAME", payload: {}, clientTimestamp: now },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 10 }
    );
    await submitGameAction(
      { clientActionId: "np_2", gameId: GAME_ID, type: "SUBMIT_CAMERA_CHALLENGE", payload: {}, clientTimestamp: now + 20 },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 30 }
    );
    await submitGameAction(
      { clientActionId: "np_3", gameId: GAME_ID, type: "SUBMIT_CAMERA_CHALLENGE", payload: {}, clientTimestamp: now + 40 },
      { auth: { uid: PLAYER_B }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 50 }
    );

    // Stranger user_charlie attempts to approve Player B -> must throw ActionValidationError
    await expect(
      submitGameAction(
        {
          clientActionId: "np_stranger",
          gameId: GAME_ID,
          type: "APPROVE_CHALLENGE",
          payload: { targetPlayerId: PLAYER_B },
          clientTimestamp: now + 60,
        },
        { auth: { uid: "user_charlie" }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 70 }
      )
    ).rejects.toThrow(ActionValidationError);
  });

  it("handles rejection correctly: approved player gets score, rejected player gets 0", async () => {
    const now = 1700000000000;
    createInitialCameraChallengeGame(now);

    await submitGameAction(
      { clientActionId: "rej_1", gameId: GAME_ID, type: "START_GAME", payload: {}, clientTimestamp: now },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 10 }
    );
    await submitGameAction(
      { clientActionId: "rej_2", gameId: GAME_ID, type: "SUBMIT_CAMERA_CHALLENGE", payload: {}, clientTimestamp: now + 20 },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 30 }
    );
    await submitGameAction(
      { clientActionId: "rej_3", gameId: GAME_ID, type: "SUBMIT_CAMERA_CHALLENGE", payload: {}, clientTimestamp: now + 40 },
      { auth: { uid: PLAYER_B }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 50 }
    );

    // Player A approves Player B
    const revA = await submitGameAction(
      {
        clientActionId: "rej_approve_b",
        gameId: GAME_ID,
        type: "APPROVE_CHALLENGE",
        payload: { targetPlayerId: PLAYER_B, feedback: "Great camera angle!" },
        clientTimestamp: now + 60,
      },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 70 }
    );
    expect(revA.accepted).toBe(true);

    // Player B rejects Player A
    const revB = await submitGameAction(
      {
        clientActionId: "rej_reject_a",
        gameId: GAME_ID,
        type: "REJECT_CHALLENGE",
        payload: { targetPlayerId: PLAYER_A, reason: "Did not show the requested item" },
        clientTimestamp: now + 80,
      },
      { auth: { uid: PLAYER_B }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 90 }
    );
    expect(revB.accepted).toBe(true);
    expect(revB.gameState?.status).toBe("round_end");

    // Player B was approved -> +50 (partial synergy)
    // Player A was rejected -> 0
    expect(revB.gameState?.scores[PLAYER_B]).toBe(50);
    expect(revB.gameState?.scores[PLAYER_A]).toBe(0);

    const data = revB.gameState?.data as Record<string, unknown>;
    expect(data.stage).toBe("result");
    const resolution = data.resolution as Record<string, unknown>;
    expect(resolution).toBeDefined();
    expect(resolution.allApproved).toBe(false);
    expect(resolution.status).toBe("partial");
  });

  it("enforces idempotent submissions: duplicate action returns cached state without side effects", async () => {
    const now = 1700000000000;
    createInitialCameraChallengeGame(now);

    await submitGameAction(
      { clientActionId: "idemp_start", gameId: GAME_ID, type: "START_GAME", payload: {}, clientTimestamp: now },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 10 }
    );

    const firstSubmission = await submitGameAction(
      {
        clientActionId: "idemp_sub_unique_123",
        gameId: GAME_ID,
        type: "SUBMIT_CAMERA_CHALLENGE",
        payload: { submittedAt: now + 100 },
        clientTimestamp: now + 100,
      },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 120 }
    );
    expect(firstSubmission.accepted).toBe(true);

    // Repeat the exact same clientActionId
    const duplicateSubmission = await submitGameAction(
      {
        clientActionId: "idemp_sub_unique_123",
        gameId: GAME_ID,
        type: "SUBMIT_CAMERA_CHALLENGE",
        payload: { submittedAt: now + 100 },
        clientTimestamp: now + 100,
      },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 140 }
    );

    expect(duplicateSubmission.accepted).toBe(true);
    expect(duplicateSubmission.stateVersion).toBe(firstSubmission.stateVersion);
  });

  it("handles concurrent submissions cleanly without corrupted state", async () => {
    const now = 1700000000000;
    createInitialCameraChallengeGame(now);

    await submitGameAction(
      { clientActionId: "conc_start", gameId: GAME_ID, type: "START_GAME", payload: {}, clientTimestamp: now },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 10 }
    );

    // Simultaneous submission from both players
    const [resA, resB] = await Promise.all([
      submitGameAction(
        {
          clientActionId: "conc_sub_a",
          gameId: GAME_ID,
          type: "SUBMIT_CAMERA_CHALLENGE",
          payload: { submittedAt: now + 100 },
          clientTimestamp: now + 100,
        },
        { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 120 }
      ),
      submitGameAction(
        {
          clientActionId: "conc_sub_b",
          gameId: GAME_ID,
          type: "SUBMIT_CAMERA_CHALLENGE",
          payload: { submittedAt: now + 105 },
          clientTimestamp: now + 105,
        },
        { auth: { uid: PLAYER_B }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 125 }
      ),
    ]);

    expect(resA.accepted).toBe(true);
    expect(resB.accepted).toBe(true);

    // After both submit, state must be in partner_review
    const latestState = await repository.getEphemeralGameState(GAME_ID);
    const data = latestState?.data as Record<string, unknown>;
    expect(data.stage).toBe("partner_review");
    expect(data.submissions).toBeDefined();
    const subs = data.submissions as Record<string, unknown>;
    expect(subs[PLAYER_A]).toBeDefined();
    expect(subs[PLAYER_B]).toBeDefined();
  });

  it("handles expired challenge cleanly: rejects actions past deadline", async () => {
    const now = 1700000000000;
    createInitialCameraChallengeGame(now);

    // Start the game so it transitions to "playing"
    await submitGameAction(
      { clientActionId: "exp_start", gameId: GAME_ID, type: "START_GAME", payload: {}, clientTimestamp: now },
      { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 10 }
    );

    // Attempt action after deadline (now + 60000) has expired
    await expect(
      submitGameAction(
        {
          clientActionId: "act_expired_after_deadline",
          gameId: GAME_ID,
          type: "SUBMIT_CAMERA_CHALLENGE",
          payload: {},
          clientTimestamp: now + 70000,
        },
        { auth: { uid: PLAYER_A }, appCheckToken: VALID_APP_CHECK, repository, serverTimestamp: now + 75000 }
      )
    ).rejects.toThrow(ActionValidationError);
  });

  it("REGRESSION TEST: ensures secret media fields never leak into public state", () => {
    const now = Date.now();
    const serverStateWithMediaLeak: GameState = {
      gameId: GAME_ID,
      gameType: "camera_challenge",
      status: "playing",
      currentRound: 1,
      maxRounds: 5,
      version: 5,
      scores: { [PLAYER_A]: 100, [PLAYER_B]: 100 },
      roundStartedAtServer: now,
      roundDeadlineServer: now + 60000,
      serverTimestamp: now,
      processedActionIds: {},
      isFinished: false,
      data: {
        gameType: "camera_challenge",
        stage: "partner_review",
        currentPromptIndex: 0,
        currentPrompt: CAMERA_CHALLENGES[0],
        submissions: {
          [PLAYER_A]: {
            submittedAt: now,
            ready: true,
            // Sensitive media fields that must NEVER enter public state
            rawMediaBlob: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...",
            rawBase64: "dGVzdC1tZWRpYS1jb250ZW50",
            imageDataUri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
            photoUrl: "https://storage.googleapis.com/private/photo-1.jpg",
            capturedBlobUrl: "blob:http://localhost:3000/media-uuid-1",
            videoStreamToken: "webrtc-private-media-token-12345",
          } as any,
        },
        reviews: {
          [PLAYER_A]: {
            reviewerId: PLAYER_A,
            targetPlayerId: PLAYER_B,
            decision: "approve",
            approved: true,
            feedback: "Awesome!",
            reviewedAt: now + 500,
          },
        },
      },
    };

    const publicState = getPublicState({ state: serverStateWithMediaLeak });

    // Verify public state sanitization
    const publicData = publicState.data as Record<string, any>;
    expect(publicData.stage).toBe("partner_review");
    expect(publicData.submissions[PLAYER_A]).toBeDefined();
    expect(publicData.submissions[PLAYER_A].ready).toBe(true);

    // All forbidden raw media fields must be stripped out!
    expect(publicData.submissions[PLAYER_A].rawMediaBlob).toBeUndefined();
    expect(publicData.submissions[PLAYER_A].rawBase64).toBeUndefined();
    expect(publicData.submissions[PLAYER_A].imageDataUri).toBeUndefined();
    expect(publicData.submissions[PLAYER_A].photoUrl).toBeUndefined();
    expect(publicData.submissions[PLAYER_A].capturedBlobUrl).toBeUndefined();
    expect(publicData.submissions[PLAYER_A].videoStreamToken).toBeUndefined();

    // Verify stringified public state contains zero media data leaks
    const jsonString = JSON.stringify(publicState);
    expect(jsonString).not.toContain("data:image/jpeg;base64");
    expect(jsonString).not.toContain("dGVzdC1tZWRpYS1jb250ZW50");
    expect(jsonString).not.toContain("storage.googleapis.com/private");
    expect(jsonString).not.toContain("webrtc-private-media-token-12345");
  });
});

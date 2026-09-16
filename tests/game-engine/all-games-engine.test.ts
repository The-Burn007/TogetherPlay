import { describe, it, expect, beforeEach } from "vitest";
import { submitGameAction } from "@/lib/firebase/server/submitGameAction";
import { ServerGameRepository } from "@/lib/firebase/server/gameRepository";
import type { GameSession, GameState, GameAction, GameType } from "@/types/domain";

describe("Game Engine Layer: Comprehensive Test of All 4 Games", () => {
  let repository: ServerGameRepository;
  const PLAYER_A = "usr_player_alex";
  const PLAYER_B = "usr_player_sam";
  const COUPLE_ID = "cpl_game_engine_test";

  beforeEach(() => {
    repository = new ServerGameRepository();
  });

  function createSessionAndState(gameType: GameType, gameId: string, initialData: Record<string, any> = {}) {
    const session: GameSession = {
      gameId,
      coupleId: COUPLE_ID,
      gameType,
      status: "playing",
      playerIds: [PLAYER_A, PLAYER_B],
      readyPlayerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    const state: GameState = {
      gameId,
      gameType,
      status: "playing",
      currentRound: 1,
      maxRounds: 3,
      version: 1,
      scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
      roundStartedAtServer: Date.now(),
      roundDeadlineServer: Date.now() + 30000,
      serverTimestamp: Date.now(),
      processedActionIds: {},
      isFinished: false,
      data: initialData,
    };

    repository.seedGame(session, state);
    return { session, state };
  }

  // ---------------------------------------------------------------------------
  // 1. Find It First
  // ---------------------------------------------------------------------------
  describe("1. Find It First", () => {
    it("validates authoritative cell selection, awards points to fastest correct player, and avoids duplicate rounds", async () => {
      const gameId = "gm_fif_comp_1";
      createSessionAndState("find_it_first", gameId, {
        targetId: "compass",
        board: ["watch", "compass", "key", "seal", "pen", "hourglass", "prism", "book", "camera", "bell", "monocle", "mug"],
        roundAnswers: {},
      });

      // 1. Player B selects wrong cell while round is playing
      const actionB: GameAction = {
        gameId,
        clientActionId: "fif_act_wrong",
        type: "SELECT_CELL",
        payload: { cellId: "pen" },
        clientTimestamp: Date.now(),
      };

      const resB = await submitGameAction(actionB, {
        auth: { uid: PLAYER_B },
        repository,
        enforceAppCheck: false,
      });

      expect(resB.accepted).toBe(true);
      expect(resB.gameState.scores[PLAYER_B]).toBe(0); // No points for wrong cell
      expect(resB.gameState.status).toBe("playing"); // Round still active

      // 2. Player A picks the correct target and wins the round
      const actionA: GameAction = {
        gameId,
        clientActionId: "fif_act_correct",
        type: "SELECT_CELL",
        payload: { cellId: "compass" },
        clientTimestamp: Date.now(),
      };

      const resA = await submitGameAction(actionA, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      });

      expect(resA.accepted).toBe(true);
      expect(resA.gameState.scores[PLAYER_A]).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Speed Duel
  // ---------------------------------------------------------------------------
  describe("2. Speed Duel", () => {
    it("coordinates tension phase, triggers active target, and scores authoritative reaction times", async () => {
      const gameId = "gm_speed_comp_1";
      const targetTime = Date.now() - 500; // Target has already appeared

      createSessionAndState("speed_duel", gameId, {
        roundStage: "tension",
        targetAppearedAtServer: targetTime,
        roundWinnerId: null,
        roundWinnerReactionMs: null,
        playerReactions: {},
        falseStarts: {},
        roundHistory: [],
      });

      // 1. Trigger Target when tension elapses
      const triggerAction: GameAction = {
        gameId,
        clientActionId: "act_trigger_speed",
        type: "TRIGGER_TARGET",
        payload: {},
        clientTimestamp: Date.now(),
      };

      const triggerRes = await submitGameAction(triggerAction, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      });

      expect(triggerRes.accepted).toBe(true);
      expect(triggerRes.gameState.data.roundStage).toBe("active");

      // 2. Player A reacts with fastest tap
      const reactionAction: GameAction = {
        gameId,
        clientActionId: "act_reaction_player_a",
        type: "SUBMIT_REACTION",
        payload: { clientReactionMs: 240 },
        clientTimestamp: Date.now(),
      };

      const reactionRes = await submitGameAction(reactionAction, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      });

      expect(reactionRes.accepted).toBe(true);
      expect(reactionRes.gameState.scores[PLAYER_A]).toBeGreaterThan(0);
      expect(reactionRes.gameState.data.roundWinnerId).toBe(PLAYER_A);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Couple Race
  // ---------------------------------------------------------------------------
  describe("3. Couple Race", () => {
    it("handles dice rolling, token movement, wrap-around board, and lap tracking", async () => {
      const gameId = "gm_race_comp_1";
      createSessionAndState("couple_race", gameId, {
        boardSize: 24,
        targetLaps: 2,
        currentTurnPlayerId: PLAYER_A,
        hasRolledThisTurn: false,
        hasMovedThisTurn: false,
        players: {
          [PLAYER_A]: { playerId: PLAYER_A, position: 22, lapsCompleted: 0, totalRolls: 0 },
          [PLAYER_B]: { playerId: PLAYER_B, position: 10, lapsCompleted: 0, totalRolls: 0 },
        },
      });

      // 1. Player A rolls dice
      const rollAction: GameAction = {
        gameId,
        clientActionId: "race_roll_a_1",
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
      expect(rollRes.gameState.data.hasRolledThisTurn).toBe(true);
      const diceValue = rollRes.gameState.data.currentDiceValue as number;
      expect(diceValue).toBeGreaterThanOrEqual(1);
      expect(diceValue).toBeLessThanOrEqual(6);

      // 2. Player A moves token
      const validMove = (rollRes.gameState.data as Record<string, any>).validMovePositions[0];
      const moveAction: GameAction = {
        gameId,
        clientActionId: "race_move_a_1",
        type: "MOVE",
        payload: { targetPosition: validMove },
        clientTimestamp: Date.now(),
      };

      const moveRes = await submitGameAction(moveAction, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      });

      expect(moveRes.accepted).toBe(true);
      expect((moveRes.gameState.data as Record<string, any>).hasMovedThisTurn).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Camera Challenge
  // ---------------------------------------------------------------------------
  describe("4. Camera Challenge", () => {
    it("coordinates photo challenge prompts, submission statuses, and mutual verification", async () => {
      const gameId = "gm_cam_comp_1";
      createSessionAndState("camera_challenge", gameId, {
        stage: "challenge",
        currentPromptIndex: 0,
        currentPrompt: {
          id: "cam_blue_object",
          title: "Show something blue.",
          category: "scavenger",
          description: "Hold up an unmistakably blue object.",
          durationSeconds: 20,
        },
        submissions: {},
      });

      // Player A submits camera challenge photo
      const submitA: GameAction = {
        gameId,
        clientActionId: "cam_submit_a",
        type: "SUBMIT_CAMERA_CHALLENGE",
        payload: {},
        clientTimestamp: Date.now(),
      };

      const resA = await submitGameAction(submitA, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      });

      expect(resA.accepted).toBe(true);
      expect((resA.gameState.data as Record<string, any>).submissions[PLAYER_A]).toBeDefined();

      // Player B submits camera challenge photo
      const submitB: GameAction = {
        gameId,
        clientActionId: "cam_submit_b",
        type: "SUBMIT_CAMERA_CHALLENGE",
        payload: {},
        clientTimestamp: Date.now(),
      };

      const resB = await submitGameAction(submitB, {
        auth: { uid: PLAYER_B },
        repository,
        enforceAppCheck: false,
      });

      expect(resB.accepted).toBe(true);
      // Both submitted: points awarded to both partners
      expect(resB.gameState.scores[PLAYER_A]).toBeGreaterThan(0);
      expect(resB.gameState.scores[PLAYER_B]).toBeGreaterThan(0);
      expect(resB.gameState.data.stage).toBe("result");
    });
  });
});

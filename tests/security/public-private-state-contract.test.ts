import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthoritativeGameEngine } from "@/lib/firebase/server/authoritativeGameEngine";
import { submitGameAction } from "@/lib/firebase/server/submitGameAction";
import { ServerGameRepository } from "@/lib/firebase/server/gameRepository";
import { POST as handleGameSessionPost, GET as handleGameSessionGet } from "@/app/api/games/session/route";
import { NextRequest } from "next/server";
import type { GameSession, GameState, PublicGameState, PrivateGameState, GameAction } from "@/types/domain";
import {
  getPublicState,
  getPrivateState,
  auditPublicStateForLeaks,
  GAME_STATE_CONTRACTS,
  FORBIDDEN_PUBLIC_FIELDS,
} from "@/lib/games/gameStateContract";

vi.mock("@/lib/firebase/server/admin", () => ({
  getAdminAuth: vi.fn(() => ({
    verifyIdToken: vi.fn(async (token: string) => {
      if (token && (token.startsWith("valid_token_") || token === "valid_id_token")) {
        const uid = token.startsWith("valid_token_") ? token.replace("valid_token_", "") : "user_alex";
        return {
          uid,
          sub: uid,
          email: `${uid}@example.com`,
          email_verified: true,
          auth_time: Math.floor(Date.now() / 1000),
        };
      }
      const err = new Error("Invalid or unverified Firebase ID token.");
      (err as unknown as { code: string }).code = "auth/invalid-id-token";
      throw err;
    }),
  })),
  getAdminFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(async () => ({ exists: false, data: () => null })),
        set: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  })),
  getAdminDatabase: vi.fn(() => ({
    ref: vi.fn(() => ({
      get: vi.fn(async () => ({ exists: () => false, val: () => null })),
      set: vi.fn().mockResolvedValue(undefined),
    })),
  })),
  getAdminApp: vi.fn(() => ({})),
  isAdminFirebaseConfigured: vi.fn(() => true),
}));

describe("Formalized Public/Private Game State Contract", () => {
  let repository: ServerGameRepository;
  const GAME_ID = "contract_test_game";
  const PLAYER_A = "user_alex";
  const PLAYER_B = "user_sam";

  beforeEach(() => {
    repository = new ServerGameRepository({
      useLiveBackend: false,
    });
  });

  describe("Contract Definitions & Architecture", () => {
    it("exports comprehensive contract for each of the 6 audited games", () => {
      const auditedGames = [
        "find_it_first",
        "speed_duel",
        "couple_race",
        "camera_challenge",
        "ai_challenge",
        "ai_game_night",
      ] as const;

      for (const gameType of auditedGames) {
        const contract = GAME_STATE_CONTRACTS[gameType];
        expect(contract, `Contract missing for gameType: ${gameType}`).toBeDefined();
        expect(contract.gameType).toBe(gameType);
        expect(typeof contract.getPublicState).toBe("function");
        expect(typeof contract.getPrivateState).toBe("function");
        expect(Array.isArray(contract.forbiddenFields)).toBe(true);
        expect(contract.forbiddenFields.length).toBeGreaterThan(0);
      }
    });

    it("auditPublicStateForLeaks detects forbidden fields and returns clean for sanitized states", () => {
      const leakedState: PublicGameState = {
        gameId: GAME_ID,
        gameType: "find_it_first",
        status: "playing",
        currentRound: 1,
        maxRounds: 5,
        version: 1,
        scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
        roundStartedAtServer: Date.now(),
        roundDeadlineServer: Date.now() + 15000,
        serverTimestamp: Date.now(),
        data: {
          board: ["cell1", "cell2"],
          targetId: "secret_artifact_id",
          targetCode: "secret_code_xyz",
          targetAnswer: "secret_answer_revealed",
          usedTargetIds: ["secret_artifact_id"],
        },
        processedActionIds: {},
        isFinished: false,
      };

      const auditBefore = auditPublicStateForLeaks(leakedState);
      expect(auditBefore.hasLeak).toBe(true);
      expect(auditBefore.leakedFields).toContain("state.data.targetId");
      expect(auditBefore.leakedFields).toContain("state.data.targetCode");
      expect(auditBefore.leakedFields).toContain("state.data.targetAnswer");
      expect(auditBefore.leakedFields).toContain("state.data.usedTargetIds");

      // Apply getPublicState
      const sanitized = getPublicState({ state: leakedState });
      const auditAfter = auditPublicStateForLeaks(sanitized);
      expect(auditAfter.hasLeak).toBe(false);
      expect(auditAfter.leakedFields).toEqual([]);
      expect(sanitized.data.targetId).toBeUndefined();
      expect(sanitized.data.targetCode).toBeUndefined();
      expect(sanitized.data.targetAnswer).toBeUndefined();
      expect(sanitized.data.usedTargetIds).toBeUndefined();
      // Retains safe public board
      expect(sanitized.data.board).toEqual(["cell1", "cell2"]);
    });
  });

  describe("Audit & Invariants Across All Games", () => {
    it("1. Find It First: strips targetId, targetName, targetCode, targetAnswer, usedTargetIds", () => {
      const state: GameState = {
        gameId: "fif_test",
        gameType: "find_it_first",
        status: "playing",
        currentRound: 1,
        maxRounds: 5,
        version: 1,
        scores: {},
        roundStartedAtServer: Date.now(),
        roundDeadlineServer: Date.now() + 15000,
        serverTimestamp: Date.now(),
        data: {
          targetClue: "An ancient brass instrument",
          board: ["artifact_1", "artifact_2"],
          targetId: "artifact_1",
          targetName: "Antique Astrolabe",
          targetCode: "CODE_ASTROLABE",
          targetAnswer: "artifact_1",
          usedTargetIds: ["artifact_1"],
          roundStage: "playing",
        },
        processedActionIds: {},
        isFinished: false,
      };

      const publicState = getPublicState({ state });
      expect(publicState.data.targetClue).toBe("An ancient brass instrument");
      expect(publicState.data.board).toEqual(["artifact_1", "artifact_2"]);
      expect(publicState.data.targetId).toBeUndefined();
      expect(publicState.data.targetName).toBeUndefined();
      expect(publicState.data.targetCode).toBeUndefined();
      expect(publicState.data.targetAnswer).toBeUndefined();
      expect(publicState.data.usedTargetIds).toBeUndefined();

      const privateState = getPrivateState({ state });
      expect(privateState).toBeDefined();
      expect(privateState?.targetId).toBe("artifact_1");
      expect(privateState?.targetCode).toBe("CODE_ASTROLABE");
    });

    it("2. Speed Duel: strips secret seeds, answer keys, and hidden targets", () => {
      const state: GameState = {
        gameId: "sd_test",
        gameType: "speed_duel",
        status: "playing",
        currentRound: 1,
        maxRounds: 5,
        version: 1,
        scores: {},
        roundStartedAtServer: Date.now(),
        roundDeadlineServer: Date.now() + 6000,
        serverTimestamp: Date.now(),
        data: {
          roundStage: "tension",
          targetAnswer: "strike_key_leak",
          secretSeed: 987654,
          answerKey: "press_now",
          targetId: "forbidden_target",
          competitiveMode: "first_to_3",
        },
        processedActionIds: {},
        isFinished: false,
      };

      const publicState = getPublicState({ state });
      expect(publicState.data.roundStage).toBe("tension");
      expect(publicState.data.competitiveMode).toBe("first_to_3");
      expect(publicState.data.targetAnswer).toBeUndefined();
      expect(publicState.data.secretSeed).toBeUndefined();
      expect(publicState.data.answerKey).toBeUndefined();
      expect(publicState.data.targetId).toBeUndefined();
    });

    it("3. Couple Race: strips precomputed dice seeds, future rolls, and hidden deck cheats", () => {
      const state: GameState = {
        gameId: "cr_test",
        gameType: "couple_race",
        status: "playing",
        currentRound: 1,
        maxRounds: 10,
        version: 1,
        scores: {},
        roundStartedAtServer: Date.now(),
        roundDeadlineServer: Date.now() + 45000,
        serverTimestamp: Date.now(),
        data: {
          boardSize: 24,
          targetLaps: 3,
          players: {
            [PLAYER_A]: { position: 4, lapsCompleted: 0, powers: ["WIND_STRIDE"] },
          },
          diceSeed: "csprng_seed_xyz",
          nextDiceRoll: 6,
          hiddenDeck: ["CARD_OMEGA"],
        },
        processedActionIds: {},
        isFinished: false,
      };

      const publicState = getPublicState({ state });
      expect(publicState.data.boardSize).toBe(24);
      expect(publicState.data.targetLaps).toBe(3);
      expect(publicState.data.diceSeed).toBeUndefined();
      expect(publicState.data.nextDiceRoll).toBeUndefined();
      expect(publicState.data.hiddenDeck).toBeUndefined();
    });

    it("4. Camera Challenge: strips future challenges/prompts catalog, exposing only active prompt", () => {
      const state: GameState = {
        gameId: "cc_test",
        gameType: "camera_challenge",
        status: "playing",
        currentRound: 1,
        maxRounds: 5,
        version: 1,
        scores: {},
        roundStartedAtServer: Date.now(),
        roundDeadlineServer: Date.now() + 60000,
        serverTimestamp: Date.now(),
        data: {
          stage: "challenge",
          currentPrompt: { id: "p1", title: "Show your favorite mug" },
          futurePrompts: [
            { id: "p2", title: "Show a green book" },
            { id: "p3", title: "Recreate a movie pose" },
          ],
          allPrompts: ["p1", "p2", "p3"],
        },
        processedActionIds: {},
        isFinished: false,
      };

      const publicState = getPublicState({ state });
      expect(publicState.data.stage).toBe("challenge");
      expect(publicState.data.currentPrompt).toEqual({ id: "p1", title: "Show your favorite mug" });
      expect(publicState.data.futurePrompts).toBeUndefined();
      expect(publicState.data.allPrompts).toBeUndefined();
    });

    it("5. AI Challenge: strips model API keys, system prompts, raw LLM debug responses", () => {
      const state: GameState = {
        gameId: "ai_c_test",
        gameType: "ai_challenge",
        status: "playing",
        currentRound: 1,
        maxRounds: 5,
        version: 1,
        scores: {},
        roundStartedAtServer: Date.now(),
        roundDeadlineServer: Date.now() + 60000,
        serverTimestamp: Date.now(),
        data: {
          title: "Two Truths & An AI Lie",
          apiKey: "AIzaSySecretApiKeyDoNotExpose",
          systemPrompt: "You are a playful host. Do not reveal that Alex is the liar.",
          rawResponse: "{ tokens: 500, candidates: [...] }",
          modelConfig: { temperature: 0.7 },
          promptTokens: 420,
        },
        processedActionIds: {},
        isFinished: false,
      };

      const publicState = getPublicState({ state });
      expect(publicState.data.title).toBe("Two Truths & An AI Lie");
      expect(publicState.data.apiKey).toBeUndefined();
      expect(publicState.data.systemPrompt).toBeUndefined();
      expect(publicState.data.rawResponse).toBeUndefined();
      expect(publicState.data.modelConfig).toBeUndefined();
      expect(publicState.data.promptTokens).toBeUndefined();
    });

    it("6. AI Game Night: strips secret answer keys and unsubmitted partner answers", () => {
      const state: GameState = {
        gameId: "ai_gn_test",
        gameType: "ai_game_night",
        status: "playing",
        currentRound: 1,
        maxRounds: 5,
        version: 1,
        scores: {},
        roundStartedAtServer: Date.now(),
        roundDeadlineServer: Date.now() + 60000,
        serverTimestamp: Date.now(),
        data: {
          currentRound: 1,
          theme: "Couples Cozy Trivia",
          apiKey: "gemini_secret_key",
          answerKey: "Option C: Paris",
          partnerSecretAnswer: "User Alex answered B",
          systemPrompt: "Evaluate answers strictly.",
        },
        processedActionIds: {},
        isFinished: false,
      };

      const publicState = getPublicState({ state });
      expect(publicState.data.theme).toBe("Couples Cozy Trivia");
      expect(publicState.data.apiKey).toBeUndefined();
      expect(publicState.data.answerKey).toBeUndefined();
      expect(publicState.data.partnerSecretAnswer).toBeUndefined();
      expect(publicState.data.systemPrompt).toBeUndefined();
    });
  });

  describe("Engine & Transaction Enforcement", () => {
    it("AuthoritativeGameEngine.applyAction guarantees updatedState has 0 leaks on START_GAME", () => {
      const session: GameSession = {
        gameId: GAME_ID,
        coupleId: "couple_contract_test",
        gameType: "find_it_first",
        status: "ready",
        playerIds: [PLAYER_A, PLAYER_B],
        createdBy: PLAYER_A,
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
      };

      const state: GameState = {
        gameId: GAME_ID,
        gameType: "find_it_first",
        status: "ready",
        currentRound: 1,
        maxRounds: 5,
        version: 1,
        scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
        roundStartedAtServer: Date.now(),
        roundDeadlineServer: Date.now() + 15000,
        serverTimestamp: Date.now(),
        data: {
          board: [],
          roundStage: "ready",
          roundWinnerId: null,
          roundWinningCell: null,
        },
        processedActionIds: {},
        isFinished: false,
      };

      const execution = AuthoritativeGameEngine.applyAction(
        session,
        state,
        {
          gameId: GAME_ID,
          type: "START_GAME",
          playerId: PLAYER_A,
          clientActionId: "act_start_contract_test",
          clientTimestamp: Date.now(),
          payload: {},
        },
        PLAYER_A,
        Date.now(),
        null
      );

      // Verify updatedState is strictly a clean PublicGameState
      const audit = auditPublicStateForLeaks(execution.updatedState);
      expect(audit.hasLeak).toBe(false);
      expect(audit.leakedFields).toEqual([]);
      expect(execution.updatedState.data.targetId).toBeUndefined();
      expect(execution.updatedState.data.targetName).toBeUndefined();
      expect(execution.updatedState.data.targetCode).toBeUndefined();
      expect(execution.updatedState.data.targetAnswer).toBeUndefined();

      // Verify updatedPrivateState captured the secret target
      expect(execution.updatedPrivateState).toBeDefined();
      expect(execution.updatedPrivateState?.targetId).toBeDefined();
      expect(execution.updatedPrivateState?.targetCode).toBeDefined();
      expect(execution.updatedPrivateState?.targetName).toBeDefined();
    });

    it("submitGameAction returns gameState conforming strictly to PublicGameState contract", async () => {
      const session: GameSession = {
        gameId: GAME_ID,
        coupleId: "couple_contract_test",
        gameType: "find_it_first",
        status: "ready",
        playerIds: [PLAYER_A, PLAYER_B],
        createdBy: PLAYER_A,
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
      };

      const state: GameState = {
        gameId: GAME_ID,
        gameType: "find_it_first",
        status: "ready",
        currentRound: 1,
        maxRounds: 5,
        version: 1,
        scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
        roundStartedAtServer: Date.now(),
        roundDeadlineServer: Date.now() + 15000,
        serverTimestamp: Date.now(),
        data: {
          board: [],
          roundStage: "ready",
          roundWinnerId: null,
          roundWinningCell: null,
        },
        processedActionIds: {},
        isFinished: false,
      };

      await repository.saveGameSession(session);
      await repository.saveEphemeralGameState(state);

      const action: GameAction = {
        gameId: GAME_ID,
        type: "START_GAME",
        playerId: PLAYER_A,
        clientActionId: "act_start_submit_test",
        clientTimestamp: Date.now(),
        payload: {},
      };

      const result = await submitGameAction(action, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
      });

      expect(result.accepted).toBe(true);
      const audit = auditPublicStateForLeaks(result.gameState);
      expect(audit.hasLeak).toBe(false);
      expect(audit.leakedFields).toEqual([]);

      // Check the stored ephemeral state in the repository as well
      const storedPublicState = await repository.getEphemeralGameState(GAME_ID);
      expect(storedPublicState).not.toBeNull();
      if (storedPublicState) {
        const storedAudit = auditPublicStateForLeaks(storedPublicState);
        expect(storedAudit.hasLeak).toBe(false);
        expect(storedPublicState.data.targetId).toBeUndefined();
      }

      // Check that private state was persisted to isolated storage
      const privateState = await repository.getPrivateGameState(GAME_ID);
      expect(privateState).not.toBeNull();
      expect(privateState?.targetId).toBeDefined();
    });

    it("saveEphemeralGameState provides defense-in-depth by stripping secrets before writing", async () => {
      const taintedState: GameState = {
        gameId: "tainted_game",
        gameType: "find_it_first",
        status: "playing",
        currentRound: 1,
        maxRounds: 5,
        version: 1,
        scores: {},
        roundStartedAtServer: Date.now(),
        roundDeadlineServer: Date.now() + 15000,
        serverTimestamp: Date.now(),
        data: {
          board: ["cell_1", "cell_2"],
          targetId: "accidental_secret_target_leak",
          targetCode: "leak_12345",
          answerKey: "secret_solution",
        },
        processedActionIds: {},
        isFinished: false,
      };

      await repository.saveEphemeralGameState(taintedState);

      const retrieved = await repository.getEphemeralGameState("tainted_game");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.data.board).toEqual(["cell_1", "cell_2"]);
      expect(retrieved?.data.targetId).toBeUndefined();
      expect(retrieved?.data.targetCode).toBeUndefined();
      expect(retrieved?.data.answerKey).toBeUndefined();
    });

    it("POST /api/games/session and GET /api/games/session sanitize returned state", async () => {
      // Test POST session route
      const postReq = new NextRequest("http://localhost:3000/api/games/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer valid_token_${PLAYER_A}`,
          "x-firebase-appcheck": "valid_token",
        },
        body: JSON.stringify({
          gameId: "api_session_contract_game",
          gameType: "find_it_first",
          playerIds: [PLAYER_A, PLAYER_B],
        }),
      });

      const postRes = await handleGameSessionPost(postReq);
      expect(postRes.status).toBe(201);
      const postBody = await postRes.json();
      expect(postBody.state).toBeDefined();

      const postAudit = auditPublicStateForLeaks(postBody.state);
      expect(postAudit.hasLeak).toBe(false);
      expect(postAudit.leakedFields).toEqual([]);
      expect(postBody.state.data.targetId).toBeUndefined();

      // Test GET session route
      const getReq = new NextRequest(
        "http://localhost:3000/api/games/session?gameId=api_session_contract_game",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer valid_token_${PLAYER_A}`,
            "x-firebase-appcheck": "valid_token",
          },
        }
      );

      const getRes = await handleGameSessionGet(getReq);
      expect(getRes.status).toBe(200);
      const getBody = await getRes.json();
      expect(getBody.state).toBeDefined();

      const getAudit = auditPublicStateForLeaks(getBody.state);
      expect(getAudit.hasLeak).toBe(false);
      expect(getAudit.leakedFields).toEqual([]);
      expect(getBody.state.data.targetId).toBeUndefined();
    });
  });
});

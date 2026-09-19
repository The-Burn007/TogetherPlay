/**
 * Security Audit Regression Test Suite: Development/Test Bypasses & Client Cheating Flags
 * 
 * AUDIT OBJECTIVES:
 * 1. Verify `isCorrectMock` is completely eliminated from the production game action schema and engine.
 * 2. Ensure clients cannot influence authoritative outcomes (scores, winners, targets, dice, timers, phases).
 * 3. Verify rejection of testing/bypass flags (isCorrectMock, skipAuth, skipValidation, cheat, force, bypass).
 * 4. Verify strict structural validation and production-mode rejection of forbidden authoritative fields.
 * 5. Verify that tests and gameplay construct legitimate server state rather than using cheating flags.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { submitGameAction, ActionValidationError } from "@/lib/firebase/server/submitGameAction";
import { validateActionPayloadStructure } from "@/lib/firebase/server/security";
import { AuthoritativeGameEngine } from "@/lib/firebase/server/authoritativeGameEngine";
import type { GameAction, GameState, GameSession, GameResult } from "@/types/domain";
import type { GameRepositoryContract } from "@/lib/firebase/server/gameRepository";

const GAME_ID = "game_audit_session_1";
const COUPLE_ID = "couple_audit_1";
const PLAYER_A = "user_alex_audit";
const PLAYER_B = "user_sam_audit";
const VALID_APP_CHECK = "valid_audit_app_check_jwt";

class InMemoryAuditGameRepository implements GameRepositoryContract {
  public sessions = new Map<string, GameSession>();
  public states = new Map<string, GameState>();
  public results = new Map<string, unknown>();
  public actionClaims = new Map<string, { gameId: string; playerId: string; timestamp: number }>();

  seedGame(session: GameSession, state: GameState): void {
    this.sessions.set(session.gameId, { ...session });
    this.states.set(state.gameId, { ...state });
  }

  async getGameSession(gameId: string): Promise<GameSession | null> {
    const s = this.sessions.get(gameId);
    return s ? JSON.parse(JSON.stringify(s)) : null;
  }

  async getEphemeralGameState(gameId: string): Promise<GameState | null> {
    const s = this.states.get(gameId);
    return s ? JSON.parse(JSON.stringify(s)) : null;
  }

  async checkAndClaimActionId(
    actionId: string,
    gameId: string,
    playerId: string,
    timestamp: number
  ): Promise<{ allowed: boolean; existingGameId?: string }> {
    const existing = this.actionClaims.get(actionId);
    if (existing) {
      if (existing.gameId !== gameId) {
        return { allowed: false, existingGameId: existing.gameId };
      }
      return { allowed: true, existingGameId: existing.gameId };
    }
    this.actionClaims.set(actionId, { gameId, playerId, timestamp });
    return { allowed: true };
  }

  async transactEphemeralGameState<TMeta = unknown>(
    gameId: string,
    updateFn: (current: GameState | null) => { nextState?: GameState; abortError?: Error; meta?: TMeta }
  ): Promise<{ committed: boolean; state: GameState | null; meta?: TMeta; abortError?: Error }> {
    const current = this.states.get(gameId) || null;
    const result = updateFn(current ? JSON.parse(JSON.stringify(current)) : null);

    if (result.abortError) {
      return { committed: false, state: current, abortError: result.abortError };
    }

    if (result.nextState) {
      this.states.set(gameId, JSON.parse(JSON.stringify(result.nextState)));
      return { committed: true, state: result.nextState, meta: result.meta };
    }

    return { committed: false, state: current };
  }

  async saveGameSession(session: GameSession): Promise<void> {
    this.sessions.set(session.gameId, { ...session });
  }

  async saveEphemeralGameState(state: GameState): Promise<void> {
    this.states.set(state.gameId, { ...state });
  }

  async saveGameResult(result: unknown): Promise<void> {
    const r = result as { gameId?: string };
    if (r?.gameId) this.results.set(r.gameId, r);
  }

  async getGameResult(resultId: string): Promise<GameResult | null> {
    return (this.results.get(resultId) as GameResult) || null;
  }

  async getActionClaim(): Promise<null> { return null; }
  async getGameAggregate(gameId: string) {
    const session = await this.getGameSession(gameId);
    const state = await this.getEphemeralGameState(gameId);
    return { session: session!, state: state! };
  }
  async clearForTesting(): Promise<void> {
    this.sessions.clear();
    this.states.clear();
    this.results.clear();
  }

  async saveCoupleMemory(): Promise<void> {}
  async getCouple(): Promise<null> { return null; }
  async appendGameNightActivity(): Promise<void> {}
  simulatePersistenceFailure(): void {}
  clearPersistenceFailureSimulation(): void {}
}

describe("Security Audit: Development/Test Bypasses & Authoritative Boundaries", () => {
  let repository: InMemoryAuditGameRepository;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    repository = new InMemoryAuditGameRepository();
    vi.clearAllMocks();
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });

  describe("Requirement 1 & 3: Elimination of isCorrectMock Bypass", () => {
    it("rejects actions containing isCorrectMock in the payload during structural validation", () => {
      const maliciousAction = {
        gameId: GAME_ID,
        clientActionId: "act_audit_mock_1",
        type: "SELECT_CELL",
        payload: {
          cellId: "wrong_cell",
          isCorrectMock: true, // Malicious client attempt to bypass server evaluation
        },
        clientTimestamp: Date.now(),
      };

      const result = validateActionPayloadStructure(maliciousAction);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/isCorrectMock/i);
    });

    it("rejects actions containing isCorrectMock on any action type", () => {
      const types = ["ROLL_DICE", "TRIGGER_TARGET", "SUBMIT_ANSWER", "MOVE", "START_GAME"];
      for (const type of types) {
        const action = {
          gameId: GAME_ID,
          clientActionId: `act_mock_${type}`,
          type,
          payload: { isCorrectMock: true },
          clientTimestamp: Date.now(),
        };

        const result = validateActionPayloadStructure(action);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/isCorrectMock/i);
      }
    });

    it("ensures AuthoritativeGameEngine never awards points or round win based on isCorrectMock", () => {
      const session: GameSession = {
        gameId: GAME_ID,
        coupleId: COUPLE_ID,
        gameType: "find_it_first",
        status: "playing",
        playerIds: [PLAYER_A, PLAYER_B],
        createdBy: PLAYER_A,
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
      };

      const now = Date.now();
      const state: GameState = {
        gameId: GAME_ID,
        gameType: "find_it_first",
        status: "playing",
        currentRound: 1,
        maxRounds: 5,
        version: 1,
        scores: { [PLAYER_A]: 50, [PLAYER_B]: 0 },
        roundStartedAtServer: now,
        roundDeadlineServer: now + 30000,
        serverTimestamp: now,
        data: {
          targetId: "sextant",
          board: ["sextant", "compass", "key", "bell"],
          roundWinnerId: null,
        },
        processedActionIds: {},
        isFinished: false,
      };

      // Attacker selects a WRONG cell ("compass" instead of "sextant") but injects isCorrectMock: true
      const cheatAction: GameAction = {
        gameId: GAME_ID,
        clientActionId: "cheat_wrong_choice",
        type: "SELECT_CELL",
        payload: {
          cellId: "compass", // Incorrect choice!
          isCorrectMock: true, // Backdoor attempt
        },
        clientTimestamp: now,
      };

      const execution = AuthoritativeGameEngine.applyAction(
        session,
        state,
        cheatAction,
        PLAYER_A,
        now + 1000
      );

      // Player A MUST NOT be awarded points or win the round!
      expect(execution.updatedState.scores[PLAYER_A]).toBe(40); // Penalty from 50 -> 40 for incorrect choice
      expect(execution.updatedState.data.roundWinnerId).toBeNull();
      expect(execution.updatedState.status).toBe("playing"); // Round did NOT end
    });

    it("correct choice matches serverTarget legitimately without needing mock flags", () => {
      const session: GameSession = {
        gameId: GAME_ID,
        coupleId: COUPLE_ID,
        gameType: "find_it_first",
        status: "playing",
        playerIds: [PLAYER_A, PLAYER_B],
        createdBy: PLAYER_A,
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
      };

      const now = Date.now();
      const state: GameState = {
        gameId: GAME_ID,
        gameType: "find_it_first",
        status: "playing",
        currentRound: 1,
        maxRounds: 5,
        version: 1,
        scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
        roundStartedAtServer: now,
        roundDeadlineServer: now + 30000,
        serverTimestamp: now,
        data: {
          targetId: "sextant",
          board: ["sextant", "compass", "key", "bell"],
          roundWinnerId: null,
        },
        processedActionIds: {},
        isFinished: false,
      };

      // Legitimate action selects the actual server target
      const legitimateAction: GameAction = {
        gameId: GAME_ID,
        clientActionId: "legit_correct_choice",
        type: "SELECT_CELL",
        payload: { cellId: "sextant" },
        clientTimestamp: now,
      };

      const execution = AuthoritativeGameEngine.applyAction(
        session,
        state,
        legitimateAction,
        PLAYER_A,
        now + 1000
      );

      // Correct selection wins the round and receives server-calculated score
      expect(execution.updatedState.scores[PLAYER_A]).toBeGreaterThanOrEqual(100);
      expect(execution.updatedState.data.roundWinnerId).toBe(PLAYER_A);
      expect(execution.updatedState.status).toBe("round_end");
    });
  });

  describe("Requirement 2 & 5: Production Clients Forbidden from Submitting Authoritative Fields", () => {
    beforeEach(() => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    });

    const forbiddenFieldsList = [
      { name: "score", payload: { score: 99999 } },
      { name: "winner", payload: { winner: PLAYER_A } },
      { name: "winnerId", payload: { winnerId: PLAYER_A } },
      { name: "target", payload: { target: "sextant" } },
      { name: "targetId", payload: { targetId: "sextant" } },
      { name: "correct answer", payload: { correctAnswer: "answer_xyz" } },
      { name: "isCorrect", payload: { isCorrect: true } },
      { name: "dice result", payload: { diceResult: 6 } },
      { name: "diceValue", payload: { diceValue: 6 } },
      { name: "serverDiceValue", payload: { serverDiceValue: 6 } },
      { name: "authoritative timestamp", payload: { authoritativeTimestamp: 1700000000000 } },
      { name: "serverTime", payload: { serverTime: 1700000000000 } },
      { name: "serverTimestamp", payload: { serverTimestamp: 1700000000000 } },
      { name: "player identity", payload: { playerIdentity: "attacker_id" } },
      { name: "game phase", payload: { gamePhase: "results" } },
      { name: "status", payload: { status: "game_end" } },
      { name: "roundStage", payload: { roundStage: "round_result" } },
      { name: "stateVersion", payload: { stateVersion: 99 } },
    ];

    for (const testCase of forbiddenFieldsList) {
      it(`production client cannot submit ${testCase.name} in action payload`, async () => {
        const action: GameAction = {
          gameId: GAME_ID,
          clientActionId: `act_forbidden_${testCase.name.replace(/\s+/g, "_")}`,
          type: "SELECT_CELL",
          payload: { cellId: "compass", ...testCase.payload },
          clientTimestamp: Date.now(),
        };

        const structCheck = validateActionPayloadStructure(action);
        expect(structCheck.valid).toBe(false);
        expect(structCheck.error).toMatch(/authoritative field|testing\/bypass/i);
      });
    }

    it("rejects actions with top-level authoritative tampering fields", () => {
      const tamperedAction = {
        gameId: GAME_ID,
        clientActionId: "tamper_top_level",
        type: "SELECT_CELL",
        payload: { cellId: "compass" },
        clientTimestamp: Date.now(),
        score: 9999, // Injected top-level property
        winner: PLAYER_A, // Injected top-level property
      };

      const structCheck = validateActionPayloadStructure(tamperedAction);
      expect(structCheck.valid).toBe(false);
      expect(structCheck.error).toMatch(/unexpected top-level action field/i);
    });
  });

  describe("Requirement 6: Global Bypass and Testing Flag Rejection", () => {
    const testFlags = ["skipAuth", "skipValidation", "bypass", "mock", "force", "cheat", "isCorrectMock"];

    for (const flag of testFlags) {
      it(`rejects action containing '${flag}' in payload across all environments`, () => {
        (process.env as Record<string, string | undefined>).NODE_ENV = "development";
        const action = {
          gameId: GAME_ID,
          clientActionId: `act_test_flag_${flag}`,
          type: "ROLL_DICE",
          payload: { [flag]: true },
          clientTimestamp: Date.now(),
        };

        const result = validateActionPayloadStructure(action);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/bypass or mock field/i);
      });

      it(`rejects action containing '${flag}' at top-level`, () => {
        (process.env as Record<string, string | undefined>).NODE_ENV = "development";
        const action = {
          gameId: GAME_ID,
          clientActionId: `act_top_${flag}`,
          type: "ROLL_DICE",
          payload: {},
          clientTimestamp: Date.now(),
          [flag]: true,
        };

        const result = validateActionPayloadStructure(action);
        expect(result.valid).toBe(false);
      });
    }
  });

  describe("Requirement 8: Regression Testing Proving Fields Cannot Alter Outcomes", () => {
    it("throws ActionValidationError(INVALID_ACTION) when submitGameAction receives forbidden fields", async () => {
      const session: GameSession = {
        gameId: GAME_ID,
        coupleId: COUPLE_ID,
        gameType: "find_it_first",
        status: "playing",
        playerIds: [PLAYER_A, PLAYER_B],
        createdBy: PLAYER_A,
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
      };

      const now = Date.now();
      const state: GameState = {
        gameId: GAME_ID,
        gameType: "find_it_first",
        status: "playing",
        currentRound: 1,
        maxRounds: 5,
        version: 1,
        scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
        roundStartedAtServer: now,
        roundDeadlineServer: now + 30000,
        serverTimestamp: now,
        data: {
          targetId: "sextant",
          board: ["sextant", "compass"],
        },
        processedActionIds: {},
        isFinished: false,
      };

      repository.seedGame(session, state);

      const maliciousAction: GameAction = {
        gameId: GAME_ID,
        clientActionId: "act_tamper_submit",
        type: "SELECT_CELL",
        payload: {
          cellId: "compass",
          isCorrectMock: true,
          score: 500,
          winner: PLAYER_A,
        },
        clientTimestamp: now,
      };

      await expect(
        submitGameAction(maliciousAction, {
          auth: { uid: PLAYER_A },
          appCheckToken: VALID_APP_CHECK,
          enforceAppCheck: false,
          repository,
        })
      ).rejects.toThrowError(ActionValidationError);

      try {
        await submitGameAction(maliciousAction, {
          auth: { uid: PLAYER_A },
          appCheckToken: VALID_APP_CHECK,
          enforceAppCheck: false,
          repository,
        });
      } catch (err) {
        const error = err as ActionValidationError;
        expect(error.code).toBe("INVALID_ACTION");
      }
    });

    it("speed duel reaction time is strictly computed from server timestamps, ignoring client claims", () => {
      const session: GameSession = {
        gameId: GAME_ID,
        coupleId: COUPLE_ID,
        gameType: "speed_duel",
        status: "playing",
        playerIds: [PLAYER_A, PLAYER_B],
        createdBy: PLAYER_A,
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
      };

      const targetAppearedAt = 1000000;
      const state: GameState = {
        gameId: GAME_ID,
        gameType: "speed_duel",
        status: "playing",
        currentRound: 1,
        maxRounds: 5,
        version: 1,
        scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
        roundStartedAtServer: targetAppearedAt - 2000,
        roundDeadlineServer: targetAppearedAt + 5000,
        serverTimestamp: targetAppearedAt,
        data: {
          roundStage: "active",
          targetAppearedAtServer: targetAppearedAt,
          playerReactions: {},
        },
        processedActionIds: {},
        isFinished: false,
      };

      // Client sends action with fake client claim of 1ms reaction time
      const action: GameAction = {
        gameId: GAME_ID,
        clientActionId: "act_reaction_speed",
        type: "SUBMIT_REACTION",
        payload: {
          clientReactionMs: 1, // Client claims impossible 1ms
        },
        clientTimestamp: targetAppearedAt + 1,
      };

      // Server timestamp is actually targetAppearedAt + 450ms
      const serverArrivalTimestamp = targetAppearedAt + 450;
      const execution = AuthoritativeGameEngine.applyAction(
        session,
        state,
        action,
        PLAYER_A,
        serverArrivalTimestamp
      );

      // Server must record 450ms, NOT client's claimed 1ms!
      expect(execution.updatedState.data.roundWinnerReactionMs).toBe(450);
      const reactions = execution.updatedState.data.playerReactions as Record<string, number>;
      expect(reactions[PLAYER_A]).toBe(450);
    });

    it("couple race dice roll is strictly generated by server, ignoring client rolls", () => {
      const session: GameSession = {
        gameId: GAME_ID,
        coupleId: COUPLE_ID,
        gameType: "couple_race",
        status: "playing",
        playerIds: [PLAYER_A, PLAYER_B],
        createdBy: PLAYER_A,
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
      };

      const now = Date.now();
      const state: GameState = {
        gameId: GAME_ID,
        gameType: "couple_race",
        status: "playing",
        currentRound: 1,
        maxRounds: 3,
        version: 1,
        scores: { [PLAYER_A]: 0, [PLAYER_B]: 0 },
        turnPlayerId: PLAYER_A,
        roundStartedAtServer: now,
        roundDeadlineServer: now + 60000,
        serverTimestamp: now,
        data: {
          boardSize: 24,
          hasRolledThisTurn: false,
          players: {
            [PLAYER_A]: { playerId: PLAYER_A, position: 0, lapsCompleted: 0, powers: [], shieldActive: false, activeEffects: [], totalRolls: 0, connectionStatus: "connected", disconnectedAt: null },
            [PLAYER_B]: { playerId: PLAYER_B, position: 0, lapsCompleted: 0, powers: [], shieldActive: false, activeEffects: [], totalRolls: 0, connectionStatus: "connected", disconnectedAt: null },
          },
        },
        processedActionIds: {},
        isFinished: false,
      };

      const rollAction: GameAction = {
        gameId: GAME_ID,
        clientActionId: "act_roll_client_rigged",
        type: "ROLL_DICE",
        payload: {
          diceValue: 100, // Client tries to roll 100
        },
        clientTimestamp: now,
      };

      const execution = AuthoritativeGameEngine.applyAction(
        session,
        state,
        rollAction,
        PLAYER_A,
        now
      );

      const rolledDice = execution.updatedState.data.currentDiceValue as number;
      expect(rolledDice).toBeGreaterThanOrEqual(1);
      expect(rolledDice).toBeLessThanOrEqual(6);
      expect(rolledDice).not.toBe(100);
    });
  });
});

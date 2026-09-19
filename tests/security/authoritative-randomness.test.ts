import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  AuthoritativeGameEngine,
  DeterministicTestRandomSource,
  withTestRandomSource,
  setTestRandomSource,
  resetTestRandomSource,
  secureRandomInt,
  secureFisherYatesShuffle,
  secureRandomChoice,
} from "@/lib/firebase/server/authoritativeGameEngine";
import { validateActionPayloadStructure } from "@/lib/firebase/server/security";
import type { GameSession, GameState, GameAction } from "@/types/domain";

describe("Authoritative Randomness & CSPRNG Security Audit", () => {
  beforeEach(() => {
    resetTestRandomSource();
  });

  afterEach(() => {
    resetTestRandomSource();
  });

  describe("1. Cryptographically Secure Random Integer Generator (CSPRNG)", () => {
    it("generates dice integers strictly within [1, 6] inclusive across 1000 samples", () => {
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      for (let i = 0; i < 1000; i++) {
        const roll = AuthoritativeGameEngine.serverRollDice(1, 6);
        expect(Number.isInteger(roll)).toBe(true);
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(6);
        counts[roll] = (counts[roll] || 0) + 1;
      }

      // Every face of the die must appear
      for (let face = 1; face <= 6; face++) {
        expect(counts[face]).toBeGreaterThan(80);
      }
    });

    it("handles single-value range [n, n] identically", () => {
      expect(secureRandomInt(5, 5)).toBe(5);
      expect(secureRandomInt(0, 0)).toBe(0);
      expect(secureRandomInt(-3, -3)).toBe(-3);
    });

    it("throws RangeError if min > max", () => {
      expect(() => secureRandomInt(10, 5)).toThrow(RangeError);
    });

    it("throws TypeError if inputs are not finite numbers", () => {
      expect(() => secureRandomInt(NaN, 5)).toThrow(TypeError);
      expect(() => secureRandomInt(1, Infinity)).toThrow(TypeError);
    });
  });

  describe("2. Cryptographically Driven Fisher-Yates Shuffle", () => {
    it("preserves all elements and multiset integrity without duplicates", () => {
      const original = ["ruby", "sapphire", "emerald", "topaz", "amethyst", "opal", "diamond"];
      const shuffled = secureFisherYatesShuffle(original);

      expect(shuffled.length).toBe(original.length);
      expect(new Set(shuffled).size).toBe(original.length);
      expect(shuffled.sort()).toEqual([...original].sort());
    });

    it("handles empty and single-element arrays gracefully", () => {
      expect(secureFisherYatesShuffle([])).toEqual([]);
      expect(secureFisherYatesShuffle(["solo"])).toEqual(["solo"]);
    });

    it("produces multiple distinct permutations over repeated runs", () => {
      const original = [1, 2, 3, 4, 5, 6, 7, 8];
      const permutations = new Set<string>();

      for (let i = 0; i < 50; i++) {
        const shuffled = secureFisherYatesShuffle(original);
        permutations.add(shuffled.join(","));
      }

      // With 8 items (40,320 permutations), 50 shuffles should produce at least 45 distinct orders
      expect(permutations.size).toBeGreaterThanOrEqual(45);
    });
  });

  describe("3. Authoritative Target Placement & Board Generation (Find It First)", () => {
    it("generates an authoritative round with target and 12-item shuffled board", () => {
      const round = AuthoritativeGameEngine.generateAuthoritativeRound(1, []);

      expect(round.targetId).toBeDefined();
      expect(round.target).toBeDefined();
      expect(round.target.id).toBe(round.targetId);
      expect(round.board.length).toBe(12);
      expect(round.board).toContain(round.targetId);

      // Verify all items on board are unique
      const uniqueItems = new Set(round.board);
      expect(uniqueItems.size).toBe(12);
    });

    it("avoids previous targets when selecting new target if available", () => {
      const round1 = AuthoritativeGameEngine.generateAuthoritativeRound(1, []);
      const round2 = AuthoritativeGameEngine.generateAuthoritativeRound(2, [round1.targetId]);

      expect(round2.targetId).not.toBe(round1.targetId);
    });
  });

  describe("4. Authoritative Random Countdown & Tension Delays (Speed Duel)", () => {
    it("generates authoritative tension delays between 1800ms and 4199ms", () => {
      const session: GameSession = {
        gameId: "game_sd_1",
        coupleId: "c_1",
        gameType: "speed_duel",
        status: "waiting",
        playerIds: ["p_1", "p_2"],
        createdBy: "p_1",
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
      };

      const now = 1700000000000;
      const initialWaitingState: GameState = {
        gameId: "game_sd_1",
        gameType: "speed_duel",
        status: "waiting",
        currentRound: 0,
        maxRounds: 5,
        version: 1,
        scores: { p_1: 0, p_2: 0 },
        turnPlayerId: "p_1",
        roundStartedAtServer: now,
        roundDeadlineServer: now + 30000,
        serverTimestamp: now,
        isFinished: false,
        winnerId: null,
        processedActionIds: {},
        data: {},
      };

      const action: GameAction = {
        clientActionId: "act_start",
        gameId: "game_sd_1",
        type: "START_GAME",
        payload: {},
        clientTimestamp: now,
      };

      const { updatedState } = AuthoritativeGameEngine.applyAction(
        session,
        initialWaitingState,
        action,
        "p_1",
        now
      );

      expect(updatedState.data.roundStage).toBe("tension");
      const targetAppearedAt = updatedState.data.targetAppearedAtServer as number;
      const delay = targetAppearedAt - now;

      expect(delay).toBeGreaterThanOrEqual(1800);
      expect(delay).toBeLessThanOrEqual(4199);
    });
  });

  describe("5. Client Cannot Determine Dice, Targets, Winners, or Countdowns", () => {
    it("rejects client attempts to submit random test injection flags across all environments", () => {
      const forbiddenInjectionFlags = [
        "randomSeed",
        "mockRandom",
        "testRandom",
        "injectedRandom",
        "testSeed",
        "deterministicSeed",
        "isCorrectMock",
        "cheat",
      ];

      for (const flag of forbiddenInjectionFlags) {
        const action: GameAction = {
          clientActionId: `act_${flag}`,
          gameId: "game_1",
          type: "ROLL_DICE",
          payload: { [flag]: 12345 },
          clientTimestamp: Date.now(),
        };

        const result = validateActionPayloadStructure(action);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/Authoritative outcomes are strictly server-determined|Testing\/bypass field/i);
      }
    });

    it("rejects authoritative fields in production environments", () => {
      const origEnv = process.env.NODE_ENV;
      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";

        const productionForbiddenFields = [
          "diceResult",
          "diceValue",
          "serverDiceValue",
          "target",
          "targetId",
          "targetPlacement",
          "board",
          "tensionDelayMs",
          "randomCountdown",
          "winner",
          "winnerId",
          "score",
        ];

        for (const field of productionForbiddenFields) {
          const action: GameAction = {
            clientActionId: `act_prod_${field}`,
            gameId: "game_1",
            type: "ROLL_DICE",
            payload: { [field]: 6 },
            clientTimestamp: Date.now(),
          };

          const result = validateActionPayloadStructure(action);
          expect(result.valid).toBe(false);
          expect(result.error).toMatch(/Production client cannot submit authoritative field/i);
        }
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
      }
    });

    it("ignores any client-provided dice in Couple Race and rolls authoritatively", () => {
      const session: GameSession = {
        gameId: "game_cr_1",
        coupleId: "c_1",
        gameType: "couple_race",
        status: "playing",
        playerIds: ["alex", "sam"],
        createdBy: "alex",
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
      };

      const now = 1700000000000;
      const state: GameState = {
        gameId: "game_cr_1",
        gameType: "couple_race",
        status: "playing",
        currentRound: 1,
        maxRounds: 1,
        version: 1,
        scores: { alex: 0, sam: 0 },
        turnPlayerId: "alex",
        roundStartedAtServer: now,
        roundDeadlineServer: now + 30000,
        serverTimestamp: now,
        isFinished: false,
        winnerId: null,
        processedActionIds: {},
        data: {
          boardSize: 24,
          players: {
            alex: { playerId: "alex", position: 0, lapsCompleted: 0, powers: [], shieldActive: false, activeEffects: [], totalRolls: 0, connectionStatus: "connected", disconnectedAt: null },
            sam: { playerId: "sam", position: 0, lapsCompleted: 0, powers: [], shieldActive: false, activeEffects: [], totalRolls: 0, connectionStatus: "connected", disconnectedAt: null },
          },
          hasRolledThisTurn: false,
        },
      };

      // Client payload attempts to forge a dice value of 99
      const action: GameAction = {
        clientActionId: "act_roll_client_attempt",
        gameId: "game_cr_1",
        type: "ROLL_DICE",
        payload: { clientDice: 99 },
        clientTimestamp: now,
      };

      const { updatedState } = AuthoritativeGameEngine.applyAction(session, state, action, "alex", now);

      expect(updatedState.data.hasRolledThisTurn).toBe(true);
      const rolledValue = updatedState.data.currentDiceValue as number;
      // Authoritative dice must be strictly 1..6, never 99
      expect(rolledValue).toBeGreaterThanOrEqual(1);
      expect(rolledValue).toBeLessThanOrEqual(6);
      expect(rolledValue).not.toBe(99);
    });
  });

  describe("6. Deterministic Test Injection Through Server Test Infrastructure", () => {
    it("allows deterministic dice sequence injection via DeterministicTestRandomSource", () => {
      const testSource = new DeterministicTestRandomSource({
        diceSequence: [4, 2, 6],
      });

      setTestRandomSource(testSource);

      expect(AuthoritativeGameEngine.serverRollDice()).toBe(4);
      expect(AuthoritativeGameEngine.serverRollDice()).toBe(2);
      expect(AuthoritativeGameEngine.serverRollDice()).toBe(6);
      // Loops back
      expect(AuthoritativeGameEngine.serverRollDice()).toBe(4);
    });

    it("withTestRandomSource isolates deterministic randomness to callback", async () => {
      const testSource = new DeterministicTestRandomSource({
        diceSequence: [5, 5, 5],
      });

      const insideRoll = await withTestRandomSource(testSource, async () => {
        return AuthoritativeGameEngine.serverRollDice();
      });

      expect(insideRoll).toBe(5);

      // Outside the scope, default CSPRNG is restored
      expect(AuthoritativeGameEngine.getTestRandomSource()).toBeNull();
    });

    it("strictly forbids test random source injection in production", () => {
      const origEnv = process.env.NODE_ENV;
      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";

        const testSource = new DeterministicTestRandomSource({ diceSequence: [6] });
        expect(() => setTestRandomSource(testSource)).toThrow(
          /Test random source injection is strictly forbidden in production/i
        );
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
        resetTestRandomSource();
      }
    });
  });
});

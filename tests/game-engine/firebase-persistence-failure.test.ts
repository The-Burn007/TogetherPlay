import { describe, it, expect, beforeEach, vi } from "vitest";
import { ServerGameRepository, PersistenceError, logStructuredError } from "@/lib/firebase/server/gameRepository";
import { submitGameAction } from "@/lib/firebase/server/submitGameAction";
import type { GameSession, GameState, GameAction } from "@/types/domain";
import { POST as handleGameActionPost } from "@/app/api/games/action/route";
import { POST as handleGameSessionPost } from "@/app/api/games/session/route";
import { NextRequest } from "next/server";

// Mock Firebase Admin SDK for tests
vi.mock("@/lib/firebase/server/admin", () => {
  const mockDoc = {
    get: vi.fn(async () => {
      throw new Error("Firestore network disconnect (UNAVAILABLE)");
    }),
    set: vi.fn(async () => {
      throw new Error("Firestore write failed (UNAVAILABLE)");
    }),
  };

  const mockFirestore = {
    collection: vi.fn(() => ({
      doc: vi.fn(() => mockDoc),
      where: vi.fn(() => ({
        limit: vi.fn(() => ({
          get: vi.fn(async () => {
            throw new Error("Firestore query failed (UNAVAILABLE)");
          }),
        })),
      })),
    })),
  };

  const mockDatabase = {
    ref: vi.fn(() => ({
      get: vi.fn(async () => {
        throw new Error("RTDB socket hangup (DISCONNECTED)");
      }),
      set: vi.fn(async () => {
        throw new Error("RTDB write rejected (DISCONNECTED)");
      }),
      transaction: vi.fn(async () => {
        throw new Error("RTDB transaction timeout (DISCONNECTED)");
      }),
    })),
  };

  return {
    getAdminAuth: vi.fn(() => ({
      verifyIdToken: vi.fn(async (token: string) => {
        if (token && (token.startsWith("valid_token_") || token === "valid_id_token")) {
          const uid = token.startsWith("valid_token_") ? token.replace("valid_token_", "") : "user_pers_alex";
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
    getAdminFirestore: vi.fn(() => mockFirestore),
    getAdminDatabase: vi.fn(() => mockDatabase),
    getAdminApp: vi.fn(() => ({})),
    isAdminFirebaseConfigured: vi.fn(() => true),
  };
});

describe("Firebase Persistence Failure & Anti-Fallback Hardening", () => {
  let repository: ServerGameRepository;
  const GAME_ID = "fif_persistence_test";
  const PLAYER_A = "user_pers_alex";
  const PLAYER_B = "user_pers_sam";
  const COUPLE_ID = "couple_london_paris";

  const createBaseSession = (): GameSession => ({
    gameId: GAME_ID,
    coupleId: COUPLE_ID,
    gameType: "find_it_first",
    status: "playing",
    playerIds: [PLAYER_A, PLAYER_B],
    createdBy: PLAYER_A,
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  const createBaseState = (): GameState => ({
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
      targetId: "watch",
      targetName: "Vintage Pocket Watch",
      board: ["watch", "compass", "key", "seal", "pen", "hourglass", "prism", "book", "camera", "bell", "monocle", "mug"],
      roundStage: "active",
      usedTargetIds: ["watch"],
    },
    processedActionIds: {},
    isFinished: false,
    winnerId: null,
  });

  beforeEach(() => {
    repository = new ServerGameRepository();
    repository.clearForTesting();
    repository.seedGame(createBaseSession(), createBaseState());
  });

  it("Requirement 1 & 2: saveGameSession failure is not swallowed and rejects game action execution", async () => {
    // Simulate Firestore failure on session save
    repository.simulatePersistenceFailure({
      failSaveGameSession: new Error("Firestore unavailable: 503 UNAVAILABLE"),
    });

    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: `act_test_save_fail_${Date.now()}`,
      playerId: PLAYER_A,
      type: "SELECT_CELL",
      payload: { cellId: "watch" },
      clientTimestamp: Date.now(),
    };

    let errorThrown: unknown = null;
    let result: unknown = null;

    try {
      result = await submitGameAction(action, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
        requestId: "req_test_save_session_fail",
      });
    } catch (err) {
      errorThrown = err;
    }

    // Must NOT return a successful result
    expect(result).toBeNull();
    // Must throw a PersistenceError
    expect(errorThrown).toBeInstanceOf(PersistenceError);
    expect((errorThrown as PersistenceError).code).toBe("PERSISTENCE_ERROR");
    expect((errorThrown as PersistenceError).operation).toBe("saveGameSession");
    expect((errorThrown as PersistenceError).gameId).toBe(GAME_ID);
  });

  it("Requirement 3 & 4: Authoritative mutation must fail if ephemeral state transaction fails", async () => {
    // Simulate RTDB transaction commit failure
    repository.simulatePersistenceFailure({
      failTransactEphemeralGameState: new Error("RTDB transaction timeout: DEADLINE_EXCEEDED"),
    });

    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: `act_tx_fail_${Date.now()}`,
      playerId: PLAYER_A,
      type: "SELECT_CELL",
      payload: { cellId: "watch" },
      clientTimestamp: Date.now(),
    };

    let caughtError: unknown = null;
    let actionResult: unknown = null;

    try {
      actionResult = await submitGameAction(action, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
        requestId: "req_test_tx_fail",
      });
    } catch (err) {
      caughtError = err;
    }

    expect(actionResult).toBeNull();
    expect(caughtError).toBeInstanceOf(PersistenceError);
    expect((caughtError as PersistenceError).code).toBe("PERSISTENCE_ERROR");
    expect((caughtError as PersistenceError).operation).toBe("transactEphemeralGameState");
  });

  it("Requirement 3 & 4: Action ID claim failure in persistent store blocks action execution", async () => {
    // Simulate RTDB action claim failure
    repository.simulatePersistenceFailure({
      failCheckAndClaimActionId: new Error("RTDB actionClaims write failed: PERMISSION_DENIED"),
    });

    const action: GameAction = {
      gameId: GAME_ID,
      clientActionId: `act_claim_fail_${Date.now()}`,
      playerId: PLAYER_A,
      type: "SELECT_CELL",
      payload: { cellId: "watch" },
      clientTimestamp: Date.now(),
    };

    await expect(
      submitGameAction(action, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
        requestId: "req_test_claim_fail",
      })
    ).rejects.toThrow(PersistenceError);
  });

  it("Requirement 5 & 6: Live backend mode rejects process-memory as authoritative fallback", async () => {
    // Create repository in explicit live backend mode
    const liveRepo = new ServerGameRepository({ useLiveBackend: true });
    expect(liveRepo.isLive()).toBe(true);

    // Any attempt to read or write without live Firebase backend must fail with PersistenceError
    // and NEVER silently fall back to in-memory maps
    await expect(liveRepo.saveGameSession(createBaseSession())).rejects.toThrow(PersistenceError);
    await expect(liveRepo.saveEphemeralGameState(createBaseState())).rejects.toThrow(PersistenceError);
    await expect(liveRepo.getGameSession("non_existent")).rejects.toThrow(PersistenceError);
    await expect(liveRepo.getEphemeralGameState("non_existent")).rejects.toThrow(PersistenceError);
  });

  it("Requirement 7: /api/games/action returns HTTP 500 PERSISTENCE_ERROR when persistence fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Create a mock request to the action route with an auth header
    const actionBody = {
      gameId: GAME_ID,
      clientActionId: `act_api_fail_${Date.now()}`,
      type: "SELECT_CELL",
      payload: { cellId: "watch" },
      clientTimestamp: Date.now(),
    };

    // We simulate persistence error on the global singleton for this test
    const { serverGameRepository } = await import("@/lib/firebase/server/gameRepository");
    serverGameRepository.seedGame(createBaseSession(), createBaseState());
    serverGameRepository.simulatePersistenceFailure({
      failTransactEphemeralGameState: new Error("Simulated RTDB transaction error"),
    });

    try {
      const req = new NextRequest("http://localhost:3000/api/games/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer valid_token_user_pers_alex",
          "x-request-id": "req_api_persistence_fail",
        },
        body: JSON.stringify(actionBody),
      });

      const response = await handleGameActionPost(req);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.accepted).toBe(false);
      expect(json.error.code).toBe("PERSISTENCE_ERROR");
      expect(json.error.message).toContain("Authoritative persistent write failed");
    } finally {
      serverGameRepository.clearPersistenceFailureSimulation();
      consoleErrorSpy.mockRestore();
    }
  });

  it("Requirement 7: /api/games/session returns HTTP 500 PERSISTENCE_ERROR on save failure", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { serverGameRepository } = await import("@/lib/firebase/server/gameRepository");
    serverGameRepository.simulatePersistenceFailure({
      failSaveGameSession: new Error("Simulated Firestore save failure"),
    });

    try {
      const req = new NextRequest("http://localhost:3000/api/games/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer valid_token_user_pers_alex",
          "x-request-id": "req_session_persist_fail",
        },
        body: JSON.stringify({
          gameId: "fif_fail_session_test",
          playerIds: [PLAYER_A, PLAYER_B],
        }),
      });

      const response = await handleGameSessionPost(req);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error.code).toBe("PERSISTENCE_ERROR");
      expect(json.error.message).toContain("Failed to persist game session");
    } finally {
      serverGameRepository.clearPersistenceFailureSimulation();
      consoleErrorSpy.mockRestore();
    }
  });

  it("Requirement 8: Structured logging captures request ID, game ID, action ID, error category with no secrets", () => {
    const logs: string[] = [];
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });

    try {
      logStructuredError({
        requestId: "req_audit_12345",
        gameId: "game_audit_67890",
        actionId: "act_audit_abcde",
        errorCategory: "PERSISTENCE_FAILURE",
        message: "Simulated persistence failure during transaction",
        details: {
          authToken: "SUPER_SECRET_BEARER_TOKEN_12345",
          password: "my_secret_password",
          apiKey: "AIzaSy_FAKE_SECRET_KEY",
          normalField: "safe_value",
        },
      });

      expect(logs.length).toBeGreaterThan(0);
      const logLine = logs[0];
      expect(logLine).toContain("[STRUCTURED_ERROR]");

      const parsed = JSON.parse(logLine.replace("[STRUCTURED_ERROR] ", ""));
      expect(parsed.requestId).toBe("req_audit_12345");
      expect(parsed.gameId).toBe("game_audit_67890");
      expect(parsed.actionId).toBe("act_audit_abcde");
      expect(parsed.errorCategory).toBe("PERSISTENCE_FAILURE");

      // Secrets must be redacted
      expect(parsed.details.authToken).toBe("[REDACTED]");
      expect(parsed.details.password).toBe("[REDACTED]");
      expect(parsed.details.apiKey).toBe("[REDACTED]");
      expect(parsed.details.normalField).toBe("safe_value");

      // Ensure raw secrets never appear in the log string
      expect(logLine).not.toContain("SUPER_SECRET_BEARER_TOKEN_12345");
      expect(logLine).not.toContain("my_secret_password");
      expect(logLine).not.toContain("AIzaSy_FAKE_SECRET_KEY");
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("Requirement 10: Failed persistence operation CANNOT produce false success response", async () => {
    // When game results fail to save on game conclusion:
    repository.simulatePersistenceFailure({
      failSaveGameResult: new Error("Firestore quota exceeded"),
    });

    // Fast-forward state to round 5 where next point wins the game
    const nearEndState: GameState = {
      ...createBaseState(),
      currentRound: 5,
      maxRounds: 5,
      scores: { [PLAYER_A]: 4, [PLAYER_B]: 0 },
      data: {
        targetId: "watch",
        targetName: "Vintage Pocket Watch",
        board: ["watch", "compass", "key", "seal", "pen", "hourglass", "prism", "book", "camera", "bell", "monocle", "mug"],
        roundStage: "active",
        usedTargetIds: ["watch"],
      },
    };
    repository.seedGame(createBaseSession(), nearEndState);

    const winningAction: GameAction = {
      gameId: GAME_ID,
      clientActionId: `act_win_${Date.now()}`,
      playerId: PLAYER_A,
      type: "SELECT_CELL",
      payload: { cellId: "watch" },
      clientTimestamp: Date.now(),
    };

    let result: unknown = null;
    let thrown: unknown = null;

    try {
      result = await submitGameAction(winningAction, {
        auth: { uid: PLAYER_A },
        repository,
        enforceAppCheck: false,
        requestId: "req_test_no_false_success",
      });
    } catch (err) {
      thrown = err;
    }

    // Must never return success
    expect(result).toBeNull();
    // Must have thrown PersistenceError
    expect(thrown).toBeInstanceOf(PersistenceError);
    expect((thrown as PersistenceError).operation).toBe("saveGameResult");
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ServerGameRepository, IsolatedTestGameStore } from "@/lib/firebase/server/gameRepository";
import { submitGameAction } from "@/lib/firebase/server/submitGameAction";
import type { GameSession, GameState, GameAction } from "@/types/domain";

// Shared simulated Firebase Cloud Storage representing remote cloud authority
// (Firestore and Realtime Database)
const cloudFirestore = new Map<string, any>();
const cloudRtdb = new Map<string, any>();

vi.mock("@/lib/firebase/server/admin", () => {
  return {
    isAdminFirebaseConfigured: vi.fn(() => true),
    getAdminFirestore: vi.fn(() => ({
      collection: (collectionName: string) => ({
        doc: (docId: string) => ({
          get: vi.fn(async () => {
            const key = `${collectionName}/${docId}`;
            const data = cloudFirestore.get(key);
            return {
              exists: !!data,
              data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
            };
          }),
          set: vi.fn(async (data: any, options?: { merge?: boolean }) => {
            const key = `${collectionName}/${docId}`;
            if (options?.merge && cloudFirestore.has(key)) {
              const prev = cloudFirestore.get(key);
              cloudFirestore.set(key, JSON.parse(JSON.stringify({ ...prev, ...data })));
            } else {
              cloudFirestore.set(key, JSON.parse(JSON.stringify(data)));
            }
          }),
        }),
        where: (field: string, op: string, value: any) => ({
          limit: () => ({
            get: vi.fn(async () => {
              const matches: any[] = [];
              for (const [k, v] of cloudFirestore.entries()) {
                if (k.startsWith(`${collectionName}/`) && v[field] === value) {
                  matches.push({ data: () => JSON.parse(JSON.stringify(v)) });
                  break;
                }
              }
              return {
                empty: matches.length === 0,
                docs: matches,
              };
            }),
          }),
        }),
      }),
    })),
    getAdminDatabase: vi.fn(() => ({
      ref: (path: string) => ({
        get: vi.fn(async () => {
          const val = cloudRtdb.get(path);
          return {
            exists: () => val !== undefined,
            val: () => (val !== undefined ? JSON.parse(JSON.stringify(val)) : null),
          };
        }),
        set: vi.fn(async (val: any) => {
          cloudRtdb.set(path, JSON.parse(JSON.stringify(val)));
        }),
        transaction: vi.fn(async (updateFn: (current: any) => any) => {
          const current = cloudRtdb.get(path);
          const currentCloned = current !== undefined ? JSON.parse(JSON.stringify(current)) : null;
          const nextVal = updateFn(currentCloned);

          if (nextVal === undefined) {
            return { committed: false, snapshot: null };
          }

          cloudRtdb.set(path, JSON.parse(JSON.stringify(nextVal)));
          return {
            committed: true,
            snapshot: {
              val: () => JSON.parse(JSON.stringify(nextVal)),
            },
          };
        }),
      }),
    })),
  };
});

describe("Multi-Instance Authoritative State & Process Memory Isolation", () => {
  let instanceA: ServerGameRepository;
  let instanceB: ServerGameRepository;

  const GAME_ID = "game_multi_instance_456";
  const PLAYER_A = "player_tokyo";
  const PLAYER_B = "player_london";

  function createBaseSession(): GameSession {
    return {
      gameId: GAME_ID,
      roomCode: "M789",
      gameType: "find_it_first",
      status: "playing",
      playerIds: [PLAYER_A, PLAYER_B],
      createdBy: PLAYER_A,
      createdAt: new Date().toISOString(),
      updatedAt: Date.now(),
    } as any;
  }

  function createBaseState(): GameState {
    return {
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
    } as any;
  }

  beforeEach(() => {
    cloudFirestore.clear();
    cloudRtdb.clear();

    // Spawn two distinct server instances with live Firebase backend enabled
    instanceA = new ServerGameRepository({ useLiveBackend: true });
    instanceB = new ServerGameRepository({ useLiveBackend: true });
  });

  it("Requirement 1, 2, 3: Confirms instances have zero process-local authority in production", () => {
    expect(instanceA.hasProcessLocalAuthority()).toBe(false);
    expect(instanceB.hasProcessLocalAuthority()).toBe(false);

    const classA = instanceA.getStorageClassification();
    const classB = instanceB.getStorageClassification();

    expect(classA.authority).toBe("FIREBASE_FIRESTORE_AND_RTDB");
    expect(classA.hasProcessLocalAuthority).toBe(false);
    expect(classB.authority).toBe("FIREBASE_FIRESTORE_AND_RTDB");
    expect(classB.hasProcessLocalAuthority).toBe(false);

    // Isolated test store is strictly undefined in live instances
    expect(instanceA.getIsolatedTestStore()).toBeUndefined();
    expect(instanceB.getIsolatedTestStore()).toBeUndefined();
  });

  it("Requirement 4 & 5: A write on Instance A is immediately observable by Instance B", async () => {
    const session = createBaseSession();
    const state = createBaseState();

    // Instance A commits session to Firestore and state to RTDB
    await instanceA.saveGameSession(session);
    await instanceA.saveEphemeralGameState(state);

    // Instance B reads from the authoritative backend
    const sessionOnB = await instanceB.getGameSession(GAME_ID);
    const stateOnB = await instanceB.getEphemeralGameState(GAME_ID);

    expect(sessionOnB).not.toBeNull();
    expect(sessionOnB?.gameId).toBe(GAME_ID);
    expect(sessionOnB?.gameType).toBe("find_it_first");

    expect(stateOnB).not.toBeNull();
    expect(stateOnB?.gameId).toBe(GAME_ID);
    expect(stateOnB?.version).toBe(1);
    expect(stateOnB?.scores[PLAYER_A]).toBe(0);
  });

  it("Requirement 5: Routed requests A -> B -> A observe continuous, uninterrupted authoritative state", async () => {
    // Initial setup: saved via Instance A
    await instanceA.saveGameSession(createBaseSession());
    await instanceA.saveEphemeralGameState(createBaseState());

    // Step 1: Request routed to Instance A: Player B makes incorrect guess "compass" (-10 penalty)
    const actionB: GameAction = {
      clientActionId: "act_multi_inst_1",
      gameId: GAME_ID,
      playerId: PLAYER_B,
      type: "SELECT_CELL",
      payload: { cellId: "compass" },
      clientTimestamp: Date.now(),
    };

    const outcomeB = await submitGameAction(actionB, {
      repository: instanceA,
      auth: { uid: PLAYER_B },
    });
    expect(outcomeB.accepted).toBe(true);
    expect(outcomeB.gameState.version).toBe(2);
    expect(outcomeB.gameState.scores[PLAYER_B]).toBe(0);
    expect(outcomeB.gameState.status).toBe("playing");

    // Step 2: Next request routed to Instance B: Player A finds the correct item "watch" (+250 points)
    // Instance B must see version 2 without ever having processed action 1 in local memory
    const actionA: GameAction = {
      clientActionId: "act_multi_inst_2",
      gameId: GAME_ID,
      playerId: PLAYER_A,
      type: "SELECT_CELL",
      payload: { cellId: "watch" },
      clientTimestamp: Date.now(),
    };

    const outcomeA = await submitGameAction(actionA, {
      repository: instanceB,
      auth: { uid: PLAYER_A },
    });
    expect(outcomeA.accepted).toBe(true);
    // Version incremented again
    expect(outcomeA.gameState.version).toBe(3);
    expect(outcomeA.gameState.scores[PLAYER_A]).toBeGreaterThan(200);
    expect(outcomeA.gameState.scores[PLAYER_B]).toBe(0);
    expect(outcomeA.gameState.status).toBe("round_end");

    // Step 3: Next request routed back to Instance A: Instance A reads state from Firebase
    const aggregateOnA = await instanceA.getGameAggregate(GAME_ID);
    expect(aggregateOnA).not.toBeNull();
    expect(aggregateOnA?.state.version).toBe(3);
    expect(aggregateOnA?.state.scores[PLAYER_A]).toBeGreaterThan(200);
    expect(aggregateOnA?.state.scores[PLAYER_B]).toBe(0);
    // Both actions must be recorded in the processed action map
    expect(aggregateOnA?.state.processedActionIds["act_multi_inst_1"]).toBeDefined();
    expect(aggregateOnA?.state.processedActionIds["act_multi_inst_2"]).toBeDefined();
  });

  it("Requirement 5 & 6: Action ID claim on Instance A blocks replay on Instance B", async () => {
    const actionId = "act_claim_distributed_999";

    // Claim on Instance A
    const claimA = await instanceA.checkAndClaimActionId(actionId, GAME_ID, PLAYER_A);
    expect(claimA.allowed).toBe(true);

    // Instance B attempts to claim the exact same action for a DIFFERENT game
    const claimBConflict = await instanceB.checkAndClaimActionId(
      actionId,
      "different_game_id_888",
      PLAYER_B
    );
    expect(claimBConflict.allowed).toBe(false);
    expect(claimBConflict.existingGameId).toBe(GAME_ID);

    // Instance B inspects the claim
    const claimDataOnB = await instanceB.getActionClaim(actionId);
    expect(claimDataOnB).not.toBeNull();
    expect(claimDataOnB?.gameId).toBe(GAME_ID);
    expect(claimDataOnB?.playerId).toBe(PLAYER_A);
  });

  it("Requirement 3, 5, 10: Server crash / process death does not cause state loss", async () => {
    // Instance A processes game creation and state
    await instanceA.saveGameSession(createBaseSession());
    await instanceA.saveEphemeralGameState(createBaseState());

    // Execute action on Instance A
    const action: GameAction = {
      clientActionId: "act_before_crash_1",
      gameId: GAME_ID,
      playerId: PLAYER_A,
      type: "SELECT_CELL",
      payload: { cellId: "watch" },
      clientTimestamp: Date.now(),
    };
    await submitGameAction(action, {
      repository: instanceA,
      auth: { uid: PLAYER_A },
    });

    // Simulate complete process death of Instance A: dereference and discard
    (instanceA as any) = null;

    // Fresh Server Instance C boots up in a completely new container
    const instanceC = new ServerGameRepository({ useLiveBackend: true });

    // Instance C reads game state and verifies zero data loss
    const stateOnC = await instanceC.getEphemeralGameState(GAME_ID);
    expect(stateOnC).not.toBeNull();
    expect(stateOnC?.version).toBe(2);
    expect(stateOnC?.scores[PLAYER_A]).toBeGreaterThan(200);
    expect(stateOnC?.processedActionIds["act_before_crash_1"]).toBeDefined();
  });

  it("IsolatedTestGameStore satisfies strict test isolation when explicitly requested", async () => {
    const testStore = new IsolatedTestGameStore();
    const testRepo1 = new ServerGameRepository({ useLiveBackend: false, testStore });
    const testRepo2 = new ServerGameRepository({ useLiveBackend: false, testStore });

    expect(testRepo1.hasProcessLocalAuthority()).toBe(true);
    const session = createBaseSession();
    testRepo1.seedGame(session);

    // Both test repos share the isolated test fixture store
    await expect(testRepo2.getGameSession(GAME_ID)).resolves.toEqual(session);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServerGameRepository } from "@/lib/firebase/server/gameRepository";
import { submitGameAction } from "@/lib/firebase/server/submitGameAction";
import { sha256 } from "@/lib/utils/crypto";
import type { GameSession, GameState, GameAction, Couple } from "@/types/domain";
import type { CoupleMemory } from "@/lib/memories/types";

// Mock Firebase client
vi.mock("@/lib/firebase/client", () => ({
  db: {},
  rtdb: {},
  auth: { currentUser: { uid: "usr_integration_alex" } },
}));

describe("Integration Layer: End-to-End Multi-Service Integration", () => {
  let repository: ServerGameRepository;
  const USER_A = "usr_integration_alex";
  const USER_B = "usr_integration_sam";
  const COUPLE_ID = "cpl_integration_together";
  const GAME_ID = "gm_integration_fif";

  let coupleStore: Map<string, Couple>;
  let memoriesStore: Map<string, CoupleMemory[]>;

  beforeEach(() => {
    repository = new ServerGameRepository();
    coupleStore = new Map();
    memoriesStore = new Map();

    // Seed Couple
    coupleStore.set(COUPLE_ID, {
      coupleId: COUPLE_ID,
      ownerId: USER_A,
      memberIds: [USER_A, USER_B],
      status: "active",
      createdAt: new Date().toISOString(),
    });
  });

  it("coordinates couple verification, game session creation, authoritative gameplay, and victory memory capture", async () => {
    // 1. Verify couple relationship
    const couple = coupleStore.get(COUPLE_ID);
    expect(couple).toBeDefined();
    expect(couple?.memberIds).toContain(USER_A);
    expect(couple?.memberIds).toContain(USER_B);

    // 2. Initialize Game Session
    const session: GameSession = {
      gameId: GAME_ID,
      coupleId: COUPLE_ID,
      gameType: "find_it_first",
      status: "playing",
      playerIds: [USER_A, USER_B],
      readyPlayerIds: [USER_A, USER_B],
      createdBy: USER_A,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    const state: GameState = {
      gameId: GAME_ID,
      gameType: "find_it_first",
      status: "playing",
      currentRound: 1,
      maxRounds: 1, // Single round match
      version: 1,
      scores: { [USER_A]: 0, [USER_B]: 0 },
      roundStartedAtServer: Date.now(),
      roundDeadlineServer: Date.now() + 20000,
      serverTimestamp: Date.now(),
      processedActionIds: {},
      isFinished: false,
      data: {
        targetId: "watch",
        board: ["watch", "compass", "key", "seal", "pen", "hourglass", "prism", "book", "camera", "bell", "monocle", "mug"],
        roundAnswers: {},
      },
    };

    repository.seedGame(session, state);

    // 3. User B finds the target first
    const actionB: GameAction = {
      gameId: GAME_ID,
      clientActionId: "act_b_wins_fif",
      type: "SELECT_CELL",
      payload: { cellId: "watch" },
      clientTimestamp: Date.now(),
    };

    const playResult = await submitGameAction(actionB, {
      auth: { uid: USER_B },
      repository,
      enforceAppCheck: false,
    });

    expect(playResult.accepted).toBe(true);
    expect(playResult.gameState.scores[USER_B]).toBeGreaterThan(0);
    expect(playResult.gameState.isFinished).toBe(true);
    expect(playResult.gameState.winnerId).toBe(USER_B);

    // 4. Automatic Memory Snapshot of Victory
    const victoryMemory: CoupleMemory = {
      id: `mem_victory_${Date.now()}`,
      coupleId: COUPLE_ID,
      type: "game_moment",
      title: "Find It First Championship",
      date: "2026-09-16",
      dateLabel: "Today",
      context: "Sam spotted the pocket watch in record time!",
      createdBy: USER_B,
      authorName: "Sam",
      createdAt: new Date().toISOString(),
    };

    const currentMemories = memoriesStore.get(COUPLE_ID) || [];
    currentMemories.push(victoryMemory);
    memoriesStore.set(COUPLE_ID, currentMemories);

    const savedMemories = memoriesStore.get(COUPLE_ID);
    expect(savedMemories).toHaveLength(1);
    expect(savedMemories![0].title).toBe("Find It First Championship");
    expect(savedMemories![0].createdBy).toBe(USER_B);
  });
});

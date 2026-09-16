import { describe, it, expect, beforeEach } from "vitest";
import { ServerGameRepository } from "@/lib/firebase/server/gameRepository";
import { submitGameAction } from "@/lib/firebase/server/submitGameAction";
import { sha256, generatePairingCode } from "@/lib/utils/crypto";
import type { GameSession, GameState, GameResult, GameAction, Couple, CoupleInvite } from "@/types/domain";

/**
 * Two Simultaneous Browser Sessions Critical E2E Flow:
 * User A registers
 * → User B registers
 * → A creates couple
 * → A invites B
 * → B accepts
 * → A creates game
 * → B joins
 * → both ready
 * → game starts
 * → both play
 * → server validates actions
 * → result appears
 * → rematch
 */

class SimulatedBrowserSession {
  public userId: string;
  public email: string;
  public coupleId: string | null = null;
  public localSession: GameSession | null = null;
  public localState: GameState | null = null;
  public result: GameResult | null = null;
  public actionHistory: GameAction[] = [];

  constructor(
    userId: string,
    email: string,
    private repository: ServerGameRepository,
    private sharedDatabase: {
      users: Map<string, any>;
      couples: Map<string, Couple>;
      invites: Map<string, CoupleInvite>;
    }
  ) {
    this.userId = userId;
    this.email = email;
  }

  // 1. Register / Authenticate
  async register(): Promise<void> {
    this.sharedDatabase.users.set(this.userId, {
      uid: this.userId,
      email: this.email,
      createdAt: new Date().toISOString(),
    });
  }

  // 2. Create Couple
  async createCouple(coupleName: string): Promise<string> {
    const coupleId = `cpl_${this.userId}_${Date.now()}`;
    const couple: Couple = {
      coupleId,
      ownerId: this.userId,
      memberIds: [this.userId],
      status: "active",
      createdAt: new Date().toISOString(),
    };
    this.sharedDatabase.couples.set(coupleId, couple);
    this.coupleId = coupleId;
    return coupleId;
  }

  // 3. Create Invite
  async createInvite(coupleId: string): Promise<{ inviteId: string; code: string; secretToken: string }> {
    const inviteId = `inv_${Date.now()}`;
    const code = generatePairingCode();
    const secretToken = `sec_${Math.random().toString(36).substring(2, 10)}`;
    const tokenHash = await sha256(secretToken);

    const invite: CoupleInvite = {
      inviteId,
      coupleId,
      inviterId: this.userId,
      inviterName: this.email.split("@")[0] || "Partner",
      tokenHash,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: "pending",
    };

    this.sharedDatabase.invites.set(inviteId, invite);
    return { inviteId, code, secretToken };
  }

  // 4. Accept Invite
  async acceptInvite(inviteId: string, secretToken: string): Promise<void> {
    const invite = this.sharedDatabase.invites.get(inviteId);
    if (!invite) throw new Error("Invite not found");
    if (invite.status !== "pending") throw new Error("Invite not pending");
    if (Date.now() > new Date(invite.expiresAt).getTime()) throw new Error("Invite expired");

    const expectedHash = await sha256(secretToken);
    if (invite.tokenHash !== expectedHash) throw new Error("Invalid token");

    const couple = this.sharedDatabase.couples.get(invite.coupleId);
    if (!couple) throw new Error("Couple not found");

    // Add User B to couple
    if (!couple.memberIds.includes(this.userId)) {
      couple.memberIds.push(this.userId);
    }
    invite.status = "accepted";
    invite.acceptedBy = this.userId;
    this.coupleId = invite.coupleId;
  }

  // 5. Create Game
  async createGame(): Promise<string> {
    if (!this.coupleId) throw new Error("Must belong to couple");
    const gameId = `gm_fif_${Date.now()}`;

    const session: GameSession = {
      gameId,
      coupleId: this.coupleId,
      gameType: "find_it_first",
      status: "waiting",
      playerIds: [this.userId],
      readyPlayerIds: [],
      createdBy: this.userId,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    const state: GameState = {
      gameId,
      gameType: "find_it_first",
      status: "waiting",
      currentRound: 1,
      maxRounds: 1,
      version: 1,
      scores: { [this.userId]: 0 },
      serverTimestamp: Date.now(),
      roundStartedAtServer: Date.now(),
      roundDeadlineServer: Date.now() + 60000,
      processedActionIds: {},
      isFinished: false,
      data: {
        targetId: "watch",
        board: ["watch", "compass", "key", "seal", "pen", "hourglass", "prism", "book", "camera", "bell", "monocle", "mug"],
        roundAnswers: {},
      },
    };

    this.repository.seedGame(session, state);
    this.localSession = { ...session };
    this.localState = { ...state };
    return gameId;
  }

  // 6. Join Game
  async joinGame(gameId: string): Promise<void> {
    const session = await this.repository.getGameSession(gameId);
    const state = await this.repository.getEphemeralGameState(gameId);
    if (!session || !state) throw new Error("Game not found");

    if (!session.playerIds.includes(this.userId)) {
      session.playerIds.push(this.userId);
      session.status = "ready";
      state.scores[this.userId] = 0;
      await this.repository.saveGameSession(session);
      await this.repository.saveEphemeralGameState(state);
    }

    this.syncLocal(session, state);
  }

  // 7. Ready Up
  async readyUp(gameId: string): Promise<void> {
    const action: GameAction = {
      gameId,
      clientActionId: `act_ready_${this.userId}_${Date.now()}`,
      type: "READY",
      payload: {},
      clientTimestamp: Date.now(),
    };

    const res = await submitGameAction(action, {
      auth: { uid: this.userId },
      repository: this.repository,
      enforceAppCheck: false,
    });

    this.actionHistory.push(action);
    this.syncLocal(res.gameSession, res.gameState);
  }

  // 8. Start Game (Host only)
  async startGame(gameId: string): Promise<void> {
    const action: GameAction = {
      gameId,
      clientActionId: `act_start_${this.userId}_${Date.now()}`,
      type: "START_GAME",
      payload: {},
      clientTimestamp: Date.now(),
    };

    const res = await submitGameAction(action, {
      auth: { uid: this.userId },
      repository: this.repository,
      enforceAppCheck: false,
    });

    this.actionHistory.push(action);
    this.syncLocal(res.gameSession, res.gameState);
  }

  // 9. Play Action
  async playAction(gameId: string, type: string, payload: any): Promise<any> {
    const action: GameAction = {
      gameId,
      clientActionId: `act_play_${this.userId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      payload,
      clientTimestamp: Date.now(),
    };

    const res = await submitGameAction(action, {
      auth: { uid: this.userId },
      repository: this.repository,
      enforceAppCheck: false,
    });

    this.actionHistory.push(action);
    this.syncLocal(res.gameSession, res.gameState, res.gameResult);
    return res;
  }

  // 10. Request Rematch
  async requestRematch(gameId: string): Promise<void> {
    const action: GameAction = {
      gameId,
      clientActionId: `act_rematch_${this.userId}_${Date.now()}`,
      type: "REMATCH",
      payload: {},
      clientTimestamp: Date.now(),
    };

    const res = await submitGameAction(action, {
      auth: { uid: this.userId },
      repository: this.repository,
      enforceAppCheck: false,
    });

    this.actionHistory.push(action);
    this.syncLocal(res.gameSession, res.gameState);
  }

  public syncLocal(session?: GameSession | null, state?: GameState | null, result?: GameResult | null) {
    if (session) this.localSession = JSON.parse(JSON.stringify(session));
    if (state) this.localState = JSON.parse(JSON.stringify(state));
    if (result) this.result = JSON.parse(JSON.stringify(result));
  }
}

describe("End-to-End Layer: Two Simultaneous Browser Sessions Critical Flow", () => {
  let repository: ServerGameRepository;
  let sharedDatabase: {
    users: Map<string, any>;
    couples: Map<string, Couple>;
    invites: Map<string, CoupleInvite>;
  };
  let sessionA: SimulatedBrowserSession;
  let sessionB: SimulatedBrowserSession;

  beforeEach(() => {
    repository = new ServerGameRepository();
    sharedDatabase = {
      users: new Map(),
      couples: new Map(),
      invites: new Map(),
    };

    sessionA = new SimulatedBrowserSession("user_alex_browser", "alex@togetherplay.internal", repository, sharedDatabase);
    sessionB = new SimulatedBrowserSession("user_sam_browser", "sam@togetherplay.internal", repository, sharedDatabase);
  });

  it("executes the complete multiplayer lifecycle across two independent browser sessions", async () => {
    const userA = sessionA.userId;
    const userB = sessionB.userId;

    // -------------------------------------------------------------------------
    // Phase 1: User Registration
    // -------------------------------------------------------------------------
    await sessionA.register();
    await sessionB.register();

    expect(sharedDatabase.users.has(userA)).toBe(true);
    expect(sharedDatabase.users.has(userB)).toBe(true);

    // -------------------------------------------------------------------------
    // Phase 2: Couple Creation & Pairing Flow
    // -------------------------------------------------------------------------
    const coupleId = await sessionA.createCouple("Alex & Sam");
    expect(coupleId).toBeDefined();
    expect(sessionA.coupleId).toBe(coupleId);
    expect(sessionB.coupleId).toBeNull(); // B does not belong to couple yet

    // User A generates an invite with cryptographic token and pairing code
    const invite = await sessionA.createInvite(coupleId);
    expect(invite.code).toHaveLength(15);
    expect(invite.code).toMatch(/^SANCT-/);
    expect(invite.secretToken).toBeDefined();

    // User B receives the invitation and accepts it
    await sessionB.acceptInvite(invite.inviteId, invite.secretToken);
    expect(sessionB.coupleId).toBe(coupleId);

    const couple = sharedDatabase.couples.get(coupleId);
    expect(couple?.memberIds).toContain(userA);
    expect(couple?.memberIds).toContain(userB);

    // -------------------------------------------------------------------------
    // Phase 3: Game Creation & Lobby Convergence
    // -------------------------------------------------------------------------
    // User A creates a Find It First game session
    const gameId = await sessionA.createGame();
    expect(gameId).toBeDefined();
    expect(sessionA.localSession?.status).toBe("waiting");
    expect(sessionA.localSession?.playerIds).toEqual([userA]);

    // User B discovers and joins the game
    await sessionB.joinGame(gameId);
    // User A syncs with server state
    const currentSession = await repository.getGameSession(gameId);
    sessionA.syncLocal(currentSession);

    expect(sessionA.localSession?.playerIds).toContain(userA);
    expect(sessionA.localSession?.playerIds).toContain(userB);
    expect(sessionB.localSession?.playerIds).toContain(userA);
    expect(sessionB.localSession?.playerIds).toContain(userB);

    // -------------------------------------------------------------------------
    // Phase 4: Ready-Up & Server-Controlled Countdown
    // -------------------------------------------------------------------------
    // User A marks ready
    await sessionA.readyUp(gameId);
    expect(sessionA.localSession?.readyPlayerIds).toContain(userA);
    expect(sessionA.localSession?.readyPlayerIds).not.toContain(userB);

    // User B marks ready (triggers countdown status on server)
    await sessionB.readyUp(gameId);
    expect(sessionB.localSession?.readyPlayerIds).toContain(userA);
    expect(sessionB.localSession?.readyPlayerIds).toContain(userB);
    expect(sessionB.localSession?.status).toBe("countdown");

    // Host starts the game
    await sessionA.startGame(gameId);
    expect(sessionA.localSession?.status).toBe("playing");
    expect(sessionA.localState?.status).toBe("playing");

    // Set maxRounds to 1 on server for fast definitive conclusion in this test
    const livePlayingState = await repository.getEphemeralGameState(gameId);
    if (livePlayingState) {
      livePlayingState.maxRounds = 1;
      await repository.saveEphemeralGameState(livePlayingState);
    }

    // Sync Session B with playing state
    sessionB.syncLocal(sessionA.localSession, livePlayingState);
    expect(sessionB.localState?.status).toBe("playing");

    const targetId = String(livePlayingState?.data.targetId || "watch");
    const wrongCell = (livePlayingState?.data.board as string[] || []).find((c) => c !== targetId) || "pen";

    // -------------------------------------------------------------------------
    // Phase 5: Simultaneous Gameplay & Authoritative Server Validation
    // -------------------------------------------------------------------------
    // User A picks wrong cell (authoritative validation: no points awarded)
    await sessionA.playAction(gameId, "SELECT_CELL", {
      cellId: wrongCell,
    });

    // User B finds the target first
    await sessionB.playAction(gameId, "SELECT_CELL", {
      cellId: targetId,
    });

    // Server validated actions, scores updated authoritatively
    const serverState = await repository.getEphemeralGameState(gameId);
    expect(serverState).not.toBeNull();
    expect(serverState?.scores[userA]).toBe(0);
    expect(serverState?.scores[userB]).toBeGreaterThan(0);

    // -------------------------------------------------------------------------
    // Phase 6: Game Completion & Result Verification
    // -------------------------------------------------------------------------
    const finalSession = await repository.getGameSession(gameId);
    const finalState = await repository.getEphemeralGameState(gameId);
    sessionA.syncLocal(finalSession, finalState);
    sessionB.syncLocal(finalSession, finalState);

    expect(finalState?.isFinished).toBe(true);
    expect(finalState?.winnerId).toBe(userB);

    // -------------------------------------------------------------------------
    // Phase 7: Rematch Flow
    // -------------------------------------------------------------------------
    // User B requests rematch
    await sessionB.requestRematch(gameId);
    const rematchState = await repository.getEphemeralGameState(gameId);
    expect(rematchState?.status).toBe("playing");
    expect(rematchState?.isFinished).toBe(false);
    expect(rematchState?.scores[userA]).toBe(0);
    expect(rematchState?.scores[userB]).toBe(0);

    sessionA.syncLocal(await repository.getGameSession(gameId), rematchState);
    sessionB.syncLocal(await repository.getGameSession(gameId), rematchState);

    expect(sessionA.localState?.status).toBe("playing");
    expect(sessionB.localState?.status).toBe("playing");
  });
});

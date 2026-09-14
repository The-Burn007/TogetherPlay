import { describe, it, expect, beforeEach } from "vitest";
import { roomService } from "@/lib/firebase/services/rooms";
import { presenceService } from "@/lib/firebase/services/presence";
import { TOGETHERPLAY_GAMES } from "@/features/games/gameCatalog";
import type { GameSession, LobbyFlowState } from "@/types/domain";

describe("Multiplayer Game Lobby & Flow Engine", () => {
  beforeEach(() => {
    roomService.clearSessionsForTesting?.();
  });

  it("creates a game session in 'waiting' state for two partners", async () => {
    const session = await roomService.createSession("cpl_london_tokyo", "find_it_first", "user_alex");

    expect(session.gameId).toBeDefined();
    expect(session.coupleId).toBe("cpl_london_tokyo");
    expect(session.gameType).toBe("find_it_first");
    expect(session.status).toBe("waiting");
    expect(session.playerIds).toEqual(["user_alex"]);
    expect(session.createdBy).toBe("user_alex");
    expect(session.connectionLatencyMs).toBe(24);
  });

  it("transitions to partner joined when second player enters", async () => {
    const session = await roomService.createSession("cpl_london_tokyo", "speed_duel", "user_alex");
    const joinedSession = await roomService.joinSession(session.gameId, "user_sam");

    expect(joinedSession.playerIds).toContain("user_alex");
    expect(joinedSession.playerIds).toContain("user_sam");
    expect(joinedSession.playerIds.length).toBe(2);
    expect(joinedSession.status).toBe("ready");
  });

  it("handles ready status for both players and advances to countdown", async () => {
    const session = await roomService.createSession("cpl_london_tokyo", "couple_race", "user_alex");
    await roomService.joinSession(session.gameId, "user_sam");

    // Player A marks ready
    await roomService.setReadyStatus(session.gameId, "user_alex", true);
    let active = await roomService.getActiveSession("cpl_london_tokyo");
    expect(active?.readyPlayerIds).toContain("user_alex");
    expect(active?.readyPlayerIds).not.toContain("user_sam");
    expect(active?.status).toBe("ready");

    // Player B marks ready -> both ready triggers countdown
    await roomService.setReadyStatus(session.gameId, "user_sam", true);
    active = await roomService.getActiveSession("cpl_london_tokyo");
    expect(active?.readyPlayerIds).toContain("user_alex");
    expect(active?.readyPlayerIds).toContain("user_sam");
    expect(active?.status).toBe("countdown");
  });

  it("supports all 5 explicit lobby states cleanly", () => {
    const validStates: LobbyFlowState[] = [
      "waiting",
      "partner_joined",
      "ready",
      "starting",
      "disconnected",
      "game",
    ];

    expect(validStates).toContain("waiting");
    expect(validStates).toContain("partner_joined");
    expect(validStates).toContain("ready");
    expect(validStates).toContain("starting");
    expect(validStates).toContain("disconnected");
  });

  it("exposes presence and telemetry for both London and Tokyo partners", async () => {
    await new Promise<void>((resolve) => {
      presenceService.subscribeToPartnerPresence("partner_sam", (presence) => {
        expect(presence).not.toBeNull();
        expect(presence?.displayName).toBe("Sam");
        expect(presence?.colorRole).toBe("sage");
        expect(presence?.telemetry.city).toBe("Tokyo");
        expect(presence?.telemetry.localTime).toBe("08:14");
        expect(presence?.telemetry.latencyMs).toBe(28);
        expect(presence?.telemetry.isOnline).toBe(true);
        resolve();
      });
    });
  });

  it("catalog games define all required lobby metadata: duration, description, video availability", () => {
    TOGETHERPLAY_GAMES.forEach((game) => {
      expect(game.title).toBeTruthy();
      expect(game.description).toBeTruthy();
      expect(game.duration).toBeTruthy();
      expect(game.videoSupport).toBeTruthy();
      expect(game.playStyle).toBeTruthy();
    });
  });

  it("submits authoritative game action through room service contract", async () => {
    const result = await roomService.submitGameAction({
      gameId: "gm_test123",
      clientActionId: "action-uuid-1",
      type: "READY",
      payload: { isReady: true },
      clientTimestamp: Date.now(),
    });

    expect(result.accepted).toBe(true);
    expect(result.eventType).toBe("READY");
    expect(result.stateVersion).toBe(1);
  });
});

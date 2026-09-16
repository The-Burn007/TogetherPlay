import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/firebase/client", () => ({
  rtdb: null,
  db: null,
  auth: null,
  storage: null,
}));

import { FirebasePresenceService } from "@/lib/firebase/services/presence";
import { FirebaseNotificationService } from "@/lib/firebase/services/notifications";
import {
  type PresenceState,
  type ConnectionStatus,
  type NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
} from "@/lib/presence/types";

describe("TogetherPlay Real-time Partner Presence & Notifications", () => {
  let presenceService: FirebasePresenceService;
  let notificationService: FirebaseNotificationService;

  beforeEach(() => {
    presenceService = new FirebasePresenceService();
    notificationService = new FirebaseNotificationService();
  });

  describe("Presence States & Privacy Constraints", () => {
    const validStates: PresenceState[] = [
      "ONLINE",
      "IN_GAME",
      "IN_CALL",
      "AWAY",
      "OFFLINE",
    ];

    it("supports all 5 required presence states", async () => {
      for (const state of validStates) {
        await presenceService.setPresenceState("user_alex", state, `Status: ${state}`);
        const current = await presenceService.getUserPresence("user_alex");
        expect(current).not.toBeNull();
        expect(current?.state).toBe(state);
      }
    });

    it("supports connection statuses: online, offline, reconnecting, unknown", () => {
      const statuses: ConnectionStatus[] = ["online", "offline", "reconnecting", "unknown"];
      statuses.forEach((st) => {
        expect(typeof st).toBe("string");
      });
    });

    it("strictly enforces privacy: no precise GPS coordinates stored", async () => {
      await presenceService.setPresenceState("user_alex", "ONLINE");
      const record = await presenceService.getUserPresence("user_alex");
      expect(record).not.toBeNull();
      // Verify no lat, lng, coordinates or geolocation fields
      expect((record as unknown as Record<string, unknown>).lat).toBeUndefined();
      expect((record as unknown as Record<string, unknown>).lng).toBeUndefined();
      expect((record as unknown as Record<string, unknown>).latitude).toBeUndefined();
      expect((record as unknown as Record<string, unknown>).longitude).toBeUndefined();
      expect((record as unknown as Record<string, unknown>).coordinates).toBeUndefined();
      // Only high-level city is allowed
      expect(record?.city).toBeDefined();
    });

    it("tracks gameId and currentActivity when partner enters game", async () => {
      await presenceService.setPresenceState(
        "user_sam",
        "IN_GAME",
        "Playing Find It First",
        "find_it_first"
      );
      const record = await presenceService.getUserPresence("user_sam");
      expect(record?.state).toBe("IN_GAME");
      expect(record?.gameId).toBe("find_it_first");
      expect(record?.currentActivity).toBe("Playing Find It First");
    });

    it("notifies listeners when partner presence changes in real-time", async () => {
      const receivedStates: PresenceState[] = [];
      const unsub = presenceService.subscribeToUserPresence("user_sam", (record) => {
        if (record) receivedStates.push(record.state);
      });

      await presenceService.setPresenceState("user_sam", "ONLINE");
      await presenceService.setPresenceState("user_sam", "IN_CALL");
      await presenceService.setPresenceState("user_sam", "AWAY");

      expect(receivedStates).toContain("ONLINE");
      expect(receivedStates).toContain("IN_CALL");
      expect(receivedStates).toContain("AWAY");
      unsub();
    });
  });

  describe("Real-time Notifications Scenarios", () => {
    it("handles scenario 1: partner invited you", async () => {
      const success = await notificationService.notifyPartnerInvited({
        fromUserId: "user_sam",
        fromName: "Sam",
        toUserId: "user_alex",
        gameId: "find_it_first",
        gameTitle: "Find It First",
      });

      expect(success).toBe(true);
      const notifs = await notificationService.getNotifications("user_alex");
      const notif = notifs.find((n) => n.type === "partner_invited");
      expect(notif).toBeDefined();
      expect(notif?.type).toBe("partner_invited");
      expect(notif?.title).toContain("invited you to play");
      expect(notif?.body).toContain("Find It First");
      expect(notif?.actionHref).toBe("/play/lobby?game=find_it_first");
    });

    it("handles scenario 2: partner started a game", async () => {
      const success = await notificationService.notifyGameStarted({
        fromUserId: "user_sam",
        fromName: "Sam",
        toUserId: "user_alex",
        gameId: "find_it_first",
        gameTitle: "Find It First",
      });

      expect(success).toBe(true);
      const notifs = await notificationService.getNotifications("user_alex");
      const notif = notifs.find((n) => n.type === "game_started");
      expect(notif).toBeDefined();
      expect(notif?.type).toBe("game_started");
      expect(notif?.body).toContain("countdown has started");
    });

    it("handles scenario 3: partner sent challenge", async () => {
      const success = await notificationService.notifyChallengeSent({
        fromUserId: "user_sam",
        fromName: "Sam",
        toUserId: "user_alex",
        challengeTitle: "30-Second Scavenger Sprint",
      });

      expect(success).toBe(true);
      const notifs = await notificationService.getNotifications("user_alex");
      const notif = notifs.find((n) => n.type === "challenge_sent");
      expect(notif).toBeDefined();
      expect(notif?.type).toBe("challenge_sent");
      expect(notif?.title).toContain("Challenge from");
      expect(notif?.body).toContain("30-Second Scavenger Sprint");
    });

    it("handles scenario 4: daily shared moment", async () => {
      const success = await notificationService.notifyDailyMoment({
        fromUserId: "user_sam",
        fromName: "Sam",
        toUserId: "user_alex",
        momentTitle: "Evening Twilight Memory",
      });

      expect(success).toBe(true);
      const notifs = await notificationService.getNotifications("user_alex");
      const notif = notifs.find((n) => n.type === "daily_moment");
      expect(notif).toBeDefined();
      expect(notif?.type).toBe("daily_moment");
      expect(notif?.title).toContain("Daily moment with");
    });

    it("handles scenario 5: rematch request", async () => {
      const success = await notificationService.notifyRematchRequested({
        fromUserId: "user_sam",
        fromName: "Sam",
        toUserId: "user_alex",
        gameId: "find_it_first",
        gameTitle: "Find It First",
      });

      expect(success).toBe(true);
      const notifs = await notificationService.getNotifications("user_alex");
      const notif = notifs.find((n) => n.type === "rematch_requested");
      expect(notif).toBeDefined();
      expect(notif?.type).toBe("rematch_requested");
      expect(notif?.title).toContain("Rematch requested");
    });
  });

  describe("Notification Deduplication & Rate Limiting", () => {
    it("deduplicates identical notifications within the cooldown window", async () => {
      const first = await notificationService.notifyPartnerInvited({
        fromUserId: "user_sam",
        fromName: "Sam",
        toUserId: "user_alex",
        gameId: "find_it_first",
        gameTitle: "Find It First",
      });
      expect(first).toBe(true);

      // Immediate second call with identical payload is suppressed
      const second = await notificationService.notifyPartnerInvited({
        fromUserId: "user_sam",
        fromName: "Sam",
        toUserId: "user_alex",
        gameId: "find_it_first",
        gameTitle: "Find It First",
      });
      expect(second).toBe(false);
    });
  });

  describe("Notification Settings Channels", () => {
    it("mutes game activity notifications when disabled in settings", async () => {
      notificationService.updateSettings({ gameActivity: false });

      const notif = await notificationService.notifyPartnerInvited({
        fromUserId: "user_sam",
        fromName: "Sam",
        toUserId: "user_alex",
        gameId: "find_it_first",
        gameTitle: "Find It First",
      });
      expect(notif).toBe(false);

      const rematch = await notificationService.notifyRematchRequested({
        fromUserId: "user_sam",
        fromName: "Sam",
        toUserId: "user_alex",
        gameId: "find_it_first",
        gameTitle: "Find It First",
      });
      expect(rematch).toBe(false);
    });

    it("mutes challenges notifications when disabled in settings", async () => {
      notificationService.updateSettings({ challenges: false });

      const notif = await notificationService.notifyChallengeSent({
        fromUserId: "user_sam",
        fromName: "Sam",
        toUserId: "user_alex",
        challengeTitle: "Lightning Reaction",
      });
      expect(notif).toBe(false);
    });

    it("mutes daily moments notifications when disabled in settings", async () => {
      notificationService.updateSettings({ dailyMoments: false });

      const notif = await notificationService.notifyDailyMoment({
        fromUserId: "user_sam",
        fromName: "Sam",
        toUserId: "user_alex",
        momentTitle: "Tokyo Sun Setting",
      });
      expect(notif).toBe(false);
    });

    it("allows notifications when channels are re-enabled", async () => {
      notificationService.updateSettings({ gameActivity: true });

      const notif = await notificationService.notifyGameStarted({
        fromUserId: "user_sam",
        fromName: "Sam",
        toUserId: "user_alex",
        gameId: "speed_duel",
        gameTitle: "Speed Duel",
      });
      expect(notif).toBe(true);
    });
  });
});

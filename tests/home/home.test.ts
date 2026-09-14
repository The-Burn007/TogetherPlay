import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/firebase/services/auth", () => ({
  authService: {
    getUserProfile: vi.fn(async (uid: string) => {
      if (uid === "user_solo_123") {
        return { uid: "user_solo_123", displayName: "Solo Alex" };
      }
      if (uid === "user_coupled_1") {
        return { uid: "user_coupled_1", displayName: "Alex" };
      }
      if (uid === "user_coupled_2") {
        return { uid: "user_coupled_2", displayName: "Sam", lastActiveAt: new Date().toISOString() };
      }
      return null;
    }),
  },
}));

vi.mock("@/lib/firebase/services/couple", () => ({
  coupleService: {
    getUserCouple: vi.fn(async (uid: string) => {
      if (uid === "user_solo_123") {
        return {
          coupleId: "cpl_solo",
          memberIds: ["user_solo_123"],
          status: "pending",
        };
      }
      if (uid === "user_coupled_1") {
        return {
          coupleId: "cpl_duo",
          memberIds: ["user_coupled_1", "user_coupled_2"],
          status: "active",
          createdAt: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000).toISOString(),
        };
      }
      return null;
    }),
  },
}));

import {
  getPresetHomeData,
  getTimeOfDayGreeting,
  HomeService,
} from "@/lib/firebase/services/home";

describe("Home Screen Sanctuary Data & Meaningful States", () => {
  it("generates time-appropriate greetings", () => {
    const greeting = getTimeOfDayGreeting("Alex");
    expect(greeting).toMatch(/Good (morning|afternoon|evening), Alex/);
  });

  describe("Meaningful State: partner_online", () => {
    it("provides the correct hierarchy and status for online partner", () => {
      const state = getPresetHomeData("partner_online", "Alex");
      expect(state.user.displayName).toBe("Alex");
      expect(state.partner).not.toBeNull();
      expect(state.partner?.displayName).toBe("Sam");
      expect(state.partner?.presenceState).toBe("online");
      expect(state.presenceStatusHeadline).toBe("Sam is online.");
      expect(state.presenceActionPrompt).toBe("Play something?");
      expect(state.currentActivity.type).toBe("synced");
      expect(state.continueGame).not.toBeNull();
      expect(state.suggestedGame).not.toBeNull();
      expect(state.recentMemory).not.toBeNull();
    });
  });

  describe("Meaningful State: partner_offline", () => {
    it("handles offline presence and quiet hours appropriately", () => {
      const state = getPresetHomeData("partner_offline", "Alex");
      expect(state.partner).not.toBeNull();
      expect(state.partner?.presenceState).toBe("offline");
      expect(state.presenceStatusHeadline).toBe("Sam is offline.");
      expect(state.presenceActionPrompt).toBe("Leave a whisper?");
      expect(state.currentActivity.type).toBe("quiet");
      expect(state.currentActivity.actionLabel).toBe("Leave a Whisper Note");
    });
  });

  describe("Meaningful State: partner_in_game", () => {
    it("shows in-game presence and provides direct join action", () => {
      const state = getPresetHomeData("partner_in_game", "Alex");
      expect(state.partner).not.toBeNull();
      expect(state.partner?.presenceState).toBe("in_game");
      expect(state.presenceStatusHeadline).toBe("Sam is in game.");
      expect(state.presenceActionPrompt).toBe("Join Sam?");
      expect(state.currentActivity.type).toBe("game");
      expect(state.currentActivity.actionLabel).toContain("Join Sam");
    });
  });

  describe("Meaningful State: partner_in_call", () => {
    it("shows in-call presence and provides audio link", () => {
      const state = getPresetHomeData("partner_in_call", "Alex");
      expect(state.partner).not.toBeNull();
      expect(state.partner?.presenceState).toBe("in_call");
      expect(state.presenceStatusHeadline).toBe("Sam is in call.");
      expect(state.presenceActionPrompt).toBe("Join audio?");
      expect(state.currentActivity.type).toBe("call");
      expect(state.currentActivity.actionLabel).toBe("Rejoin Voice Call");
    });
  });

  describe("Meaningful State: no_previous_games", () => {
    it("sets continueGame to null and highlights starter duel", () => {
      const state = getPresetHomeData("no_previous_games", "Alex");
      expect(state.partner).not.toBeNull();
      expect(state.continueGame).toBeNull();
      expect(state.suggestedGame).not.toBeNull();
      expect(state.recentMemory).not.toBeNull();
    });
  });

  describe("Meaningful State: no_memories", () => {
    it("sets recentMemory to null while keeping games and activity active", () => {
      const state = getPresetHomeData("no_memories", "Alex");
      expect(state.partner).not.toBeNull();
      expect(state.recentMemory).toBeNull();
      expect(state.continueGame).not.toBeNull();
      expect(state.suggestedGame).not.toBeNull();
    });
  });

  describe("Meaningful State: new_couple", () => {
    it("handles awaiting partner state with invitation CTA and clean empty states", () => {
      const state = getPresetHomeData("new_couple", "Alex");
      expect(state.partner).toBeNull();
      expect(state.presenceStatusHeadline).toBe("Waiting for your partner.");
      expect(state.currentActivity.type).toBe("awaiting_partner");
      expect(state.currentActivity.actionLabel).toBe("Send Invitation Link");
      expect(state.currentActivity.actionHref).toBe("/onboarding/invite");
      expect(state.continueGame).toBeNull();
      expect(state.recentMemory).toBeNull();
    });
  });

  describe("HomeService fetchLiveHomeData fallback logic", () => {
    it("returns new_couple state if user is not in a couple with 2 members", async () => {
      const service = new HomeService();
      const liveState = await service.fetchLiveHomeData("user_solo_123");
      expect(liveState).toBeDefined();
      expect(liveState.presetKey).toBe("new_couple");
      expect(liveState.partner).toBeNull();
    });

    it("returns active couple data when two partners exist in couple", async () => {
      const service = new HomeService();
      const liveState = await service.fetchLiveHomeData("user_coupled_1");
      expect(liveState.presetKey).toBe("live");
      expect(liveState.coupleId).toBe("cpl_duo");
      expect(liveState.partner?.displayName).toBe("Sam");
      expect(liveState.partner?.presenceState).toBe("online");
    });
  });
});

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
      if (uid === "user_coupled_custom_1") {
        return { uid: "user_coupled_custom_1", displayName: "Jordan" };
      }
      if (uid === "user_coupled_custom_2") {
        return { uid: "user_coupled_custom_2", displayName: "Taylor", lastActiveAt: new Date().toISOString() };
      }
      if (uid === "user_with_tz_1") {
        return { uid: "user_with_tz_1", displayName: "Morgan", timezone: "America/Chicago" };
      }
      if (uid === "user_with_tz_2") {
        return {
          uid: "user_with_tz_2",
          displayName: "Casey",
          timezone: "Europe/Paris",
          lastActiveAt: new Date().toISOString(),
        };
      }
      if (uid === "user_with_active_game") {
        return { uid: "user_with_active_game", displayName: "Avery" };
      }
      if (uid === "partner_game_2") {
        return { uid: "partner_game_2", displayName: "Quinn", lastActiveAt: new Date().toISOString() };
      }
      if (uid === "user_with_memories") {
        return { uid: "user_with_memories", displayName: "Dakota" };
      }
      if (uid === "partner_mem_2") {
        return { uid: "partner_mem_2", displayName: "Skyler", lastActiveAt: new Date().toISOString() };
      }
      if (uid === "user_with_incomplete_partner") {
        return { uid: "user_with_incomplete_partner", displayName: "Robin" };
      }
      if (uid === "partner_incomplete_uid") {
        return { uid: "partner_incomplete_uid", displayName: "" };
      }
      if (uid === "user_coupled_offline_1") {
        return { uid: "user_coupled_offline_1", displayName: "Jamie" };
      }
      if (uid === "partner_offline_2") {
        return {
          uid: "partner_offline_2",
          displayName: "Logan",
          lastActiveAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        };
      }
      if (uid === "user_no_couple") {
        return { uid: "user_no_couple", displayName: "Riley" };
      }
      if (uid === "user_network_error") {
        throw new Error("Firestore connection unavailable");
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
      if (uid === "user_coupled_custom_1") {
        return {
          coupleId: "cpl_jordan_taylor_custom",
          memberIds: ["user_coupled_custom_1", "user_coupled_custom_2"],
          status: "active",
          createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
        };
      }
      if (uid === "user_with_tz_1") {
        return {
          coupleId: "cpl_morgan_casey_tz",
          memberIds: ["user_with_tz_1", "user_with_tz_2"],
          status: "active",
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
      }
      if (uid === "user_with_active_game") {
        return {
          coupleId: "cpl_with_active_game",
          memberIds: ["user_with_active_game", "partner_game_2"],
          status: "active",
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        };
      }
      if (uid === "user_with_memories") {
        return {
          coupleId: "cpl_with_real_memories",
          memberIds: ["user_with_memories", "partner_mem_2"],
          status: "active",
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        };
      }
      if (uid === "user_with_incomplete_partner") {
        return {
          coupleId: "cpl_incomplete_profile",
          memberIds: ["user_with_incomplete_partner", "partner_incomplete_uid"],
          status: "active",
          createdAt: new Date().toISOString(),
        };
      }
      if (uid === "user_coupled_offline_1") {
        return {
          coupleId: "cpl_offline_couple",
          memberIds: ["user_coupled_offline_1", "partner_offline_2"],
          status: "active",
          createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        };
      }
      if (uid === "user_no_couple") {
        return null;
      }
      if (uid === "user_network_error") {
        throw new Error("Network timeout contacting database");
      }
      return null;
    }),
  },
}));

vi.mock("@/lib/firebase/services/rooms", () => ({
  roomService: {
    getActiveSession: vi.fn(async (coupleId: string) => {
      if (coupleId === "cpl_with_active_game") {
        return {
          gameId: "game_active_duel_99",
          coupleId: "cpl_with_active_game",
          gameType: "speed_duel",
          title: "Speed Duel: Live Match",
          status: "in_progress",
          round: 2,
        };
      }
      return null;
    }),
  },
}));

vi.mock("@/lib/firebase/services/memories", () => ({
  memoryService: {
    getMemories: vi.fn(async (coupleId: string) => {
      if (coupleId === "cpl_with_real_memories") {
        return [
          {
            id: "mem_real_101",
            coupleId: "cpl_with_real_memories",
            title: "Our Trip to Devon Coast",
            dateLabel: "August 15",
            type: "milestone",
            context: "Watching the waves at sunset.",
            milestoneData: { metricValue: "Day 60 Reached" },
          },
        ];
      }
      return [];
    }),
  },
}));

import {
  getPresetHomeData,
  getTimeOfDayGreeting,
  HomeService,
  type HomePresetKey,
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

  describe("HomeService Live Data Correctness & Non-Fabrication Audit", () => {
    const service = new HomeService();

    it("production defaults to live data for coupled user", async () => {
      const liveState = await service.fetchLiveHomeData("user_coupled_1");
      expect(liveState).toBeDefined();
      expect(liveState.presetKey).toBe("live");
      expect(liveState.connectionStatus).toBe("connected");
      expect(liveState.coupleId).toBe("cpl_duo");
      expect(liveState.coupleId).not.toBe("cpl_tokyo_london_4209");
      expect(liveState.coupleId).not.toBe("cpl_tokyo_london_771");
      expect(liveState.partner).not.toBeNull();
      expect(liveState.daysTogether).toBe(42);
    });

    it("debug mode can still select presets", () => {
      const presets: HomePresetKey[] = [
        "partner_online",
        "partner_offline",
        "partner_in_game",
        "partner_in_call",
        "partner_away",
        "no_previous_games",
        "no_memories",
        "new_couple",
      ];

      for (const preset of presets) {
        const state = getPresetHomeData(preset, "TestAlex");
        expect(state).toBeDefined();
        expect(state.presetKey).toBe(preset);
        expect(state.user.displayName).toBe("TestAlex");
      }
    });

    it("no-couple state does not receive demo data", async () => {
      const liveState = await service.fetchLiveHomeData("user_no_couple");
      expect(liveState).toBeDefined();
      // Must not fabricate a partner
      expect(liveState.partner).toBeNull();
      // Must not expose demo couple IDs
      expect(liveState.coupleId).toBe("");
      expect(liveState.coupleId).not.toBe("cpl_tokyo_london_4209");
      expect(liveState.coupleId).not.toBe("cpl_tokyo_london_771");
      // Must not expose demo game in-progress or demo memories or demo suggested games
      expect(liveState.continueGame).toBeNull();
      expect(liveState.recentMemory).toBeNull();
      expect(liveState.suggestedGame).toBeNull();
      // Must use actual authenticated user's name
      expect(liveState.user.displayName).toBe("Riley");
      // Must not fabricate weather, distance, or demo challenge
      expect(liveState.user.weather).toBeUndefined();
      expect(liveState.distanceKm).toBeUndefined();
      expect(liveState.todayChallenge).toBeNull();
      // Must not fabricate time or city when timezone is unknown
      expect(liveState.user.localTime).toBeUndefined();
      expect(liveState.user.city).toBeUndefined();
      // Must provide actionable connect state
      expect(liveState.connectionStatus).toBe("no_couple");
      expect(liveState.currentActivity.actionHref).toBe("/onboarding/invite");
      expect(liveState.presenceStatusHeadline).toBe("No partner connected yet.");
    });

    it("live-data failure does not return partner_online demo data", async () => {
      await expect(service.fetchLiveHomeData("user_network_error")).rejects.toThrow();
    });

    it("authenticated user's actual partner name is used", async () => {
      const liveState = await service.fetchLiveHomeData("user_coupled_custom_1");
      expect(liveState.user.displayName).toBe("Jordan");
      expect(liveState.partner).not.toBeNull();
      expect(liveState.partner?.displayName).toBe("Taylor");
      expect(liveState.partner?.displayName).not.toBe("Sam");
      expect(liveState.presenceStatusHeadline).toBe("Taylor is online.");
      expect(liveState.currentActivity.actionLabel).toContain("Taylor");
      expect(liveState.coupleId).toBe("cpl_jordan_taylor_custom");
    });

    it("live mode does NOT return known demo values unless originating from user data", async () => {
      const liveState = await service.fetchLiveHomeData("user_coupled_custom_1");

      // 1 & 2: City / Timezone: must NOT default to London or Tokyo
      expect(liveState.user.city).not.toBe("London");
      expect(liveState.user.city).toBeUndefined();
      expect(liveState.partner?.city).not.toBe("Tokyo");
      expect(liveState.partner?.city).toBeUndefined();

      // 3 & 4: Local time: must NOT default to fixed 23:24 or 07:24, nor fall back to host machine clock
      expect(liveState.user.localTime).not.toBe("23:24");
      expect(liveState.user.localTime).toBeUndefined();
      expect(liveState.partner?.localTime).not.toBe("07:24");
      expect(liveState.partner?.localTime).toBeUndefined();

      // 5 & 6: Weather: must NOT return hardcoded weather "Rainy · 9°C" or "Clear · 18°C"
      expect(liveState.user.weather).toBeUndefined();
      expect(liveState.user.weather).not.toBe("Rainy · 9°C");
      expect(liveState.partner?.weather).toBeUndefined();
      expect(liveState.partner?.weather).not.toBe("Clear · 18°C");

      // 7: Distance: must NOT default to 9560 km
      expect(liveState.distanceKm).toBeUndefined();
      expect(liveState.distanceKm).not.toBe(9560);

      // 8: Current Activity title: must NOT be "Tonight's Shared Moment"
      expect(liveState.currentActivity.title).not.toBe("Tonight's Shared Moment");

      // 9: Activity / Game titles: must NOT contain "Find It First: Tokyo vs London"
      expect(liveState.currentActivity.subtitle).not.toContain("Tokyo vs London");
      expect(liveState.currentActivity.subtitle).not.toContain("Find It First: Tokyo vs London");

      // 10: Fixed countdown: must NOT contain fixed "01:54"
      expect(liveState.currentActivity.timeFormatted).not.toBe("01:54");
      expect(liveState.currentActivity.timeFormatted).toBeUndefined();

      // 11: Fixed partner activity: must NOT fabricate "Looking at shared sanctuary"
      expect(liveState.partner?.activityDetail).not.toBe("Looking at shared sanctuary");

      // 12: Fixed demo avatars: must NOT return picsum demo avatars
      expect(liveState.user.avatarUrl).toBeUndefined();
      expect(liveState.user.avatarUrl).not.toBe("https://picsum.photos/seed/alex-profile-london/200/200");
      expect(liveState.partner?.avatarUrl).toBeUndefined();
      expect(liveState.partner?.avatarUrl).not.toBe("https://picsum.photos/seed/sam-profile-tokyo/200/200");

      // 13: Fixed demo couple IDs: must NOT return cpl_tokyo_london_771 or cpl_tokyo_london_4209
      expect(liveState.coupleId).not.toBe("cpl_tokyo_london_771");
      expect(liveState.coupleId).not.toBe("cpl_tokyo_london_4209");

      // 14: Days together: must NOT be hardcoded 842
      expect(liveState.daysTogether).toBe(100);
      expect(liveState.daysTogether).not.toBe(842);

      // 15: Game state: no fabricated continueGame, memories, or challenge
      expect(liveState.continueGame).toBeNull();
      expect(liveState.suggestedGame).toBeNull();
      expect(liveState.recentMemory).toBeNull();
      expect(liveState.todayChallenge).toBeNull();
    });

    it("live mode derives city and local time strictly from legitimate timezone", async () => {
      const liveState = await service.fetchLiveHomeData("user_with_tz_1");
      expect(liveState.user.displayName).toBe("Morgan");
      expect(liveState.user.city).toBe("Chicago");
      expect(liveState.user.localTime).toMatch(/\d{2}:\d{2}/);

      expect(liveState.partner?.displayName).toBe("Casey");
      expect(liveState.partner?.city).toBe("Paris");
      expect(liveState.partner?.localTime).toMatch(/\d{2}:\d{2}/);

      // Weather remains undefined (authoritative: no weather provider)
      expect(liveState.user.weather).toBeUndefined();
      expect(liveState.partner?.weather).toBeUndefined();
    });

    it("live mode populates continueGame and game activity only when actual game session is active", async () => {
      const liveState = await service.fetchLiveHomeData("user_with_active_game");
      expect(liveState.continueGame).not.toBeNull();
      expect(liveState.continueGame?.id).toBe("game_active_duel_99");
      expect(liveState.continueGame?.gameType).toBe("speed_duel");
      expect(liveState.continueGame?.title).toBe("Speed Duel");
      expect(liveState.continueGame?.roundLabel).toBe("In Progress");

      // Current activity should reflect the active game
      expect(liveState.currentActivity.type).toBe("game");
      expect(liveState.currentActivity.title).toBe("Speed Duel");
      expect(liveState.currentActivity.actionLabel).toBe("Resume Game Session");
    });

    it("live mode populates recentMemory only when actual memories exist in database", async () => {
      const liveState = await service.fetchLiveHomeData("user_with_memories");
      expect(liveState.recentMemory).not.toBeNull();
      expect(liveState.recentMemory?.id).toBe("mem_real_101");
      expect(liveState.recentMemory?.title).toBe("Our Trip to Devon Coast");
      expect(liveState.recentMemory?.description).toBe("Watching the waves at sunset.");
      expect(liveState.recentMemory?.highlightStat).toBe("Day 60 Reached");
      expect(liveState.recentMemory?.title).not.toContain("Voice Whisper from Shibuya");
    });

    it("preset data remains available in debug mode", () => {
      const offline = getPresetHomeData("partner_offline", "Developer");
      expect(offline.presetKey).toBe("partner_offline");
      expect(offline.partner?.presenceState).toBe("offline");

      const inGame = getPresetHomeData("partner_in_game", "Developer");
      expect(inGame.presetKey).toBe("partner_in_game");
      expect(inGame.partner?.presenceState).toBe("in_game");

      const inCall = getPresetHomeData("partner_in_call", "Developer");
      expect(inCall.presetKey).toBe("partner_in_call");
      expect(inCall.partner?.presenceState).toBe("in_call");

      const away = getPresetHomeData("partner_away", "Developer");
      expect(away.presetKey).toBe("partner_away");
      expect(away.partner?.presenceState).toBe("away");
    });

    it("returns new_couple state if user is not in a couple with 2 members (State B / F Scenario 1)", async () => {
      const liveState = await service.fetchLiveHomeData("user_solo_123");
      expect(liveState).toBeDefined();
      expect(liveState.presetKey).toBe("new_couple");
      expect(liveState.connectionStatus).toBe("incomplete_couple");
      expect(liveState.coupleId).toBe("cpl_solo");
      expect(liveState.partner).toBeNull();
      expect(liveState.user.displayName).toBe("Solo Alex");
      expect(liveState.suggestedGame).toBeNull();
      expect(liveState.continueGame).toBeNull();
      expect(liveState.recentMemory).toBeNull();
    });

    it("State C: authenticated + couple exists + partner offline does NOT say partner is online or show enter room", async () => {
      const liveState = await service.fetchLiveHomeData("user_coupled_offline_1");
      expect(liveState.connectionStatus).toBe("connected");
      expect(liveState.partner).not.toBeNull();
      expect(liveState.partner?.displayName).toBe("Logan");
      expect(liveState.partner?.displayName).not.toBe("Sam");
      expect(liveState.partner?.presenceState).toBe("offline");
      expect(liveState.presenceStatusHeadline).toBe("Logan is offline.");
      expect(liveState.presenceStatusHeadline).not.toContain("online");
      expect(liveState.currentActivity.type).toBe("quiet");
      expect(liveState.currentActivity.actionLabel).toBe("Leave a Whisper Note");
      expect(liveState.currentActivity.actionLabel).not.toContain("Enter Shared Room");
    });

    it("State D: authenticated + couple exists + partner online truthfully reflects online partner", async () => {
      const liveState = await service.fetchLiveHomeData("user_coupled_custom_1");
      expect(liveState.connectionStatus).toBe("connected");
      expect(liveState.partner).not.toBeNull();
      expect(liveState.partner?.displayName).toBe("Taylor");
      expect(liveState.partner?.presenceState).toBe("online");
      expect(liveState.presenceStatusHeadline).toBe("Taylor is online.");
      expect(liveState.currentActivity.type).toBe("synced");
      expect(liveState.currentActivity.actionLabel).toContain("Play with Taylor");
    });

    it("State F (Scenario 2): authenticated + incomplete partner profile returns truthful setup pending state", async () => {
      const liveState = await service.fetchLiveHomeData("user_with_incomplete_partner");
      expect(liveState.connectionStatus).toBe("incomplete_partner_profile");
      expect(liveState.partner).not.toBeNull();
      expect(liveState.partner?.displayName).toBe("Partner");
      expect(liveState.partner?.displayName).not.toBe("Sam");
      expect(liveState.partner?.presenceState).toBe("offline");
      expect(liveState.presenceStatusHeadline).toBe("Partner profile setup in progress.");
      expect(liveState.currentActivity.type).toBe("awaiting_partner");
      expect(liveState.currentActivity.badgeLabel).toBe("Profile Incomplete");
      expect(liveState.continueGame).toBeNull();
      expect(liveState.suggestedGame).toBeNull();
    });

    it("getPresetHomeData strictly disallows 'live' or unrecognized keys to prevent silent fallback to partner_online", () => {
      expect(() => getPresetHomeData("live")).toThrow(/cannot be called with 'live'/);
      expect(() => getPresetHomeData("invalid_preset" as any)).toThrow(/cannot provide data for/);
    });
  });
});

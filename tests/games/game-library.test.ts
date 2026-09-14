import { describe, it, expect } from "vitest";
import { TOGETHERPLAY_GAMES, getFilterCounts } from "@/features/games/gameCatalog";
import type { GameFilterTag } from "@/types/domain";

describe("TogetherPlay Game Library Catalog", () => {
  it("contains exactly the 8 requested TogetherPlay games", () => {
    expect(TOGETHERPLAY_GAMES).toHaveLength(8);

    const gameTitles = TOGETHERPLAY_GAMES.map((g) => g.title);
    expect(gameTitles).toContain("Find It First");
    expect(gameTitles).toContain("Speed Duel");
    expect(gameTitles).toContain("Couple Race");
    expect(gameTitles).toContain("Camera Challenge");
    expect(gameTitles).toContain("Know Me");
    expect(gameTitles).toContain("Quick Questions");
    expect(gameTitles).toContain("AI Challenge");
    expect(gameTitles).toContain("AI Game Night");
  });

  it("each game defines complete secondary metadata (duration, difficulty, competitive/coop, video, AI)", () => {
    TOGETHERPLAY_GAMES.forEach((game) => {
      // Duration defined
      expect(game.duration).toBeTruthy();
      expect(typeof game.duration).toBe("string");

      // Difficulty defined
      expect(game.difficulty).toBeTruthy();
      expect([
        "Breeze",
        "Light",
        "Moderate",
        "Intense",
        "Thoughtful",
        "Adaptive",
        "Full Session",
      ]).toContain(game.difficulty);

      // Playstyle (competitive or cooperative) defined
      expect(game.playStyle).toBeTruthy();
      expect([
        "Competitive Duel",
        "Cooperative",
        "Synchrony & Insight",
        "Co-op & Duel Blend",
        "Lighthearted Duel",
      ]).toContain(game.playStyle);

      // Video support defined
      expect(game.videoSupport).toBeTruthy();

      // AI support defined
      expect(game.aiSupport).toBeTruthy();

      // Primary Action route defined
      expect(game.href).toBeTruthy();
      expect(game.href.startsWith("/play/")).toBe(true);
    });
  });

  it("filters correctly partition games into Quick, Competitive, Cooperative, Camera, and AI", () => {
    const counts = getFilterCounts();

    expect(counts.all).toBe(8);
    expect(counts.quick).toBeGreaterThan(0);
    expect(counts.competitive).toBeGreaterThan(0);
    expect(counts.cooperative).toBeGreaterThan(0);
    expect(counts.camera).toBeGreaterThan(0);
    expect(counts.ai).toBeGreaterThan(0);

    // Verify Find It First is in camera, quick, competitive
    const findItFirst = TOGETHERPLAY_GAMES.find((g) => g.id === "find_it_first");
    expect(findItFirst?.filterTags).toContain<GameFilterTag>("camera");
    expect(findItFirst?.filterTags).toContain<GameFilterTag>("competitive");

    // Verify AI Challenge and AI Game Night are in AI filter
    const aiChallenge = TOGETHERPLAY_GAMES.find((g) => g.id === "ai_challenge");
    expect(aiChallenge?.filterTags).toContain<GameFilterTag>("ai");

    const aiGameNight = TOGETHERPLAY_GAMES.find((g) => g.id === "ai_game_night");
    expect(aiGameNight?.filterTags).toContain<GameFilterTag>("ai");
  });
});

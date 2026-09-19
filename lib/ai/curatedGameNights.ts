import type { GameNightLineup } from "./gameNightTypes";

export const CURATED_GAME_NIGHT_LINEUPS: GameNightLineup[] = [
  {
    id: "lineup_meridian_rendezvous",
    theme: "The Meridian Rendezvous",
    themeDescription:
      "A 5-round sensory journey across 9,560 km. Blending rapid reflexes, unspoken intuition, and dual camera shared moments.",
    hostWelcome:
      "Good evening, Alex and Sam. TogetherPlay has prepared tonight's private sanctuary. Settle in with your favorite drinks across London and Tokyo—five curated rituals await.",
    totalRounds: 5,
    isAIGenerated: false,
    createdAt: new Date().toISOString(),
    partnerNames: { p1: "Alex", p2: "Sam" },
    partnerCities: { p1: "London", p2: "Tokyo" },
    activities: [
      {
        id: "act_1",
        roundNumber: 1,
        type: "find_it_first",
        title: "Find It First: Midnight Relics",
        subtitle: "Tactile item scan & rapid reaction",
        hostIntro:
          "Let's awaken your senses. A target relic is hidden on your board—first partner to spot and lock the coordinate claims round one.",
        estimatedMinutes: 3,
        promptData: {
          prompt: "Locate the designated meridian relic before the sensory timer elapses.",
          category: "Tactile Scavenger",
          guidance: "Speed counts, but precision avoids false taps.",
        },
        status: "upcoming",
      },
      {
        id: "act_2",
        roundNumber: 2,
        type: "quick_question",
        title: "Quick Question: Unspoken Intuition",
        subtitle: "Double-blind synchrony reveal",
        hostIntro:
          "Now, step into each other's minds. You will both answer simultaneously in secret. Your truths only unveil once both answers are locked.",
        estimatedMinutes: 2,
        promptData: {
          prompt: "If you could teleport to one shared memory right now for 10 minutes, where are you?",
          options: [
            "Our favorite late-night ramen alley",
            "The quiet bridge walking back under streetlights",
            "Lazy Sunday morning listening to vinyl",
            "The departure terminal before our next reunion",
          ],
          category: "Shared Lore",
          guidance: "Go with your immediate intuition—no second guessing.",
        },
        status: "upcoming",
      },
      {
        id: "act_3",
        roundNumber: 3,
        type: "camera_challenge",
        title: "Camera Challenge: The Meridian Portal",
        subtitle: "Live camera mirror & reciprocal pose",
        hostIntro:
          "Turn to your screens. This round requires both of you live on camera: frame an identical cozy gesture across London and Tokyo.",
        estimatedMinutes: 3,
        promptData: {
          prompt: "Both hold up your current drink or mug to the lens, smile, and execute a simultaneous virtual toast!",
          category: "Video Reciprocity",
          guidance: "Hold the toast for 3 seconds until the portal locks.",
        },
        status: "upcoming",
      },
      {
        id: "act_4",
        roundNumber: 4,
        type: "speed_duel",
        title: "Speed Duel: Millimeter Shift",
        subtitle: "Audio pitch shift & millisecond reflex",
        hostIntro:
          "High tension returns. A steady carrier frequency is humming between you. The exact instant the pitch breaks, tap with lightning speed.",
        estimatedMinutes: 2,
        promptData: {
          prompt: "React to the frequency shift within a fraction of a millisecond.",
          category: "Reflex Duel",
          guidance: "Don't jump early—false triggers yield the round.",
        },
        status: "upcoming",
      },
      {
        id: "act_5",
        roundNumber: 5,
        type: "final_challenge",
        title: "Final Challenge: Meridian Synchrony",
        subtitle: "The Grand Finale Wavelength Showdown",
        hostIntro:
          "The climax of tonight's game night. One final cooperative decision to seal your evening score across the timezones.",
        estimatedMinutes: 4,
        promptData: {
          prompt: "Pick the exact promise you both want to make for this upcoming weekend.",
          options: [
            "A full 2-hour uninterrupted virtual date with candles",
            "Watch a long film together in real-time sync",
            "Send each other a physical postcard or small surprise parcel",
            "Plan our next travel itinerary itinerary step by step",
          ],
          category: "Wavelength Finale",
          guidance: "If your choices harmonize, earn the Grand Synchrony badge!",
        },
        status: "upcoming",
      },
    ],
  },
  {
    id: "lineup_playful_rivalry",
    theme: "Playful Spark & Rapid Duels",
    themeDescription:
      "A fast-paced, high-laughter contest designed to test who has the quickest fingers and the sharpest radar.",
    hostWelcome:
      "Welcome to Tonight's Duel, Alex and Sam. The stakes: whoever wins tonight's 5-round gauntlet gets breakfast ordered for them on the next reunion morning.",
    totalRounds: 5,
    isAIGenerated: false,
    createdAt: new Date().toISOString(),
    partnerNames: { p1: "Alex", p2: "Sam" },
    partnerCities: { p1: "London", p2: "Tokyo" },
    activities: [
      {
        id: "act_1",
        roundNumber: 1,
        type: "find_it_first",
        title: "Find It First: Radar Sweep",
        subtitle: "Grid search speed trial",
        hostIntro: "First test of the night: spot the glowing meridian artifact on your board before your partner does.",
        estimatedMinutes: 2,
        promptData: {
          prompt: "Scan the 4x4 matrix and tap the target artifact immediately.",
          category: "Rapid Scan",
          guidance: "Eyes sharp!",
        },
        status: "upcoming",
      },
      {
        id: "act_2",
        roundNumber: 2,
        type: "quick_question",
        title: "Quick Question: Who Knows Who?",
        subtitle: "Instant reaction dilemma",
        hostIntro: "A rapid test of couple facts. Answer honestly—no hesitation allowed.",
        estimatedMinutes: 2,
        promptData: {
          prompt: "Between the two of you, who would survive longer on a remote deserted island?",
          options: [
            "Definitely Alex (resourceful & calm)",
            "Definitely Sam (adaptable & determined)",
            "We would build a luxury bamboo villa together",
            "Both of us would panic within 45 minutes",
          ],
          category: "Playful Trivia",
          guidance: "Select simultaneously!",
        },
        status: "upcoming",
      },
      {
        id: "act_3",
        roundNumber: 3,
        type: "camera_challenge",
        title: "Camera Challenge: High-Speed Mirror",
        subtitle: "Live camera double mirror",
        hostIntro: "Look right at the camera. Replicate the partner's funny pose within 5 seconds.",
        estimatedMinutes: 3,
        promptData: {
          prompt: "Strike your most dramatic spy pose toward the lens and freeze!",
          category: "Pose Synchrony",
          guidance: "Lock the pose until verified.",
        },
        status: "upcoming",
      },
      {
        id: "act_4",
        roundNumber: 4,
        type: "speed_duel",
        title: "Speed Duel: Sudden Shift",
        subtitle: "Pure reflex reaction",
        hostIntro: "Round 4 is pure twitch reflex. Keep your finger hovering over the pad.",
        estimatedMinutes: 2,
        promptData: {
          prompt: "Tap the instant the trigger turns crimson.",
          category: "Speed Duel",
          guidance: "Millisecond precision.",
        },
        status: "upcoming",
      },
      {
        id: "act_5",
        roundNumber: 5,
        type: "final_challenge",
        title: "Final Challenge: Crown Decider",
        subtitle: "Grand Meridian tie-breaker",
        hostIntro: "The deciding match. Lock in your final prediction to settle the evening scoreboard.",
        estimatedMinutes: 3,
        promptData: {
          prompt: "Who will wake up first tomorrow morning?",
          options: [
            "Alex in London",
            "Sam in Tokyo",
            "Simultaneous alarm ring",
            "Whoever gets a coffee delivery first",
          ],
          category: "Final Wager",
          guidance: "Highest score takes the evening trophy!",
        },
        status: "upcoming",
      },
    ],
  },
];

export function getCuratedGameNight(
  themePreference?: string,
  partnerNames?: { p1?: string; p2?: string },
  partnerCities?: { p1?: string; p2?: string }
): GameNightLineup {
  const p1Name = partnerNames?.p1 || "Alex";
  const p2Name = partnerNames?.p2 || "Sam";
  const p1City = partnerCities?.p1 || "London";
  const p2City = partnerCities?.p2 || "Tokyo";

  const base =
    themePreference === "competitive"
      ? CURATED_GAME_NIGHT_LINEUPS[1]
      : CURATED_GAME_NIGHT_LINEUPS[0];

  // Clone and adapt to partner names
  return {
    ...base,
    id: `lineup_${Date.now()}`,
    title: base.theme,
    createdAt: new Date().toISOString(),
    partnerNames: { p1: p1Name, p2: p2Name },
    partnerCities: { p1: p1City, p2: p2City },
    hostWelcome: base.hostWelcome
      .replace(/Alex/g, p1Name)
      .replace(/Sam/g, p2Name)
      .replace(/London/g, p1City)
      .replace(/Tokyo/g, p2City),
  };
}

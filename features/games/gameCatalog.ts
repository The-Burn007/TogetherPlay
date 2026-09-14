import type { GameExperienceMetadata, GameFilterTag } from "@/types/domain";

export const TOGETHERPLAY_GAMES: GameExperienceMetadata[] = [
  {
    id: "find_it_first",
    title: "Find It First",
    subtitle: "Dual camera real-world artifact detection",
    description:
      "A fast-paced sensory duel where partners scan their rooms in London and Tokyo to detect matching tactile items through dual video feeds.",
    duration: "4 mins",
    difficulty: "Moderate",
    playStyle: "Competitive Duel",
    videoSupport: "Dual Camera",
    aiSupport: "Object Vision",
    filterTags: ["quick", "competitive", "camera"],
    badgeLabel: "Featured Duel",
    badgeVariant: "amber",
    href: "/play/find-it-first",
  },
  {
    id: "speed_duel",
    title: "Speed Duel",
    subtitle: "Sensory reflex & millimeter reaction",
    description:
      "Tension builds as a shared audio-visual frequency hums. First partner to react when the tone shifts claims the meridian round.",
    duration: "3 mins",
    difficulty: "Intense",
    playStyle: "Competitive Duel",
    videoSupport: "Live Sync Video",
    aiSupport: "None",
    filterTags: ["quick", "competitive"],
    badgeLabel: "High Tension",
    badgeVariant: "ember",
    href: "/play/speed_duel",
  },
  {
    id: "couple_race",
    title: "Couple Race",
    subtitle: "The Great Meridian 9,560 km expedition",
    description:
      "A tabletop isometric journey across coordinates and weather biomes. Coordinate dice rolls and decisions to navigate your shared caravan.",
    duration: "8 mins",
    difficulty: "Moderate",
    playStyle: "Cooperative",
    videoSupport: "Optional Audio/Video",
    aiSupport: "Procedural Biomes",
    filterTags: ["cooperative"],
    badgeLabel: "Expedition",
    badgeVariant: "sage",
    href: "/play/couple_race",
  },
  {
    id: "camera_challenge",
    title: "Camera Challenge",
    subtitle: "IRL intimate scavenger hunt",
    description:
      "Spontaneous reciprocal photo prompts: 'Show something you bought together' or 'A view from your morning window'. Unveil simultaneously.",
    duration: "3 mins",
    difficulty: "Breeze",
    playStyle: "Cooperative",
    videoSupport: "Rear Camera Snap",
    aiSupport: "None",
    filterTags: ["quick", "cooperative", "camera"],
    badgeLabel: "Polaroid Snap",
    badgeVariant: "neutral",
    href: "/play/camera_challenge",
  },
  {
    id: "know_me",
    title: "Know Me",
    subtitle: "Double-blind relationship synchrony",
    description:
      "Answer deep relationship questions and moral dilemmas in secret. Answers only unveil once both partners have submitted their truths.",
    duration: "6 mins",
    difficulty: "Thoughtful",
    playStyle: "Synchrony & Insight",
    videoSupport: "Optional Audio",
    aiSupport: "None",
    filterTags: ["cooperative"],
    badgeLabel: "Wavelength",
    badgeVariant: "sage",
    href: "/play/know_me",
  },
  {
    id: "quick_questions",
    title: "Quick Questions",
    subtitle: "60-second rapid intuition flashes",
    description:
      "A flurry of lighthearted choice prompts to test subconscious alignment. Fast taps, zero overthinking, pure intuitive sparks.",
    duration: "2 mins",
    difficulty: "Breeze",
    playStyle: "Lighthearted Duel",
    videoSupport: "None (Touch & Voice)",
    aiSupport: "None",
    filterTags: ["quick", "competitive"],
    badgeLabel: "Rapid Sparks",
    badgeVariant: "amber",
    href: "/play/quick_questions",
  },
  {
    id: "ai_challenge",
    title: "AI Challenge",
    subtitle: "Gemini-powered dynamic relationship quest",
    description:
      "TogetherPlay's AI crafts custom riddles, creative role-play scenarios, and scavenger prompts derived from your relationship history.",
    duration: "5 mins",
    difficulty: "Adaptive",
    playStyle: "Cooperative",
    videoSupport: "Optional Video",
    aiSupport: "Gemini 2.5 Flash",
    filterTags: ["quick", "cooperative", "ai"],
    badgeLabel: "Generative",
    badgeVariant: "amber",
    href: "/play/ai_challenge",
  },
  {
    id: "ai_game_night",
    title: "AI Game Night",
    subtitle: "Curated 4-round relationship game show",
    description:
      "A complete evening ritual. Your personal AI host guides you both through 4 themed rounds: personal lore trivia, audio riddles, photo hunts, and grand synchrony.",
    duration: "15-20 mins",
    difficulty: "Full Session",
    playStyle: "Co-op & Duel Blend",
    videoSupport: "Dual Video Recommended",
    aiSupport: "AI Host & Dynamic Rounds",
    filterTags: ["competitive", "cooperative", "camera", "ai"],
    badgeLabel: "Evening Show",
    badgeVariant: "amber",
    href: "/play/ai_game_night",
  },
];

export function getFilterCounts(): Record<"all" | GameFilterTag, number> {
  const counts: Record<"all" | GameFilterTag, number> = {
    all: TOGETHERPLAY_GAMES.length,
    quick: 0,
    competitive: 0,
    cooperative: 0,
    camera: 0,
    ai: 0,
  };

  TOGETHERPLAY_GAMES.forEach((game) => {
    game.filterTags.forEach((tag) => {
      counts[tag] += 1;
    });
  });

  return counts;
}

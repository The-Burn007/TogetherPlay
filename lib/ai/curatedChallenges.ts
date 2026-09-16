import type {
  AIChallenge,
  AIChallengeCategory,
  AIChallengeDifficulty,
} from "@/types/domain";

export const CURATED_CHALLENGES: AIChallenge[] = [
  // 1. Relationship Questions
  {
    id: "curated_rq_1",
    title: "The Unsung Moment",
    instructions:
      "Take turns sharing a small, unglamorous moment from this past year when you felt deeply loved by your partner without them saying a word.",
    durationSeconds: 120,
    difficulty: "deep",
    category: "relationship_question",
    safetyLevel: "intimate_couple",
    isAIGenerated: false,
    generatedAt: 1700000000000,
    tags: ["memory", "gratitude", "intimacy"],
  },
  {
    id: "curated_rq_2",
    title: "First Impression vs Reality",
    instructions:
      "Recall the first 10 minutes you ever spent together. What was one thing you assumed about the other that turned out to be delightfully wrong?",
    durationSeconds: 90,
    difficulty: "playful",
    category: "relationship_question",
    safetyLevel: "intimate_couple",
    isAIGenerated: false,
    generatedAt: 1700000000000,
    tags: ["nostalgia", "playful"],
  },
  {
    id: "curated_rq_3",
    title: "The 3-Year Time Capsule",
    instructions:
      "If you could fast-forward three years into your future living room, what is one quirky routine you hope you both still have?",
    durationSeconds: 90,
    difficulty: "gentle",
    category: "relationship_question",
    safetyLevel: "family_safe",
    isAIGenerated: false,
    generatedAt: 1700000000000,
    tags: ["future", "bonding"],
  },

  // 2. Camera Challenges
  {
    id: "curated_cc_1",
    title: "The Texture Quest",
    instructions:
      "Within 45 seconds, locate and bring to camera an object in your room with the most interesting tactile texture. Explain why you chose it.",
    durationSeconds: 45,
    difficulty: "playful",
    category: "camera_challenge",
    safetyLevel: "family_safe",
    isAIGenerated: false,
    generatedAt: 1700000000000,
    tags: ["real-world", "camera", "scavenger"],
  },
  {
    id: "curated_cc_2",
    title: "Mirror Pose Synchrony",
    instructions:
      "Partner A strikes an expressive pose on camera without moving. Partner B has 10 seconds to replicate it down to the exact eyebrow arch.",
    durationSeconds: 30,
    difficulty: "playful",
    category: "camera_challenge",
    safetyLevel: "family_safe",
    isAIGenerated: false,
    generatedAt: 1700000000000,
    tags: ["physical", "camera", "laughter"],
  },
  {
    id: "curated_cc_3",
    title: "Window Horizon Reveal",
    instructions:
      "Take your camera or laptop to your nearest window. Show your partner your current sky, weather, and light right at this very moment.",
    durationSeconds: 60,
    difficulty: "gentle",
    category: "camera_challenge",
    safetyLevel: "family_safe",
    isAIGenerated: false,
    generatedAt: 1700000000000,
    tags: ["distance", "skyline", "presence"],
  },

  // 3. Quick Games
  {
    id: "curated_qg_1",
    title: "Double-Blind Word Association",
    instructions:
      "On the count of three, both say the first food that comes to mind when hearing the word 'Sunday'. If you match or rhyme, celebrate!",
    durationSeconds: 30,
    difficulty: "gentle",
    category: "quick_game",
    safetyLevel: "family_safe",
    isAIGenerated: false,
    generatedAt: 1700000000000,
    tags: ["rapid", "telepathy", "instinct"],
  },
  {
    id: "curated_qg_2",
    title: "Rapid Intuition Duel",
    instructions:
      "Partner A asks three rapid-fire 'Would You Rather' questions in 45 seconds. Partner B must answer instantly without pausing to justify.",
    durationSeconds: 45,
    difficulty: "playful",
    category: "quick_game",
    safetyLevel: "family_safe",
    isAIGenerated: false,
    generatedAt: 1700000000000,
    tags: ["speed", "instinct", "humor"],
  },

  // 4. Fun Challenges
  {
    id: "curated_fc_1",
    title: "The Accidental Masterpiece",
    instructions:
      "Grab a pen and scrap paper. You have 30 seconds to sketch your partner from memory with your non-dominant hand. Reveal together!",
    durationSeconds: 45,
    difficulty: "playful",
    category: "fun_challenge",
    safetyLevel: "family_safe",
    isAIGenerated: false,
    generatedAt: 1700000000000,
    tags: ["sketch", "laughter", "creative"],
  },
  {
    id: "curated_fc_2",
    title: "The Silent Movie Drama",
    instructions:
      "You have 40 seconds to act out a dramatic scene (e.g. dramatic heartbreak over a burnt piece of toast) on mute. Partner guesses the exact plot.",
    durationSeconds: 45,
    difficulty: "playful",
    category: "fun_challenge",
    safetyLevel: "family_safe",
    isAIGenerated: false,
    generatedAt: 1700000000000,
    tags: ["acting", "charades", "humor"],
  },

  // 5. Conversation Prompts
  {
    id: "curated_cp_1",
    title: "Parallel Solitude",
    instructions:
      "When we are apart in our own cities, what is your favorite solitary ritual that makes you feel peaceful and restored?",
    durationSeconds: 120,
    difficulty: "deep",
    category: "conversation_prompt",
    safetyLevel: "family_safe",
    isAIGenerated: false,
    generatedAt: 1700000000000,
    tags: ["solitude", "restoration", "empathy"],
  },
  {
    id: "curated_cp_2",
    title: "The Unexpected Anchor",
    instructions:
      "What is something small your partner does regularly that grounds you when your day is hectic or chaotic?",
    durationSeconds: 90,
    difficulty: "gentle",
    category: "conversation_prompt",
    safetyLevel: "intimate_couple",
    isAIGenerated: false,
    generatedAt: 1700000000000,
    tags: ["grounding", "appreciation"],
  },
];

/**
 * Retrieve a random curated challenge, optionally filtered by category and difficulty.
 */
export function getCuratedChallenge(
  category?: AIChallengeCategory,
  difficulty?: AIChallengeDifficulty
): AIChallenge {
  let filtered = CURATED_CHALLENGES;
  if (category) {
    const matchedCategory = filtered.filter((c) => c.category === category);
    if (matchedCategory.length > 0) filtered = matchedCategory;
  }
  if (difficulty) {
    const matchedDiff = filtered.filter((c) => c.difficulty === difficulty);
    if (matchedDiff.length > 0) filtered = matchedDiff;
  }

  const selected = filtered[Math.floor(Math.random() * filtered.length)];
  return {
    ...selected,
    id: `curated_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    generatedAt: Date.now(),
  };
}

import { z } from "zod";

export type GameNightActivityType =
  | "find_it_first"
  | "quick_question"
  | "camera_challenge"
  | "speed_duel"
  | "final_challenge";

export type GameNightVibe = "balanced" | "cozy" | "competitive" | "deep_connection";

export interface GameNightPromptData {
  prompt: string;
  options?: string[];
  category: string;
  guidance: string;
}

export interface GameNightActivityResult {
  completedAt: string;
  winnerId: string | null; // "user_alex" | "user_sam" | null (tie)
  winnerName: string | null;
  scores: {
    p1: number;
    p2: number;
  };
  summary: string;
  funMoment: string;
}

export interface GameNightActivity {
  id: string;
  roundNumber: number;
  type: GameNightActivityType;
  title: string;
  subtitle: string;
  hostIntro: string;
  estimatedMinutes: number;
  promptData: GameNightPromptData;
  status: "upcoming" | "current" | "intermission" | "completed";
  result?: GameNightActivityResult;
}

export interface GameNightLineup {
  id: string;
  theme: string;
  title?: string;
  themeDescription: string;
  hostWelcome: string;
  activities: GameNightActivity[];
  totalRounds: number;
  isAIGenerated: boolean;
  createdAt: string;
  partnerNames: {
    p1: string;
    p2: string;
  };
  partnerCities: {
    p1: string;
    p2: string;
  };
}

export interface GameNightOverallResult {
  lineupId: string;
  theme: string;
  totalScore: {
    p1: number;
    p2: number;
  };
  roundWins: {
    p1: number;
    p2: number;
    ties: number;
  };
  overallWinnerId: string | null;
  overallWinnerName: string | null;
  isTie: boolean;
  meridianSynchronyPercentage: number;
  funMoments: string[];
  completedAt: string;
}

// ---------------------------------------------------------------------------
// Zod Schemas for Server Validation
// ---------------------------------------------------------------------------
export const GameNightPromptDataSchema = z
  .object({
    prompt: z.string().min(5).max(300),
    options: z.array(z.string().min(1).max(100)).optional(),
    category: z.string().min(2).max(50),
    guidance: z.string().min(5).max(200),
  })
  .strict();

export const GameNightActivitySchema = z
  .object({
    id: z.string().optional(),
    roundNumber: z.number().int().min(1).max(10),
    type: z.enum([
      "find_it_first",
      "quick_question",
      "camera_challenge",
      "speed_duel",
      "final_challenge",
    ]),
    title: z.string().min(3).max(80),
    subtitle: z.string().min(3).max(120),
    hostIntro: z.string().min(10).max(280),
    estimatedMinutes: z.number().min(1).max(15),
    promptData: GameNightPromptDataSchema,
    status: z.enum(["upcoming", "current", "completed"]).optional(),
  })
  .strict();

export const GameNightLineupSchema = z
  .object({
    id: z.string().optional(),
    theme: z.string().min(3).max(80),
    title: z.string().min(3).max(80).optional(),
    themeDescription: z.string().min(10).max(250),
    hostWelcome: z.string().min(20).max(400),
    activities: z.array(GameNightActivitySchema).length(5),
    totalRounds: z.number().optional(),
    isAIGenerated: z.boolean().optional(),
    createdAt: z.string().optional(),
    partnerNames: z
      .object({
        p1: z.string(),
        p2: z.string(),
      })
      .optional(),
    partnerCities: z
      .object({
        p1: z.string(),
        p2: z.string(),
      })
      .optional(),
  })
  .strict();

export type ValidatedGameNightLineup = z.infer<typeof GameNightLineupSchema>;

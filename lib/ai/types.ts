/**
 * Gemini AI Domain Contracts for TogetherPlay
 * 
 * Supports:
 * 1. AI Game Night: Host Mode (dynamic customized trivia & inside joke rounds)
 * 2. Relationship Daily Spark Prompts
 * 3. Memory & Photo finish commentary
 */

export interface AiPromptRequest {
  coupleId: string;
  category: "daily_spark" | "game_host_round" | "photo_commentary";
  parameters?: Record<string, unknown>;
}

export interface AiHostRoundData {
  roundTitle: string;
  theme: string;
  curatedPrompt: string;
  suggestedDurationSeconds: number;
}

export interface DailySparkData {
  questionId: string;
  questionText: string;
  category: "nostalgia" | "values" | "hypothetical" | "silly";
}

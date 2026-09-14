import type { AiPromptRequest, DailySparkData } from "./types";

/**
 * AI Client Abstraction
 * 
 * Proxies calls to server-side Next.js route handlers (/api/gemini/*).
 * Strictly prevents any direct Gemini API keys from leaking to client components.
 */
export interface AiClientContract {
  fetchDailySpark(coupleId: string): Promise<DailySparkData>;
}

export class TogetherPlayAiClient implements AiClientContract {
  async fetchDailySpark(_coupleId: string): Promise<DailySparkData> {
    // Architecture hook for server API route
    return {
      questionId: "spark-devon-roadtrip",
      questionText: "What song instantly takes you back to our rainy road trip through Devon?",
      category: "nostalgia",
    };
  }
}

export const aiClient = new TogetherPlayAiClient();

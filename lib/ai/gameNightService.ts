import { GoogleGenAI, Type } from "@google/genai";
import {
  GameNightLineupSchema,
  type GameNightLineup,
  type GameNightVibe,
} from "./gameNightTypes";
import { getCuratedGameNight } from "./curatedGameNights";
import { sanitizeUntrustedInput } from "./geminiChallengeService";
import {
  type RateLimitPromise,
  type RateLimitResult,
} from "./geminiChallengeService";

// ---------------------------------------------------------------------------
// Rate Limiting for Game Night Generation (4 per minute max per couple)
// Dual-mode: Local memory fallback + hookable shared authority for server routes
// ---------------------------------------------------------------------------
interface RateLimitRecord {
  timestamps: number[];
}

type RateLimitChecker = (key: string, ip?: string) => RateLimitPromise;

const gameNightRateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 4;
const MAX_RATE_LIMIT_KEYS = 1000;

let customGameNightRateLimiter: RateLimitChecker | null = null;

export function setGameNightRateLimiterHook(hook: RateLimitChecker | null): void {
  customGameNightRateLimiter = hook;
}

export function clearGameNightRateLimitForTesting(): void {
  gameNightRateLimitMap.clear();
}

/**
 * Checks game night generation rate limit.
 * Supports dual-mode: synchronous property access or awaitable promise.
 */
export function checkGameNightRateLimit(key: string, ip?: string): RateLimitPromise {
  if (customGameNightRateLimiter) {
    return customGameNightRateLimiter(key, ip);
  }

  const now = Date.now();

  if (gameNightRateLimitMap.size > MAX_RATE_LIMIT_KEYS) {
    for (const [k, v] of gameNightRateLimitMap.entries()) {
      v.timestamps = v.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (v.timestamps.length === 0) gameNightRateLimitMap.delete(k);
    }
  }

  let record = gameNightRateLimitMap.get(key);

  if (!record) {
    record = { timestamps: [] };
    gameNightRateLimitMap.set(key, record);
  }

  // Filter timestamps outside current sliding window
  record.timestamps = record.timestamps.filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );

  if (record.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = record.timestamps[0];
    const resetInSeconds = Math.max(
      1,
      Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000)
    );
    const result: RateLimitResult = {
      allowed: false,
      remaining: 0,
      resetInSeconds,
      source: "local_fallback",
      key,
    };
    return Object.assign(Promise.resolve(result), result);
  }

  record.timestamps.push(now);
  const remaining = MAX_REQUESTS_PER_WINDOW - record.timestamps.length;
  const result: RateLimitResult = {
    allowed: true,
    remaining,
    resetInSeconds: 60,
    source: "local_fallback",
    key,
  };
  return Object.assign(Promise.resolve(result), result);
}

// ---------------------------------------------------------------------------
// Lazy Gemini Client
// ---------------------------------------------------------------------------
let cachedAiClient: GoogleGenAI | null = null;
let lastApiKey: string | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    cachedAiClient = null;
    lastApiKey = null;
    return null;
  }
  if (!cachedAiClient || lastApiKey !== apiKey) {
    lastApiKey = apiKey;
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return cachedAiClient;
}

export interface GenerateGameNightParams {
  partnerNames?: { p1?: string; p2?: string };
  partnerCities?: { p1?: string; p2?: string };
  vibe?: GameNightVibe;
  untrustedThemeHint?: string;
  timeoutMs?: number;
}

export async function generateGameNightLineup(
  params: GenerateGameNightParams
): Promise<{
  lineup: GameNightLineup;
  isFallback: boolean;
  fallbackReason?: string;
}> {
  const p1Name = sanitizeUntrustedInput(params.partnerNames?.p1 || "Alex");
  const p2Name = sanitizeUntrustedInput(params.partnerNames?.p2 || "Sam");
  const p1City = sanitizeUntrustedInput(params.partnerCities?.p1 || "London");
  const p2City = sanitizeUntrustedInput(params.partnerCities?.p2 || "Tokyo");
  const vibe = params.vibe || "balanced";
  const sanitizedHint = sanitizeUntrustedInput(params.untrustedThemeHint);

  const fallbackLineup = getCuratedGameNight(vibe, { p1: p1Name, p2: p2Name }, { p1: p1City, p2: p2City });

  const ai = getGeminiClient();
  if (!ai) {
    return {
      lineup: fallbackLineup,
      isFallback: true,
      fallbackReason: "gemini_api_key_not_configured",
    };
  }

  const systemInstruction = `
You are TogetherPlay's Game Night Host & Evening Curator.
TogetherPlay is a private sanctuary for couples staying connected across distance (${p1City} and ${p2City}).
Your task is to curate Tonight's Lineup for ${p1Name} and ${p2Name}.

STRICT ARCHITECTURAL RULE:
You curate and generate the activity titles, host notes, and prompts ONLY.
Deterministic game engines run the activities.
You DO NOT determine scores, winners, dice, timers, or permissions.

STRICT 5-ROUND SEQUENCE REQUIRED:
Round 1: type "find_it_first" (Visual/tactile artifact hunt)
Round 2: type "quick_question" (Double-blind synchrony question with 4 options)
Round 3: type "camera_challenge" (Live dual camera gesture, toast, or mirror pose)
Round 4: type "speed_duel" (Millisecond reflex reaction prompt)
Round 5: type "final_challenge" (Grand finale synchrony dilemma with 4 options)

Tone: Warm, intimate, witty, celebratory. No cheesy robots, magic wands, or generic AI buzzwords.
`.trim();

  const userPrompt = `
Curate tonight's 5-round Game Night for ${p1Name} (${p1City}) and ${p2Name} (${p2City}).
Evening Vibe: ${vibe}.
Optional Theme Note: <untrusted_theme_hint>${sanitizedHint || "evening rendezvous"}</untrusted_theme_hint>.

Generate a cohesive title, host welcome message, and tailored prompts for each round.
Round 2 and Round 5 MUST include 4 distinct playful options for the couple to choose from.
`.trim();

  const timeoutMs = params.timeoutMs || 8000;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("GEMINI_TIMEOUT")), timeoutMs);
    });

    const generatePromise = ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.8,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            theme: {
              type: Type.STRING,
              description: "Short evocative theme title (e.g. The Midnight Meridian)",
            },
            themeDescription: {
              type: Type.STRING,
              description: "1-2 sentence description of tonight's vibe",
            },
            hostWelcome: {
              type: Type.STRING,
              description: "Warm host welcome letter to the couple (2-3 sentences)",
            },
            activities: {
              type: Type.ARRAY,
              description: "Exact array of 5 curated activities in order",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  roundNumber: { type: Type.INTEGER },
                  type: {
                    type: Type.STRING,
                    enum: [
                      "find_it_first",
                      "quick_question",
                      "camera_challenge",
                      "speed_duel",
                      "final_challenge",
                    ],
                  },
                  title: { type: Type.STRING },
                  subtitle: { type: Type.STRING },
                  hostIntro: { type: Type.STRING },
                  estimatedMinutes: { type: Type.INTEGER },
                  promptData: {
                    type: Type.OBJECT,
                    properties: {
                      prompt: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      category: { type: Type.STRING },
                      guidance: { type: Type.STRING },
                    },
                    required: ["prompt", "category", "guidance"],
                  },
                },
                required: [
                  "id",
                  "roundNumber",
                  "type",
                  "title",
                  "subtitle",
                  "hostIntro",
                  "estimatedMinutes",
                  "promptData",
                ],
              },
            },
          },
          required: ["theme", "themeDescription", "hostWelcome", "activities"],
        },
      },
    });

    const response = (await Promise.race([
      generatePromise,
      timeoutPromise,
    ])) as { text?: string };

    const rawText = response.text;
    if (!rawText || rawText.trim().length === 0) {
      throw new Error("EMPTY_GEMINI_RESPONSE");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      throw new Error("MALFORMED_AI_OUTPUT");
    }

    const validation = GameNightLineupSchema.safeParse(parsedJson);
    if (!validation.success) {
      console.warn("Gemini Game Night output schema validation failed:", validation.error.format());
      throw new Error("SCHEMA_VIOLATION");
    }
    const validated = validation.data;

    // Format final lineup with IDs, status, and partner metadata
    const lineup: GameNightLineup = {
      id: `gn_${Date.now()}`,
      theme: validated.theme,
      title: validated.theme,
      themeDescription: validated.themeDescription,
      hostWelcome: validated.hostWelcome,
      totalRounds: 5,
      isAIGenerated: true,
      createdAt: new Date().toISOString(),
      partnerNames: { p1: p1Name, p2: p2Name },
      partnerCities: { p1: p1City, p2: p2City },
      activities: validated.activities.map((act, idx) => ({
        id: `act_${idx + 1}`,
        roundNumber: idx + 1,
        type: act.type,
        title: act.title,
        subtitle: act.subtitle,
        hostIntro: act.hostIntro,
        estimatedMinutes: act.estimatedMinutes,
        promptData: act.promptData,
        status: idx === 0 ? "current" : "upcoming",
      })),
    };

    return {
      lineup,
      isFallback: false,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn("AI Game Night generation fallback triggered:", errorMsg);

    let fallbackReason = "unexpected_error";
    if (errorMsg.includes("GEMINI_TIMEOUT")) fallbackReason = "timeout";
    else if (errorMsg.includes("EMPTY_GEMINI_RESPONSE")) fallbackReason = "empty_response";
    else if (errorMsg.includes("MALFORMED_AI_OUTPUT")) fallbackReason = "malformed_output";
    else if (errorMsg.includes("SCHEMA_VIOLATION")) fallbackReason = "schema_violation";
    else if (errorMsg.includes("gemini_api_key_not_configured")) fallbackReason = "gemini_api_key_not_configured";
    else fallbackReason = `provider_failure: ${errorMsg}`;

    return {
      lineup: fallbackLineup,
      isFallback: true,
      fallbackReason,
    };
  }
}

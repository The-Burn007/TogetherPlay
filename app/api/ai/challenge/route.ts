import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateAIChallenge,
  checkRateLimit,
  sanitizeUntrustedInput,
} from "@/lib/ai/geminiChallengeService";
import { getCuratedChallenge } from "@/lib/ai/curatedChallenges";
import type {
  AIChallengeCategory,
  AIChallengeDifficulty,
  AIChallengeResponse,
} from "@/types/domain";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Request Body Validation Schema
// ---------------------------------------------------------------------------
const ChallengeRequestSchema = z.object({
  category: z
    .enum([
      "relationship_question",
      "camera_challenge",
      "quick_game",
      "fun_challenge",
      "conversation_prompt",
    ])
    .optional(),
  difficulty: z.enum(["gentle", "playful", "deep", "spicy"]).optional(),
  partnerNames: z
    .object({
      p1: z.string().max(50).optional(),
      p2: z.string().max(50).optional(),
    })
    .optional(),
  partnerCities: z
    .object({
      p1: z.string().max(50).optional(),
      p2: z.string().max(50).optional(),
    })
    .optional(),
  topicHint: z.string().max(100).optional(),
});

/**
 * POST /api/ai/challenge
 *
 * Architecture Flow:
 * Client
 * -> Authenticated Server Endpoint
 * -> Validation (Zod & Input Sanitization)
 * -> Rate Limit (Token Bucket / Sliding Window)
 * -> Gemini API (gemini-3.8-flash, lazy initialized, server-only)
 * -> Schema Validation (Strict Zod check against expected properties)
 * -> Client (Returns structured challenge with fallback guarantee)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication Check
    const authHeader = request.headers.get("authorization");
    let uid: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      if (token.startsWith("uid:")) {
        uid = token.replace("uid:", "");
      } else if (token.length > 0) {
        uid = token;
      }
    }

    // In production, an authenticated context is mandatory.
    // In dev / test / sandbox, default to a session identifier if not supplied.
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const realIp = request.headers.get("x-real-ip")?.trim();
    const clientIp = forwardedFor || realIp || "unknown_client";
    const authIdentifier = uid || (process.env.NODE_ENV === "production" ? null : `dev_user_${clientIp}`);

    if (!authIdentifier) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHENTICATED",
          message: "Authentication required: Request does not contain a valid user token.",
          challenge: getCuratedChallenge(),
          isFallback: true,
        },
        { status: 401 }
      );
    }

    // 2. Rate Limiting Check
    const rateLimitKey = `ai_challenge_${authIdentifier}`;
    const rateLimit = checkRateLimit(rateLimitKey);

    if (!rateLimit.allowed) {
      // Return 429 along with a curated challenge so user is never blocked
      return NextResponse.json(
        {
          success: false,
          error: "RATE_LIMIT_EXCEEDED",
          message: `Generation rate limit reached. Please wait ${rateLimit.resetInSeconds} seconds or use our curated relationship challenges.`,
          challenge: getCuratedChallenge(),
          isFallback: true,
          rateLimit: {
            remaining: 0,
            resetInSeconds: rateLimit.resetInSeconds,
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimit.resetInSeconds.toString(),
          },
        }
      );
    }

    // 3. Request Body Parsing & Validation
    let rawBody = {};
    try {
      rawBody = await request.json();
    } catch {
      // Body can be empty
    }

    const parseResult = ChallengeRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_REQUEST_PARAMETERS",
          message: parseResult.error.message,
          challenge: getCuratedChallenge(),
          isFallback: true,
        },
        { status: 400 }
      );
    }

    const { category, difficulty, partnerNames, partnerCities, topicHint } =
      parseResult.data;

    // Sanitize all untrusted text inputs and minimize private context
    const sanitizedPartnerNames = partnerNames
      ? {
          p1: partnerNames.p1 ? sanitizeUntrustedInput(partnerNames.p1).slice(0, 30) : undefined,
          p2: partnerNames.p2 ? sanitizeUntrustedInput(partnerNames.p2).slice(0, 30) : undefined,
        }
      : undefined;

    const sanitizedPartnerCities = partnerCities
      ? {
          p1: partnerCities.p1 ? sanitizeUntrustedInput(partnerCities.p1).slice(0, 30) : undefined,
          p2: partnerCities.p2 ? sanitizeUntrustedInput(partnerCities.p2).slice(0, 30) : undefined,
        }
      : undefined;

    // 4. Generate via Server-side Gemini with Schema Validation & Anti-Prompt-Injection
    const result = await generateAIChallenge({
      category: category as AIChallengeCategory,
      difficulty: difficulty as AIChallengeDifficulty,
      partnerNames: sanitizedPartnerNames,
      partnerCities: sanitizedPartnerCities,
      untrustedTopic: topicHint ? sanitizeUntrustedInput(topicHint) : undefined,
      timeoutMs: 8000,
    });

    const responsePayload: AIChallengeResponse = {
      success: true,
      challenge: result.challenge,
      isFallback: result.isFallback,
      fallbackReason: result.fallbackReason,
      rateLimit: {
        remaining: rateLimit.remaining,
        resetInSeconds: rateLimit.resetInSeconds,
      },
    };

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error) {
    console.error("[POST /api/ai/challenge] Unexpected error:", error);

    // Never break the user experience: always provide a standard curated challenge
    const fallback = getCuratedChallenge();
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: "A server issue occurred while crafting the challenge. Here is a curated challenge.",
        challenge: fallback,
        isFallback: true,
      },
      { status: 200 } // Return 200 with fallback so client can seamlessly proceed
    );
  }
}

/**
 * GET /api/ai/challenge
 * Instant access to a curated standard challenge (Offline-ready, zero latency)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = (searchParams.get("category") as AIChallengeCategory) || undefined;
  const difficulty = (searchParams.get("difficulty") as AIChallengeDifficulty) || undefined;

  const challenge = getCuratedChallenge(category, difficulty);

  return NextResponse.json(
    {
      success: true,
      challenge,
      isFallback: true,
      fallbackReason: "curated_requested",
    },
    { status: 200 }
  );
}

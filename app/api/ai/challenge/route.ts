import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateAIChallenge,
  checkRateLimit,
  sanitizeUntrustedInput,
} from "@/lib/ai/geminiChallengeService";
import { getCuratedChallenge } from "@/lib/ai/curatedChallenges";
import { requireServerAuth } from "@/lib/firebase/server/auth";
import { requireAppCheck } from "@/lib/firebase/server/security";
import {
  getClientIp,
  checkSharedRateLimit,
} from "@/lib/firebase/server/sharedRateLimiter";
import type {
  AIChallengeCategory,
  AIChallengeDifficulty,
  AIChallengeResponse,
} from "@/types/domain";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Request Body Validation Schema (Strict Defense-in-Depth)
// ---------------------------------------------------------------------------
const ChallengeRequestSchema = z
  .object({
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
        p1: z.string().min(1).max(50).optional(),
        p2: z.string().min(1).max(50).optional(),
      })
      .strict()
      .optional(),
    partnerCities: z
      .object({
        p1: z.string().min(1).max(50).optional(),
        p2: z.string().min(1).max(50).optional(),
      })
      .strict()
      .optional(),
    topicHint: z.string().max(100).optional(),
  })
  .strict();

const ChallengeQuerySchema = z
  .object({
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
  })
  .strict();

/**
 * POST /api/ai/challenge
 *
 * Architecture Flow:
 * Client
 * -> App Check Attestation (Untrusted client environment verification)
 * -> Authenticated Server Endpoint (Firebase Admin ID Token Verification)
 * -> Validation (Zod strict & Input Sanitization)
 * -> Rate Limit (Token Bucket / Sliding Window per verified UID)
 * -> Gemini API (gemini-3.8-flash, lazy initialized, server-only)
 * -> Schema Validation (Strict Zod check against expected properties)
 * -> Client (Returns structured challenge with fallback guarantee)
 */
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);

    // 1. App Check Attestation
    const appCheckResult = await requireAppCheck(request);
    if (!appCheckResult.success) {
      return appCheckResult.errorResponse;
    }

    // 2. IP / Network-level Protection Tier
    const ipRateLimit = await checkSharedRateLimit({
      key: `ip_ai_challenge_${clientIp}`,
      maxRequests: 20, // 20 requests per minute per IP
      windowMs: 60 * 1000,
      ip: clientIp,
    });

    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "RATE_LIMIT_EXCEEDED",
          message: `Generation rate limit reached for this network. Please wait ${ipRateLimit.resetInSeconds} seconds or use our curated relationship challenges.`,
          challenge: getCuratedChallenge(),
          isFallback: true,
          fallbackReason: "rate_limit_exceeded",
          rateLimit: {
            remaining: 0,
            resetInSeconds: ipRateLimit.resetInSeconds,
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": ipRateLimit.resetInSeconds.toString(),
          },
        }
      );
    }

    // 3. Authentication Check (Verified Firebase ID token only, never trust client-provided identity)
    const authResult = await requireServerAuth(request);
    if ("errorResponse" in authResult) {
      // Track unauthenticated attempts at network level
      await checkSharedRateLimit({
        key: `unauth_ai_challenge_${clientIp}`,
        maxRequests: 10,
        windowMs: 60 * 1000,
        ip: clientIp,
      }).catch(() => {});
      return authResult.errorResponse;
    }
    const authIdentifier = authResult.user.uid;

    // 4. Rate Limiting Check (Keyed exclusively by cryptographically verified UID across server instances)
    const rateLimitKey = `ai_challenge_${authIdentifier}`;
    const rateLimit = await checkRateLimit(rateLimitKey, clientIp);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "RATE_LIMIT_EXCEEDED",
          message: `Generation rate limit reached. Please wait ${rateLimit.resetInSeconds} seconds or use our curated relationship challenges.`,
          challenge: getCuratedChallenge(),
          isFallback: true,
          fallbackReason: "rate_limit_exceeded",
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

    // 4. Request Body Parsing & Strict Schema Validation
    let rawBody: unknown = {};
    const text = await request.text();
    if (text && text.trim().length > 0) {
      try {
        rawBody = JSON.parse(text);
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: "INVALID_JSON",
            message: "Malformed JSON payload in request body.",
          },
          { status: 400 }
        );
      }
    }

    const parseResult = ChallengeRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_REQUEST_PARAMETERS",
          message: "Request validation failed.",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { category, difficulty, partnerNames, partnerCities, topicHint } =
      parseResult.data;

    // Sanitize all untrusted text inputs and normalize context
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

    // 5. Generate via Server-side Gemini with Strict Schema Validation
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

    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: "An unexpected server error occurred.",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/challenge
 * Instant access to a curated standard challenge (Requires authentication and App Check)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. App Check Attestation
    const appCheckResult = await requireAppCheck(request);
    if (!appCheckResult.success) {
      return appCheckResult.errorResponse;
    }

    // 2. Authentication Check
    const authResult = await requireServerAuth(request);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const rawCategory = searchParams.get("category") || undefined;
    const rawDifficulty = searchParams.get("difficulty") || undefined;

    const queryResult = ChallengeQuerySchema.safeParse({
      category: rawCategory,
      difficulty: rawDifficulty,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_QUERY_PARAMETERS",
          message: "Invalid query parameters.",
          details: queryResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const challenge = getCuratedChallenge(
      queryResult.data.category,
      queryResult.data.difficulty
    );

    return NextResponse.json(
      {
        success: true,
        challenge,
        isFallback: true,
        fallbackReason: "curated_requested",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/ai/challenge] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: "An unexpected server error occurred.",
      },
      { status: 500 }
    );
  }
}

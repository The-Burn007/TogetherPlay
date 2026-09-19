import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateGameNightLineup,
  checkGameNightRateLimit,
} from "@/lib/ai/gameNightService";
import { getCuratedGameNight } from "@/lib/ai/curatedGameNights";
import { requireServerAuth } from "@/lib/firebase/server/auth";
import { requireAppCheck } from "@/lib/firebase/server/security";
import {
  getClientIp,
  checkSharedRateLimit,
} from "@/lib/firebase/server/sharedRateLimiter";

export const dynamic = "force-dynamic";

const GameNightRequestSchema = z
  .object({
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
    vibe: z
      .enum(["balanced", "cozy", "competitive", "deep_connection"])
      .optional(),
    themeHint: z.string().max(100).optional(),
  })
  .strict();

/**
 * POST /api/ai/game-night
 *
 * Architecture Flow:
 * Client
 * -> App Check Attestation (Untrusted client environment verification)
 * -> Authenticated Server Endpoint (Firebase Admin SDK Token Verification)
 * -> Validation (Zod & Input Sanitization)
 * -> Rate Limit (Token Bucket per user)
 * -> Gemini API (gemini-3.8-flash, server-only)
 * -> Schema Validation (GameNightLineupSchema)
 * -> Client (Returns structured 5-round lineup with curated fallback guarantee)
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
      key: `ip_game_night_${clientIp}`,
      maxRequests: 10, // 10 requests per minute per IP
      windowMs: 60 * 1000,
      ip: clientIp,
    });

    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "RATE_LIMIT_EXCEEDED",
          message: `Generation rate limit reached for this network. Please wait ${ipRateLimit.resetInSeconds} seconds or use our curated game nights.`,
          lineup: getCuratedGameNight(),
          isFallback: true,
          fallbackReason: "rate_limit_exceeded",
          meta: {
            rateLimitRemaining: 0,
            resetInSeconds: ipRateLimit.resetInSeconds,
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(ipRateLimit.resetInSeconds),
          },
        }
      );
    }

    // 3. Authentication Check
    const authResult = await requireServerAuth(request);
    if ("errorResponse" in authResult) {
      // Track unauthenticated attempts at network level
      await checkSharedRateLimit({
        key: `unauth_game_night_${clientIp}`,
        maxRequests: 10,
        windowMs: 60 * 1000,
        ip: clientIp,
      }).catch(() => {});
      return authResult.errorResponse;
    }
    const uid = authResult.user.uid;

    // 4. Parse & Validate Payload
    let body: unknown = {};
    const text = await request.text();
    if (text && text.trim().length > 0) {
      try {
        body = JSON.parse(text);
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

    const parseResult = GameNightRequestSchema.safeParse(body);
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

    const { partnerNames, partnerCities, vibe, themeHint } = parseResult.data;

    // 5. Rate Limiting Check (Keyed exclusively by cryptographically verified UID across server instances)
    const rateLimitKey = `gn_${uid}`;
    const rateLimit = await checkGameNightRateLimit(rateLimitKey, clientIp);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "RATE_LIMIT_EXCEEDED",
          message: `Generation rate limit reached. Please wait ${rateLimit.resetInSeconds} seconds or use our curated game nights.`,
          lineup: getCuratedGameNight(vibe, partnerNames, partnerCities),
          isFallback: true,
          fallbackReason: "rate_limit_exceeded",
          meta: {
            rateLimitRemaining: 0,
            resetInSeconds: rateLimit.resetInSeconds,
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.resetInSeconds),
          },
        }
      );
    }

    // 5. Generate Lineup via Gemini (Server-side)
    const result = await generateGameNightLineup({
      partnerNames,
      partnerCities,
      vibe,
      untrustedThemeHint: themeHint,
      timeoutMs: 8000,
    });

    return NextResponse.json({
      success: true,
      lineup: result.lineup,
      isFallback: result.isFallback,
      fallbackReason: result.fallbackReason,
      meta: {
        rateLimitRemaining: rateLimit.remaining,
        model: result.isFallback ? "curated_fallback" : "gemini-3.8-flash",
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal error";
    console.error("Game Night API Route Error:", errorMsg);

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

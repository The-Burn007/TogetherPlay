import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateGameNightLineup,
  checkGameNightRateLimit,
} from "@/lib/ai/gameNightService";
import { getCuratedGameNight } from "@/lib/ai/curatedGameNights";

export const dynamic = "force-dynamic";

const GameNightRequestSchema = z.object({
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
  vibe: z
    .enum(["balanced", "cozy", "competitive", "deep_connection"])
    .optional(),
  themeHint: z.string().max(100).optional(),
});

/**
 * POST /api/ai/game-night
 *
 * Architecture Flow:
 * Client
 * -> Authenticated Server Endpoint
 * -> Validation (Zod & Input Sanitization)
 * -> Rate Limit (Token Bucket per couple/client)
 * -> Gemini API (gemini-3.8-flash, server-only)
 * -> Schema Validation (GameNightLineupSchema)
 * -> Client (Returns structured 5-round lineup with curated fallback guarantee)
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

    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const realIp = request.headers.get("x-real-ip")?.trim();
    const clientIp = forwardedFor || realIp || "unknown_client";
    const authIdentifier =
      uid ||
      (process.env.NODE_ENV === "production" ? null : `dev_user_${clientIp}`);

    if (!authIdentifier) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHENTICATED",
          message:
            "Authentication required: Request does not contain a valid user token.",
          lineup: getCuratedGameNight(),
          isFallback: true,
        },
        { status: 401 }
      );
    }

    // 2. Parse & Validate Payload
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_JSON",
          message: "Malformed JSON payload in request body.",
          lineup: getCuratedGameNight(),
          isFallback: true,
        },
        { status: 400 }
      );
    }

    const parseResult = GameNightRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "VALIDATION_FAILED",
          details: parseResult.error.flatten(),
          lineup: getCuratedGameNight(),
          isFallback: true,
        },
        { status: 422 }
      );
    }

    const { partnerNames, partnerCities, vibe, themeHint } = parseResult.data;

    // 3. Rate Limiting Check
    const rateLimitKey = `gn_${authIdentifier}`;
    const rateLimit = checkGameNightRateLimit(rateLimitKey);

    if (!rateLimit.allowed) {
      const fallbackLineup = getCuratedGameNight(vibe, partnerNames, partnerCities);
      return NextResponse.json(
        {
          success: true,
          lineup: fallbackLineup,
          isFallback: true,
          fallbackReason: `Rate limit exceeded. Reset in ${rateLimit.resetInSeconds}s.`,
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

    // 4. Generate Lineup via Gemini (Server-side)
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
        success: true,
        lineup: getCuratedGameNight(),
        isFallback: true,
        fallbackReason: "internal_server_exception",
      },
      { status: 200 }
    );
  }
}

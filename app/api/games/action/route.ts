import { NextRequest, NextResponse } from "next/server";
import { submitGameAction, ActionValidationError } from "@/lib/firebase/server/submitGameAction";
import { extractAuthContext, checkApiRateLimit } from "@/lib/firebase/server/security";
import type { GameAction } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * Server-Side Authoritative Game Action API Route
 * 
 * ARCHITECTURE PRINCIPLE:
 * THE BROWSER IS UNTRUSTED.
 * All client actions must be submitted to the server for authoritative validation,
 * execution, and state persistence.
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = extractAuthContext(request);
    const appCheckToken = request.headers.get("x-firebase-appcheck");

    if (authContext) {
      const rateLimit = checkApiRateLimit(`game_action_${authContext.uid}`, 120, 60000);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            accepted: false,
            error: {
              code: "RATE_LIMITED",
              message: "Too many game actions sent. Please wait a moment.",
            },
          },
          { status: 429, headers: { "Retry-After": String(rateLimit.resetInSeconds) } }
        );
      }
    }

    const body = (await request.json()) as GameAction;

    // Execute authoritative server function
    const result = await submitGameAction(body, {
      auth: authContext,
      appCheckToken,
      enforceAppCheck: process.env.NODE_ENV === "production",
      serverTimestamp: Date.now(),
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ActionValidationError) {
      return NextResponse.json(
        {
          accepted: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.statusCode }
      );
    }

    console.error("[submitGameAction API Error]", error);
    return NextResponse.json(
      {
        accepted: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error occurred processing game action.",
        },
      },
      { status: 500 }
    );
  }
}

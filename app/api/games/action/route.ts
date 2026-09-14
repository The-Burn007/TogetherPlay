import { NextRequest, NextResponse } from "next/server";
import { submitGameAction, ActionValidationError } from "@/lib/firebase/server/submitGameAction";
import type { GameAction } from "@/types/domain";

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
    const authHeader = request.headers.get("authorization");
    const appCheckToken = request.headers.get("x-firebase-appcheck");

    // Extract Bearer token or test UID from authorization header
    let uid: string | undefined;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      // In production, token is decoded by Firebase Admin Auth.
      // In test/dev environment, allows test tokens (e.g. "uid:user_alex" or "user_alex")
      if (token.startsWith("uid:")) {
        uid = token.replace("uid:", "");
      } else if (token.length > 0) {
        uid = token;
      }
    }

    const body = (await request.json()) as GameAction;

    // Execute authoritative server function
    const result = await submitGameAction(body, {
      auth: uid ? { uid } : null,
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

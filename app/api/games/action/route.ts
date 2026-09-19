import { NextRequest, NextResponse } from "next/server";
import { submitGameAction, ActionValidationError } from "@/lib/firebase/server/submitGameAction";
import { checkApiRateLimit, requireAppCheck } from "@/lib/firebase/server/security";
import { requireServerAuth, forbiddenResponse } from "@/lib/firebase/server/auth";
import { PersistenceError, logStructuredError } from "@/lib/firebase/server/gameRepository";
import type { GameAction } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * Server-Side Authoritative Game Action API Route
 * 
 * ARCHITECTURE PRINCIPLES:
 * 1. THE BROWSER IS UNTRUSTED.
 * 2. App Check verifies that the request originates from an authentic app environment.
 * 3. Firebase Auth verifies the cryptographic user identity.
 * 4. Client-supplied playerId is never trusted as proof of identity.
 * 5. PERSISTENCE FAILURES NEVER PRODUCE SUCCESS:
 *    Authoritative state mutations must fail if the persistent write fails.
 */
export async function POST(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ||
    `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  let gameId = "unknown_game";
  let actionId = "unknown_action";
  let authUid: string | undefined;

  try {
    // 1. App Check Attestation
    const appCheckResult = await requireAppCheck(request);
    if (!appCheckResult.success) {
      return appCheckResult.errorResponse;
    }

    // 2. User Authentication
    const authResult = await requireServerAuth(request);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }
    const authUser = authResult.user;
    authUid = authUser.uid;

    const rateLimit = checkApiRateLimit(`game_action_${authUser.uid}`, 120, 60000);
    if (!rateLimit.allowed) {
      logStructuredError({
        requestId,
        gameId,
        actionId,
        playerId: authUid,
        errorCategory: "RATE_LIMIT_EXCEEDED",
        statusCode: 429,
        message: "Action submission rate limit exceeded.",
      });
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

    const appCheckToken = request.headers.get("x-firebase-appcheck");
    const body = (await request.json()) as GameAction;

    if (body?.gameId) gameId = body.gameId;
    if (body?.clientActionId) actionId = body.clientActionId;

    // Security Check: Client-supplied playerId cannot override authenticated UID
    if (body.playerId && body.playerId !== authUser.uid) {
      logStructuredError({
        requestId,
        gameId,
        actionId,
        playerId: authUid,
        errorCategory: "AUTHORIZATION_FAILURE",
        statusCode: 403,
        message: "Access denied: Action playerId does not match authenticated user.",
      });
      return forbiddenResponse("Access denied: Action playerId does not match authenticated user.");
    }
    // Authoritatively bind player ID to verified auth UID
    body.playerId = authUser.uid;

    // Execute authoritative server function
    const result = await submitGameAction(body, {
      auth: { uid: authUser.uid, email: authUser.email },
      appCheckToken,
      enforceAppCheck: process.env.NODE_ENV === "production",
      serverTimestamp: Date.now(),
      requestId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof PersistenceError) {
      logStructuredError({
        requestId,
        gameId: error.gameId || gameId,
        actionId: error.actionId || actionId,
        playerId: authUid,
        errorCategory: "PERSISTENCE_FAILURE",
        operation: error.operation,
        statusCode: 500,
        message: error.message,
        error,
      });

      return NextResponse.json(
        {
          accepted: false,
          error: {
            code: "PERSISTENCE_ERROR",
            message: "Authoritative persistent write failed. Game action was not committed.",
          },
        },
        { status: 500 }
      );
    }

    if (error instanceof ActionValidationError) {
      logStructuredError({
        requestId,
        gameId,
        actionId,
        playerId: authUid,
        errorCategory: "VALIDATION_FAILURE",
        statusCode: error.statusCode,
        message: error.message,
        details: { code: error.code },
        error,
      });

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

    logStructuredError({
      requestId,
      gameId,
      actionId,
      playerId: authUid,
      errorCategory: "INTERNAL_FAILURE",
      statusCode: 500,
      message: error instanceof Error ? error.message : "Internal server error occurred processing game action.",
      error,
    });

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

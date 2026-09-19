/**
 * Shared Server-Side Authentication & Authorization Utility
 *
 * ARCHITECTURE PRINCIPLE:
 * THE BROWSER IS UNTRUSTED.
 * All protected server endpoints MUST cryptographically verify the Firebase ID token
 * via the Firebase Admin SDK.
 *
 * Client-supplied identifiers (uid, userId, playerId, acceptingUserId, coupleId)
 * are NEVER trusted as proof of identity.
 */

import { NextResponse } from "next/server";
import { getAdminAuth } from "./admin";
import type { DecodedIdToken } from "firebase-admin/auth";

if (typeof window !== "undefined") {
  throw new Error("Security Violation: Server auth utility cannot be loaded in client browser bundle.");
}

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  token: DecodedIdToken;
}

export type ServerAuthResult =
  | { success: true; user: AuthenticatedUser }
  | { success: false; status: 401; code: string; message: string };

/**
 * Extracts Bearer token strictly from an Authorization header.
 * Disallows missing, empty, malformed, or non-Bearer headers.
 */
export function extractBearerToken(
  source: Request | Headers | string | null | undefined
): string | null {
  if (!source) return null;
  let authHeader: string | null = null;
  if (typeof source === "string") {
    authHeader = source;
  } else if ("headers" in (source as object) && typeof (source as Request).headers?.get === "function") {
    authHeader = (source as Request).headers.get("Authorization") || (source as Request).headers.get("authorization");
  } else if (typeof (source as Headers).get === "function") {
    authHeader = (source as Headers).get("Authorization") || (source as Headers).get("authorization");
  }

  if (!authHeader || typeof authHeader !== "string") return null;

  const trimmed = authHeader.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;

  const token = trimmed.substring(7).trim();
  if (!token || token.length === 0) return null;

  return token;
}

/**
 * Verifies a Firebase ID token using the Firebase Admin SDK.
 * Cryptographically verifies the signature against Google's public certs.
 * Rejects unsigned JWTs, fake 'uid:' tokens, and arbitrary strings.
 */
export async function verifyFirebaseIdToken(token: string): Promise<ServerAuthResult> {
  // Reject fake "uid:" tokens, tokens with spaces, or empty tokens immediately
  if (!token || token.startsWith("uid:") || token.includes(" ") || token.length < 8) {
    return {
      success: false,
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Authentication required: Invalid or malformed token format.",
    };
  }

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);

    if (!decoded || !decoded.uid || typeof decoded.uid !== "string" || decoded.uid.trim() === "") {
      return {
        success: false,
        status: 401,
        code: "UNAUTHENTICATED",
        message: "Authentication required: Token does not contain a valid user identity.",
      };
    }

    return {
      success: true,
      user: {
        uid: decoded.uid.trim(),
        email: decoded.email,
        emailVerified: decoded.email_verified,
        token: decoded,
      },
    };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    const errorCode = err?.code || "";

    if (errorCode === "auth/id-token-expired") {
      return {
        success: false,
        status: 401,
        code: "TOKEN_EXPIRED",
        message: "Authentication required: Firebase ID token has expired.",
      };
    }

    if (errorCode === "auth/id-token-revoked") {
      return {
        success: false,
        status: 401,
        code: "TOKEN_REVOKED",
        message: "Authentication required: Firebase ID token has been revoked.",
      };
    }

    return {
      success: false,
      status: 401,
      code: "UNAUTHENTICATED",
      message: `Authentication required: ${err?.message || "Invalid or unverified Firebase ID token."}`,
    };
  }
}

/**
 * Shared server authentication entry point: extracts and cryptographically verifies Firebase ID token.
 * The authenticated UID is derived ONLY from the verified token.
 */
export async function authenticateServerRequest(
  request: Request | Headers | string | null | undefined
): Promise<ServerAuthResult> {
  const token = extractBearerToken(request);
  if (!token) {
    return {
      success: false,
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Authentication required: Missing or invalid Authorization Bearer header.",
    };
  }

  return await verifyFirebaseIdToken(token);
}

/**
 * Standard 401 Unauthorized response helper.
 * Provides consistent error envelope for API clients.
 */
export function unauthorizedResponse(
  message = "Authentication required: Missing, invalid, or expired user token.",
  code = "UNAUTHENTICATED"
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      accepted: false,
      error: {
        code,
        message,
      },
      message,
    },
    { status: 401 }
  );
}

/**
 * Standard 403 Forbidden response helper.
 * Used ONLY when user is authenticated, but not authorized for the requested resource.
 */
export function forbiddenResponse(
  message = "Access denied: You are not authorized to perform this operation or access this resource.",
  code = "FORBIDDEN"
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      accepted: false,
      error: {
        code,
        message,
      },
      message,
    },
    { status: 403 }
  );
}

/**
 * Route Guard: returns verified AuthenticatedUser or an immediate 401 error response.
 */
export async function requireServerAuth(
  request: Request | Headers | string | null | undefined
): Promise<{ user: AuthenticatedUser } | { errorResponse: NextResponse }> {
  const result = await authenticateServerRequest(request);
  if (!result.success) {
    return {
      errorResponse: unauthorizedResponse(result.message, result.code),
    };
  }
  return { user: result.user };
}

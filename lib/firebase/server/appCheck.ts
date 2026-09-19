/**
 * Server-Side Firebase App Check Verification Module
 *
 * ARCHITECTURE PRINCIPLES:
 * 1. THE BROWSER IS UNTRUSTED. All client environments must prove integrity via App Check.
 * 2. SEPARATION OF CONCERNS:
 *    - App Check Attestation: Establishes that the request originates from an authentic, untampered app binary.
 *    - User Authentication (Firebase Auth): Establishes the identity of the human actor (UID).
 *    - Authorization: Determines whether the authenticated user is permitted to access the resource.
 * 3. NO HEURISTIC BYPASSES:
 *    - Heuristic substring checks (e.g., 'startsWith("ey")' or 'startsWith("appcheck_test_")') are strictly banned.
 *    - Tokens must be verified cryptographically via the Firebase Admin SDK App Check service.
 * 4. STRICT PRODUCTION ENFORCEMENT:
 *    - When NODE_ENV=production, App Check verification is mandatory and cannot be disabled or bypassed.
 *    - Missing, malformed, expired, fake, or wrong-project tokens are immediately rejected.
 * 5. CONVENIENT DEVELOPMENT WORKFLOW:
 *    - In non-production environments (development/test), requests without an App Check token are permitted
 *      unless enforceAppCheck is explicitly set to true or ENFORCE_APP_CHECK=true is configured.
 */

import { NextResponse } from "next/server";
import { getAdminAppCheck } from "./admin";
import { requireServerAuth, type AuthenticatedUser } from "./auth";
import type { DecodedAppCheckToken, VerifyAppCheckTokenResponse } from "firebase-admin/app-check";
import firebaseAppletConfig from "@/firebase-applet-config.json";

if (typeof window !== "undefined") {
  throw new Error("Security Violation: App Check server verification cannot run in the client browser.");
}

export type AppCheckErrorCode =
  | "MISSING_APP_CHECK"
  | "MALFORMED_APP_CHECK"
  | "INVALID_APP_CHECK_SIGNATURE"
  | "APP_CHECK_EXPIRED"
  | "APP_CHECK_REVOKED"
  | "INVALID_APP_CHECK_CLAIMS"
  | "APP_CHECK_FAILED"
  | "APP_CHECK_BYPASS";

export interface AppCheckVerificationOptions {
  /**
   * If true, forces verification even in development.
   * In production (NODE_ENV=production), App Check is ALWAYS enforced regardless of this option.
   */
  enforceAppCheck?: boolean;
  /**
   * Optional expected App ID to enforce matching (e.g. against firebase-applet-config appId).
   */
  expectedAppId?: string;
  /**
   * If true, consumes the App Check token (one-time use protection).
   */
  consume?: boolean;
}

export interface AppCheckVerificationResult {
  valid: boolean;
  appId?: string;
  token?: DecodedAppCheckToken;
  alreadyConsumed?: boolean;
  reason?: string;
  code?: AppCheckErrorCode;
  isBypassed?: boolean;
}

/**
 * Extracts the App Check token from incoming HTTP headers or request object.
 * Header name: X-Firebase-AppCheck (case-insensitive in standard HTTP).
 */
export function extractAppCheckToken(
  request: Request | Headers | string | null | undefined
): string | null {
  if (!request) return null;

  if (typeof request === "string") {
    const trimmed = request.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (request instanceof Headers) {
    const header = request.get("x-firebase-appcheck");
    return header && header.trim().length > 0 ? header.trim() : null;
  }

  if ("headers" in request && request.headers) {
    if (typeof request.headers.get === "function") {
      const header = request.headers.get("x-firebase-appcheck");
      return header && header.trim().length > 0 ? header.trim() : null;
    }
    const rawHeaders = request.headers as unknown as Record<string, string | string[] | undefined>;
    const headerVal =
      rawHeaders["x-firebase-appcheck"] ||
      rawHeaders["X-Firebase-AppCheck"] ||
      rawHeaders["X-FIREBASE-APPCHECK"];
    if (typeof headerVal === "string" && headerVal.trim().length > 0) {
      return headerVal.trim();
    }
  }

  return null;
}

/**
 * Cryptographically verifies an App Check token using the Firebase Admin SDK.
 * Rejects missing, malformed, expired, invalid signature, or wrong-project claims.
 */
export async function verifyAppCheckToken(
  token: string | null | undefined,
  options: AppCheckVerificationOptions = { enforceAppCheck: true }
): Promise<AppCheckVerificationResult> {
  const isProduction = process.env.NODE_ENV === "production";

  // In production, App Check enforcement is unconditional and absolute.
  // Any bypass attempt is strictly forbidden.
  const shouldEnforce = isProduction
    ? true
    : (options.enforceAppCheck ?? (process.env.ENFORCE_APP_CHECK === "true"));

  const trimmedToken = typeof token === "string" ? token.trim() : "";

  // In non-production environments only, allow development bypass when enforcement is not enabled
  if (!shouldEnforce) {
    return {
      valid: true,
      appId: "dev-local-app",
      code: "APP_CHECK_BYPASS",
      reason: "App Check bypassed in non-production development mode.",
      isBypassed: true,
    };
  }

  // Reject missing token
  if (!trimmedToken) {
    return {
      valid: false,
      reason: "Missing App Check token: x-firebase-appcheck header is required.",
      code: "MISSING_APP_CHECK",
    };
  }

  try {
    const adminAppCheck = getAdminAppCheck();
    const verifyResponse: VerifyAppCheckTokenResponse = await adminAppCheck.verifyToken(
      trimmedToken,
      { consume: options?.consume }
    );

    const decoded = verifyResponse.token;
    const appId = verifyResponse.appId || decoded.app_id || decoded.sub;

    // Validate that App ID is present in claims
    if (!appId || typeof appId !== "string" || appId.trim().length === 0) {
      return {
        valid: false,
        reason: "Invalid App Check claims: Token does not contain a valid App ID.",
        code: "INVALID_APP_CHECK_CLAIMS",
      };
    }

    // Validate Project Claims (audience / issuer against configured project)
    const expectedProjectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      firebaseAppletConfig.projectId;

    const projectNumber = firebaseAppletConfig.messagingSenderId;
    const audList = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];

    if (expectedProjectId) {
      const matchesProject = audList.some(
        (aud) =>
          aud === `projects/${expectedProjectId}` ||
          aud === expectedProjectId ||
          (projectNumber &&
            (aud === `projects/${projectNumber}` ||
              aud === projectNumber ||
              (decoded.iss && decoded.iss.includes(projectNumber)))) ||
          (decoded.iss && decoded.iss.includes(expectedProjectId))
      );

      if (!matchesProject) {
        return {
          valid: false,
          reason: `Invalid App Check project claim: Token audience '${audList.join(", ")}' does not match project '${expectedProjectId}'.`,
          code: "INVALID_APP_CHECK_CLAIMS",
        };
      }
    }

    // Validate App ID if specific expectedAppId is required
    const expectedAppId = options?.expectedAppId;
    if (expectedAppId && appId !== expectedAppId) {
      return {
        valid: false,
        reason: `Invalid App Check app claim: Token appId '${appId}' does not match expected '${expectedAppId}'.`,
        code: "INVALID_APP_CHECK_CLAIMS",
      };
    }

    return {
      valid: true,
      appId,
      token: decoded,
      alreadyConsumed: verifyResponse.alreadyConsumed,
    };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    const errorCode = err?.code || "";
    const errorMessage = err?.message || String(error);

    if (errorCode === "app-check/token-expired") {
      return {
        valid: false,
        reason: "App Check token has expired.",
        code: "APP_CHECK_EXPIRED",
      };
    }

    if (errorCode === "app-check/token-revoked") {
      return {
        valid: false,
        reason: "App Check token has been revoked.",
        code: "APP_CHECK_REVOKED",
      };
    }

    if (
      errorCode === "app-check/invalid-argument" &&
      (errorMessage.includes("signature") ||
        errorMessage.includes("kid") ||
        errorMessage.includes("algorithm"))
    ) {
      return {
        valid: false,
        reason: `Invalid App Check token signature or key: ${errorMessage}`,
        code: "INVALID_APP_CHECK_SIGNATURE",
      };
    }

    if (
      errorCode === "app-check/invalid-argument" &&
      (errorMessage.includes("aud") ||
        errorMessage.includes("audience") ||
        errorMessage.includes("iss") ||
        errorMessage.includes("issuer"))
    ) {
      return {
        valid: false,
        reason: `Invalid App Check project claims: ${errorMessage}`,
        code: "INVALID_APP_CHECK_CLAIMS",
      };
    }

    if (errorCode === "app-check/invalid-argument") {
      return {
        valid: false,
        reason: `Malformed or invalid App Check token: ${errorMessage}`,
        code: "MALFORMED_APP_CHECK",
      };
    }

    return {
      valid: false,
      reason: `App Check verification failed: ${errorMessage}`,
      code: "APP_CHECK_FAILED",
    };
  }
}

/**
 * Standard HTTP response for App Check failures.
 * Clearly tagged with category "APP_CHECK_ATTESTATION" to distinguish from user authentication.
 */
export function appCheckErrorResponse(
  result: AppCheckVerificationResult,
  statusCode = 401
): NextResponse {
  const code = result.code || "APP_CHECK_INVALID";
  const message = result.reason || "App Check attestation failed.";

  return NextResponse.json(
    {
      success: false,
      accepted: false,
      error: {
        code,
        message,
        category: "APP_CHECK_ATTESTATION",
      },
      message,
    },
    { status: statusCode }
  );
}

/**
 * Centralized App Check route guard.
 *
 * Verifies that the incoming request originates from an attested client environment.
 * If invalid or missing (in production), returns an error NextResponse.
 */
export async function requireAppCheck(
  request: Request | Headers | string | null | undefined,
  options?: AppCheckVerificationOptions
): Promise<
  | { success: true; appCheck: AppCheckVerificationResult }
  | { success: false; errorResponse: NextResponse }
> {
  const token = extractAppCheckToken(request);
  const isProduction = process.env.NODE_ENV === "production";
  const enforce = isProduction
    ? true
    : (options?.enforceAppCheck ?? (process.env.ENFORCE_APP_CHECK === "true"));

  const result = await verifyAppCheckToken(token, {
    ...options,
    enforceAppCheck: enforce,
  });

  if (!result.valid) {
    return {
      success: false,
      errorResponse: appCheckErrorResponse(result, 401),
    };
  }

  return {
    success: true,
    appCheck: result,
  };
}

export interface ServerSecurityContext {
  user: AuthenticatedUser;
  appCheck: AppCheckVerificationResult;
}

/**
 * Comprehensive Server Security Guard:
 * 1. Enforces App Check attestation (Untrusted client environment verification).
 * 2. Enforces Firebase Auth (Cryptographic user identity verification).
 */
export async function requireServerSecurity(
  request: Request,
  options?: {
    enforceAppCheck?: boolean;
    expectedAppId?: string;
  }
): Promise<
  | { success: true; user: AuthenticatedUser; appCheck: AppCheckVerificationResult }
  | { success: false; errorResponse: NextResponse }
> {
  // Step 1: App Check Attestation
  const appCheckResult = await requireAppCheck(request, {
    enforceAppCheck: options?.enforceAppCheck,
    expectedAppId: options?.expectedAppId,
  });

  if (!appCheckResult.success) {
    return { success: false, errorResponse: appCheckResult.errorResponse };
  }

  // Step 2: User Identity Authentication
  const authResult = await requireServerAuth(request);
  if ("errorResponse" in authResult) {
    return { success: false, errorResponse: authResult.errorResponse };
  }

  return {
    success: true,
    user: authResult.user,
    appCheck: appCheckResult.appCheck,
  };
}

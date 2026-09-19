import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  verifyAppCheckToken,
  extractAppCheckToken,
  requireAppCheck,
  requireServerSecurity,
  appCheckErrorResponse,
} from "@/lib/firebase/server/appCheck";
import { getAdminAppCheck } from "@/lib/firebase/server/admin";

// Mock Firebase Admin SDK
vi.mock("@/lib/firebase/server/admin", () => {
  const mockVerifyToken = vi.fn();
  return {
    getAdminAppCheck: vi.fn(() => ({
      verifyToken: mockVerifyToken,
    })),
    getAdminAuth: vi.fn(() => ({
      verifyIdToken: vi.fn(async (token: string) => {
        if (token && token.startsWith("valid_user_")) {
          const uid = token.replace("valid_user_", "");
          return {
            uid,
            sub: uid,
            email: `${uid}@example.com`,
            email_verified: true,
            auth_time: Math.floor(Date.now() / 1000),
          };
        }
        throw new Error("Invalid user token");
      }),
    })),
    getAdminFirestore: vi.fn(() => ({})),
    getAdminApp: vi.fn(() => ({})),
  };
});

describe("Server-Side Firebase App Check Verification Mechanism", () => {
  const mockAdminAppCheck = getAdminAppCheck();
  const originalEnv = process.env.NODE_ENV;

  const setNodeEnv = (val: string | undefined) => {
    (process.env as Record<string, string | undefined>).NODE_ENV = val;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setNodeEnv("test");
  });

  afterEach(() => {
    setNodeEnv(originalEnv);
  });

  describe("1. Header Extraction (extractAppCheckToken)", () => {
    it("extracts token from string input", () => {
      expect(extractAppCheckToken("sample-token-123")).toBe("sample-token-123");
      expect(extractAppCheckToken("   trimmed-token   ")).toBe("trimmed-token");
      expect(extractAppCheckToken("")).toBeNull();
      expect(extractAppCheckToken("   ")).toBeNull();
    });

    it("extracts token from standard Headers instance", () => {
      const headers = new Headers();
      headers.set("x-firebase-appcheck", "token-from-headers");
      expect(extractAppCheckToken(headers)).toBe("token-from-headers");
    });

    it("extracts token from Request object", () => {
      const req = new Request("https://togetherplay.app/api/games/action", {
        headers: { "X-Firebase-AppCheck": "token-from-request" },
      });
      expect(extractAppCheckToken(req)).toBe("token-from-request");
    });

    it("returns null when no App Check header exists", () => {
      const req = new Request("https://togetherplay.app/api/games/action");
      expect(extractAppCheckToken(req)).toBeNull();
      expect(extractAppCheckToken(null)).toBeNull();
    });
  });

  describe("2. Cryptographic Token Verification (verifyAppCheckToken)", () => {
    it("rejects missing or empty tokens when enforced", async () => {
      const resultNull = await verifyAppCheckToken(null, { enforceAppCheck: true });
      expect(resultNull.valid).toBe(false);
      expect(resultNull.code).toBe("MISSING_APP_CHECK");
      expect(resultNull.reason).toContain("Missing App Check token");

      const resultEmpty = await verifyAppCheckToken("", { enforceAppCheck: true });
      expect(resultEmpty.valid).toBe(false);
      expect(resultEmpty.code).toBe("MISSING_APP_CHECK");

      const resultWhitespace = await verifyAppCheckToken("   ", { enforceAppCheck: true });
      expect(resultWhitespace.valid).toBe(false);
      expect(resultWhitespace.code).toBe("MISSING_APP_CHECK");
    });

    it("rejects malformed tokens with Admin SDK app-check/invalid-argument error", async () => {
      vi.mocked(mockAdminAppCheck.verifyToken).mockRejectedValueOnce(
        Object.assign(new Error("Decoding App Check token failed."), {
          code: "app-check/invalid-argument",
        })
      );

      const result = await verifyAppCheckToken("malformed-string", { enforceAppCheck: true });
      expect(result.valid).toBe(false);
      expect(result.code).toBe("MALFORMED_APP_CHECK");
      expect(result.reason).toContain("Malformed or invalid App Check token");
    });

    it("rejects fake JWT-like strings without falling back to string heuristics", async () => {
      // Rejects tokens starting with 'ey' if Admin SDK verification fails
      const fakeJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake_signature";
      vi.mocked(mockAdminAppCheck.verifyToken).mockRejectedValueOnce(
        Object.assign(
          new Error("The provided App Check token has incorrect algorithm. Expected 'RS256' but got 'HS256'."),
          { code: "app-check/invalid-argument" }
        )
      );

      const result = await verifyAppCheckToken(fakeJwt, { enforceAppCheck: true });
      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID_APP_CHECK_SIGNATURE");
      expect(mockAdminAppCheck.verifyToken).toHaveBeenCalledWith(fakeJwt, { consume: undefined });
    });

    it("rejects tokens starting with 'appcheck_test_' unless officially verified by Admin SDK", async () => {
      const heuristicToken = "appcheck_test_heuristic_attempt";
      vi.mocked(mockAdminAppCheck.verifyToken).mockRejectedValueOnce(
        Object.assign(new Error("The provided App Check token is invalid."), {
          code: "app-check/invalid-argument",
        })
      );

      const result = await verifyAppCheckToken(heuristicToken, { enforceAppCheck: true });
      expect(result.valid).toBe(false);
      expect(result.code).toBe("MALFORMED_APP_CHECK");
    });

    it("rejects expired tokens (app-check/token-expired)", async () => {
      vi.mocked(mockAdminAppCheck.verifyToken).mockRejectedValueOnce(
        Object.assign(new Error("The provided App Check token has expired."), {
          code: "app-check/token-expired",
        })
      );

      const result = await verifyAppCheckToken("expired.token.jwt", { enforceAppCheck: true });
      expect(result.valid).toBe(false);
      expect(result.code).toBe("APP_CHECK_EXPIRED");
      expect(result.reason).toContain("expired");
    });

    it("rejects revoked tokens (app-check/token-revoked)", async () => {
      vi.mocked(mockAdminAppCheck.verifyToken).mockRejectedValueOnce(
        Object.assign(new Error("The provided App Check token has been revoked."), {
          code: "app-check/token-revoked",
        })
      );

      const result = await verifyAppCheckToken("revoked.token.jwt", { enforceAppCheck: true });
      expect(result.valid).toBe(false);
      expect(result.code).toBe("APP_CHECK_REVOKED");
      expect(result.reason).toContain("revoked");
    });

    it("rejects tokens with invalid signature or unknown kid", async () => {
      vi.mocked(mockAdminAppCheck.verifyToken).mockRejectedValueOnce(
        Object.assign(
          new Error("The provided App Check token has 'kid' claim which does not correspond to a known public key."),
          { code: "app-check/invalid-argument" }
        )
      );

      const result = await verifyAppCheckToken("invalid.signature.token", { enforceAppCheck: true });
      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID_APP_CHECK_SIGNATURE");
    });

    it("rejects tokens with invalid project audience claims", async () => {
      vi.mocked(mockAdminAppCheck.verifyToken).mockResolvedValueOnce({
        appId: "1:223821505952:web:5d674869094ba785d1b0c5",
        token: {
          iss: "https://firebaseappcheck.googleapis.com/999999999999",
          sub: "1:223821505952:web:5d674869094ba785d1b0c5",
          aud: ["projects/malicious-attacker-project"],
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000) - 60,
          app_id: "1:223821505952:web:5d674869094ba785d1b0c5",
        },
        alreadyConsumed: false,
      });

      const result = await verifyAppCheckToken("wrong.aud.token", { enforceAppCheck: true });
      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID_APP_CHECK_CLAIMS");
      expect(result.reason).toContain("does not match project");
    });

    it("rejects tokens where appId does not match expectedAppId option", async () => {
      vi.mocked(mockAdminAppCheck.verifyToken).mockResolvedValueOnce({
        appId: "1:223821505952:web:attacker_app_id",
        token: {
          iss: "https://firebaseappcheck.googleapis.com/223821505952",
          sub: "1:223821505952:web:attacker_app_id",
          aud: ["projects/rational-drake-mlcf1"],
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000) - 60,
          app_id: "1:223821505952:web:attacker_app_id",
        },
        alreadyConsumed: false,
      });

      const result = await verifyAppCheckToken("valid.jwt.token", {
        enforceAppCheck: true,
        expectedAppId: "1:223821505952:web:5d674869094ba785d1b0c5",
      });
      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID_APP_CHECK_CLAIMS");
      expect(result.reason).toContain("does not match expected");
    });

    it("accepts authentic cryptographically verified token with valid claims", async () => {
      const mockDecodedToken = {
        iss: "https://firebaseappcheck.googleapis.com/223821505952",
        sub: "1:223821505952:web:5d674869094ba785d1b0c5",
        aud: ["projects/rational-drake-mlcf1", "projects/223821505952"],
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000) - 60,
        app_id: "1:223821505952:web:5d674869094ba785d1b0c5",
      };

      vi.mocked(mockAdminAppCheck.verifyToken).mockResolvedValueOnce({
        appId: "1:223821505952:web:5d674869094ba785d1b0c5",
        token: mockDecodedToken,
        alreadyConsumed: false,
      });

      const result = await verifyAppCheckToken("valid.cryptographic.jwt", { enforceAppCheck: true });
      expect(result.valid).toBe(true);
      expect(result.appId).toBe("1:223821505952:web:5d674869094ba785d1b0c5");
      expect(result.token).toEqual(mockDecodedToken);
      expect(result.alreadyConsumed).toBe(false);
    });
  });

  describe("3. Production Invariant vs Development Convenience", () => {
    it("strictly enforces App Check in production even if enforceAppCheck: false is passed", async () => {
      setNodeEnv("production");

      // Attempting to pass enforceAppCheck: false in production must be impossible
      const result = await verifyAppCheckToken(null, { enforceAppCheck: false });
      expect(result.valid).toBe(false);
      expect(result.code).toBe("MISSING_APP_CHECK");
      expect(result.isBypassed).toBeFalsy();
    });

    it("never accepts bypass in production mode", async () => {
      setNodeEnv("production");

      const result = await verifyAppCheckToken("");
      expect(result.valid).toBe(false);
      expect(result.code).toBe("MISSING_APP_CHECK");
    });

    it("allows convenient development bypass when not in production and token is missing", async () => {
      setNodeEnv("development");

      const result = await verifyAppCheckToken(null, { enforceAppCheck: false });
      expect(result.valid).toBe(true);
      expect(result.isBypassed).toBe(true);
      expect(result.code).toBe("APP_CHECK_BYPASS");
    });
  });

  describe("4. Centralized Route Guard (requireAppCheck)", () => {
    it("returns error NextResponse with status 401 when token is missing in production", async () => {
      setNodeEnv("production");

      const req = new Request("https://togetherplay.app/api/games/action");
      const guardResult = await requireAppCheck(req);

      expect(guardResult.success).toBe(false);
      if (!guardResult.success) {
        expect(guardResult.errorResponse.status).toBe(401);
        const data = await guardResult.errorResponse.json();
        expect(data.error.code).toBe("MISSING_APP_CHECK");
        expect(data.error.category).toBe("APP_CHECK_ATTESTATION");
      }
    });

    it("returns success: true when valid token is supplied", async () => {
      vi.mocked(mockAdminAppCheck.verifyToken).mockResolvedValueOnce({
        appId: "1:223821505952:web:5d674869094ba785d1b0c5",
        token: {
          iss: "https://firebaseappcheck.googleapis.com/223821505952",
          sub: "1:223821505952:web:5d674869094ba785d1b0c5",
          aud: ["projects/rational-drake-mlcf1"],
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000) - 60,
          app_id: "1:223821505952:web:5d674869094ba785d1b0c5",
        },
        alreadyConsumed: false,
      });

      const req = new Request("https://togetherplay.app/api/games/action", {
        headers: { "x-firebase-appcheck": "valid.token.value" },
      });

      const guardResult = await requireAppCheck(req, { enforceAppCheck: true });
      expect(guardResult.success).toBe(true);
      if (guardResult.success) {
        expect(guardResult.appCheck.appId).toBe("1:223821505952:web:5d674869094ba785d1b0c5");
      }
    });
  });

  describe("5. Separation of Concerns: App Check vs Firebase Auth vs Authorization", () => {
    it("distinguishes App Check failure (401 APP_CHECK_ATTESTATION) from User Auth failure", async () => {
      // 1. App Check failure
      const appCheckFailResponse = appCheckErrorResponse({
        valid: false,
        code: "INVALID_APP_CHECK_SIGNATURE",
        reason: "Invalid signature",
      });
      const appCheckBody = await appCheckFailResponse.json();
      expect(appCheckBody.error.category).toBe("APP_CHECK_ATTESTATION");
      expect(appCheckBody.error.code).toBe("INVALID_APP_CHECK_SIGNATURE");

      // 2. Full security pipeline rejects App Check before running User Auth
      setNodeEnv("production");
      const req = new Request("https://togetherplay.app/api/games/action"); // Missing x-firebase-appcheck
      const securityResult = await requireServerSecurity(req);

      expect(securityResult.success).toBe(false);
      if (!securityResult.success) {
        const data = await securityResult.errorResponse.json();
        expect(data.error.category).toBe("APP_CHECK_ATTESTATION");
      }
    });

    it("verifies User Auth after App Check succeeds in requireServerSecurity", async () => {
      vi.mocked(mockAdminAppCheck.verifyToken).mockResolvedValueOnce({
        appId: "1:223821505952:web:5d674869094ba785d1b0c5",
        token: {
          iss: "https://firebaseappcheck.googleapis.com/223821505952",
          sub: "1:223821505952:web:5d674869094ba785d1b0c5",
          aud: ["projects/rational-drake-mlcf1"],
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000) - 60,
          app_id: "1:223821505952:web:5d674869094ba785d1b0c5",
        },
        alreadyConsumed: false,
      });

      const req = new Request("https://togetherplay.app/api/games/action", {
        headers: {
          "x-firebase-appcheck": "valid.appcheck.token",
          authorization: "Bearer valid_user_user_12345",
        },
      });

      const securityResult = await requireServerSecurity(req, { enforceAppCheck: true });
      expect(securityResult.success).toBe(true);
      if (securityResult.success) {
        // App Check identity
        expect(securityResult.appCheck.appId).toBe("1:223821505952:web:5d674869094ba785d1b0c5");
        // User Auth identity
        expect(securityResult.user.uid).toBe("user_12345");
      }
    });
  });
});

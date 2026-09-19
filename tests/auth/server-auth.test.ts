import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractBearerToken,
  verifyFirebaseIdToken,
  authenticateServerRequest,
  requireServerAuth,
} from "@/lib/firebase/server/auth";
import { NextRequest } from "next/server";
import { POST as gameActionRoute } from "@/app/api/games/action/route";
import { POST as acceptInviteRoute } from "@/app/api/couples/accept-invite/route";
import { POST as postMemoryRoute } from "@/app/api/couples/[coupleId]/memories/route";

// Mock Firebase Admin SDK
vi.mock("@/lib/firebase/server/admin", () => {
  const mockVerifyIdToken = vi.fn(async (token: string) => {
    if (token === "valid_id_token_alice") {
      return {
        uid: "alice_verified_uid",
        sub: "alice_verified_uid",
        email: "alice@example.com",
        email_verified: true,
        auth_time: Math.floor(Date.now() / 1000),
      };
    }
    if (token === "valid_id_token_bob") {
      return {
        uid: "bob_verified_uid",
        sub: "bob_verified_uid",
        email: "bob@example.com",
        email_verified: true,
        auth_time: Math.floor(Date.now() / 1000),
      };
    }
    if (token === "expired_id_token") {
      const error = new Error("Firebase ID token has expired.");
      (error as unknown as { code: string }).code = "auth/id-token-expired";
      throw error;
    }
    if (token === "revoked_id_token") {
      const error = new Error("Firebase ID token has been revoked.");
      (error as unknown as { code: string }).code = "auth/id-token-revoked";
      throw error;
    }
    if (token.startsWith("unsigned_jwt_") || token.startsWith("arbitrary_")) {
      const error = new Error("Firebase ID token has invalid signature.");
      (error as unknown as { code: string }).code = "auth/argument-error";
      throw error;
    }
    const genericError = new Error("Decoding Firebase ID token failed.");
    (genericError as unknown as { code: string }).code = "auth/invalid-id-token";
    throw genericError;
  });

  return {
    getAdminAuth: vi.fn(() => ({
      verifyIdToken: mockVerifyIdToken,
    })),
    getAdminFirestore: vi.fn(() => ({})),
    getAdminApp: vi.fn(() => ({})),
  };
});

// Mock client firebase
vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: { currentUser: { uid: "alice_verified_uid" } },
}));

// Mock firestore for invite & memories
vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db, collection, id) => ({ collection, id, path: `${collection}/${id}` })),
  getDoc: vi.fn(async (ref: { collection: string; id: string }) => {
    if (ref.id === "test_invite_valid") {
      return {
        exists: () => true,
        data: () => ({
          inviteId: "test_invite_valid",
          coupleId: "cpl_test",
          inviterId: "inviter_uid",
          status: "pending",
          tokenHash: "0ba904de83f8b424e0e406dae4814e3241644029ec61f723def0570abac3018b", // hash of 'secret123'
          expiresAt: new Date(Date.now() + 1000000).toISOString(),
        }),
      };
    }
    if (ref.collection === "couples") {
      return {
        exists: () => true,
        data: () => ({
          coupleId: "cpl_test",
          memberIds: ["alice_verified_uid", "bob_verified_uid"],
        }),
      };
    }
    return { exists: () => false, data: () => null };
  }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
}));

describe("TogetherPlay Server-Side Authentication Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Token Extraction & Format Validation", () => {
    it("extracts token from standard Bearer Authorization header", () => {
      const req = new Request("http://localhost/api/test", {
        headers: { Authorization: "Bearer valid_id_token_alice" },
      });
      const token = extractBearerToken(req);
      expect(token).toBe("valid_id_token_alice");
    });

    it("rejects missing Authorization header", () => {
      const req = new Request("http://localhost/api/test");
      const token = extractBearerToken(req);
      expect(token).toBeNull();
    });

    it("rejects non-Bearer Authorization headers (e.g. Basic or Custom)", () => {
      const req = new Request("http://localhost/api/test", {
        headers: { Authorization: "Basic dXNlcjpwYXNz" },
      });
      const token = extractBearerToken(req);
      expect(token).toBeNull();
    });

    it("rejects empty Bearer values", () => {
      const req = new Request("http://localhost/api/test", {
        headers: { Authorization: "Bearer " },
      });
      const token = extractBearerToken(req);
      expect(token).toBeNull();
    });
  });

  describe("2. Cryptographic Verification via Firebase Admin SDK", () => {
    it("authenticates valid Firebase ID tokens and derives UID from verified token", async () => {
      const result = await verifyFirebaseIdToken("valid_id_token_alice");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.uid).toBe("alice_verified_uid");
        expect(result.user.email).toBe("alice@example.com");
        expect(result.user.emailVerified).toBe(true);
      }
    });

    it("fails when fake 'uid:' tokens are supplied", async () => {
      const result = await verifyFirebaseIdToken("uid:attacker_fake_uid");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
        expect(result.code).toBe("UNAUTHENTICATED");
        expect(result.message).toContain("Invalid or malformed token format");
      }
    });

    it("fails when unsigned JWT-like tokens are supplied", async () => {
      const result = await verifyFirebaseIdToken("unsigned_jwt_header.payload.signature");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
        expect(result.code).toBe("UNAUTHENTICATED");
      }
    });

    it("fails when arbitrary Authorization strings are supplied", async () => {
      const result = await verifyFirebaseIdToken("arbitrary_string_not_a_token");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
      }
    });

    it("fails when expired tokens are supplied with TOKEN_EXPIRED code", async () => {
      const result = await verifyFirebaseIdToken("expired_id_token");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
        expect(result.code).toBe("TOKEN_EXPIRED");
        expect(result.message).toContain("expired");
      }
    });

    it("fails when revoked tokens are supplied with TOKEN_REVOKED code", async () => {
      const result = await verifyFirebaseIdToken("revoked_id_token");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
        expect(result.code).toBe("TOKEN_REVOKED");
        expect(result.message).toContain("revoked");
      }
    });
  });

  describe("3. authenticateServerRequest & requireServerAuth", () => {
    it("rejects requests missing Authorization header with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/games/action", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const authResult = await requireServerAuth(req);
      expect("errorResponse" in authResult).toBe(true);
      if ("errorResponse" in authResult) {
        expect(authResult.errorResponse.status).toBe(401);
        const data = await authResult.errorResponse.json();
        expect(data.error.code).toBe("UNAUTHENTICATED");
      }
    });

    it("rejects requests with fake uid: header with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/games/action", {
        method: "POST",
        headers: {
          authorization: "Bearer uid:hacked_uid",
        },
        body: JSON.stringify({}),
      });

      const authResult = await requireServerAuth(req);
      expect("errorResponse" in authResult).toBe(true);
      if ("errorResponse" in authResult) {
        expect(authResult.errorResponse.status).toBe(401);
      }
    });

    it("resolves authenticated user for verified Bearer token", async () => {
      const req = new NextRequest("http://localhost:3000/api/games/action", {
        method: "POST",
        headers: {
          authorization: "Bearer valid_id_token_alice",
        },
        body: JSON.stringify({}),
      });

      const authResult = await requireServerAuth(req);
      expect("user" in authResult).toBe(true);
      if ("user" in authResult) {
        expect(authResult.user.uid).toBe("alice_verified_uid");
      }
    });
  });

  describe("4. Invariant: Client-supplied identifiers cannot override verified UID", () => {
    it("games/action rejects spoofed playerId when client supplies different playerId", async () => {
      const req = new NextRequest("http://localhost:3000/api/games/action", {
        method: "POST",
        headers: {
          authorization: "Bearer valid_id_token_alice",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          gameId: "test_game_1",
          playerId: "victim_bob_uid", // Attempting to act as bob while authenticated as alice
          clientActionId: "act_1",
          type: "ROLL_DICE",
          payload: {},
          clientTimestamp: Date.now(),
        }),
      });

      const response = await gameActionRoute(req);
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error.message).toContain("does not match authenticated user");
    });

    it("couples/accept-invite rejects spoofed acceptingUserId", async () => {
      const req = new NextRequest("http://localhost:3000/api/couples/accept-invite", {
        method: "POST",
        headers: {
          authorization: "Bearer valid_id_token_alice",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          inviteId: "test_invite_valid",
          code: "secret123",
          acceptingUserId: "victim_bob_uid", // Attempting to accept as bob while authenticated as alice
        }),
      });

      const response = await acceptInviteRoute(req);
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error.message || json.message).toContain("Access denied");
    });

    it("couples/memories rejects spoofed authorUid", async () => {
      const req = new NextRequest("http://localhost:3000/api/couples/cpl_test/memories", {
        method: "POST",
        headers: {
          authorization: "Bearer valid_id_token_alice",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          authorUid: "victim_bob_uid", // Attempting to author memory as bob while authenticated as alice
          payload: {
            title: "Trip",
            context: "Details",
          },
        }),
      });

      const response = await postMemoryRoute(req, {
        params: Promise.resolve({ coupleId: "cpl_test" }),
      });
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error.message).toContain("Access denied");
    });
  });
});

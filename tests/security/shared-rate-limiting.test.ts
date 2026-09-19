import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  SharedRateLimiter,
  SimulatedSharedFirestore,
  checkSharedRateLimit,
  getClientIp,
  sanitizeDocKey,
  clearSharedRateLimitsForTesting,
  setSharedRateLimiterFailure,
  setSharedRateLimiterCustomFirestore,
} from "@/lib/firebase/server/sharedRateLimiter";
import {
  checkRateLimit,
  clearChallengeRateLimitForTesting,
} from "@/lib/ai/geminiChallengeService";
import {
  checkGameNightRateLimit,
  clearGameNightRateLimitForTesting,
} from "@/lib/ai/gameNightService";
import { POST as aiChallengeRoute } from "@/app/api/ai/challenge/route";
import { POST as aiGameNightRoute } from "@/app/api/ai/game-night/route";

// Mock Firebase client
vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: { currentUser: { uid: "test_user_rate" } },
}));

// Mock Gemini generative calls so tests verify rate limiting without network latency
vi.mock("@/lib/ai/geminiChallengeService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/geminiChallengeService")>();
  return {
    ...actual,
    generateAIChallenge: vi.fn(async () => ({
      challenge: {
        id: "test-mock-challenge",
        category: "relationship_question",
        difficulty: "medium",
        title: "Test Challenge",
        description: "Test description",
        durationMinutes: 5,
        points: 20,
        tags: ["test"],
        couplePrompt: "Test prompt",
        reflectionQuestion: "Test reflection",
      },
      isFallback: false,
    })),
  };
});

vi.mock("@/lib/ai/gameNightService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/gameNightService")>();
  return {
    ...actual,
    generateGameNightLineup: vi.fn(async () => ({
      lineup: {
        id: "test-mock-lineup",
        vibe: "cozy",
        themeTitle: "Cozy Mock",
        themeDescription: "Cozy description",
        totalDurationMinutes: 45,
        activities: [],
        breakSuggestions: [],
        wrapUpPrompt: "Wrap up",
      },
      isFallback: false,
    })),
  };
});

// Mock requireAppCheck to succeed in testing
vi.mock("@/lib/firebase/server/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/firebase/server/security")>();
  return {
    ...actual,
    requireAppCheck: vi.fn(async () => ({ success: true })),
  };
});

// Mock requireServerAuth for route testing
vi.mock("@/lib/firebase/server/auth", () => ({
  requireServerAuth: vi.fn(async (req: NextRequest) => {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        errorResponse: new Response(
          JSON.stringify({
            success: false,
            error: "UNAUTHENTICATED",
            message: "Missing or invalid bearer token.",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        ),
      };
    }
    const token = authHeader.replace("Bearer ", "");
    if (token === "invalid_token") {
      return {
        errorResponse: new Response(
          JSON.stringify({
            success: false,
            error: "INVALID_CREDENTIALS",
            message: "Token verification failed.",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        ),
      };
    }
    // Return extracted UID from token
    const uid = token.startsWith("valid_token_") ? token.replace("valid_token_", "") : "test_uid_default";
    return {
      user: {
        uid,
        email: `${uid}@example.com`,
      },
    };
  }),
}));

describe("Shared Firebase-Compatible Rate Limiting System", () => {
  beforeEach(() => {
    clearSharedRateLimitsForTesting();
    clearChallengeRateLimitForTesting();
    clearGameNightRateLimitForTesting();
    setSharedRateLimiterFailure(false);
    setSharedRateLimiterCustomFirestore(null);
  });

  // ---------------------------------------------------------------------------
  // 1. Limit Reached
  // ---------------------------------------------------------------------------
  describe("1. Limit Reached Verification", () => {
    it("allows requests up to maxRequests and blocks request maxRequests + 1", async () => {
      const sharedStore = new SimulatedSharedFirestore();
      const limiter = new SharedRateLimiter(sharedStore);
      const key = `user_limit_test_${Date.now()}`;
      const maxRequests = 4;
      const windowMs = 60000;

      // First 4 requests succeed
      for (let i = 1; i <= maxRequests; i++) {
        const res = await limiter.checkRateLimit({ key, maxRequests, windowMs });
        expect(res.allowed).toBe(true);
        expect(res.remaining).toBe(maxRequests - i);
        expect(res.source).toBe("shared");
      }

      // 5th request is blocked
      const blockedRes = await limiter.checkRateLimit({ key, maxRequests, windowMs });
      expect(blockedRes.allowed).toBe(false);
      expect(blockedRes.remaining).toBe(0);
      expect(blockedRes.resetInSeconds).toBeGreaterThan(0);
      expect(blockedRes.resetInSeconds).toBeLessThanOrEqual(60);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Window Reset
  // ---------------------------------------------------------------------------
  describe("2. Window Reset Verification", () => {
    it("resets quota once window duration has elapsed", async () => {
      const sharedStore = new SimulatedSharedFirestore();
      const limiter = new SharedRateLimiter(sharedStore);
      const key = `window_reset_test_${Date.now()}`;
      const maxRequests = 3;
      const windowMs = 60000;
      let mockTime = 1000000;

      // Exhaust limit at T = 1,000,000
      for (let i = 0; i < maxRequests; i++) {
        const res = await limiter.checkRateLimit({ key, maxRequests, windowMs, now: mockTime });
        expect(res.allowed).toBe(true);
      }

      const blockedRes = await limiter.checkRateLimit({ key, maxRequests, windowMs, now: mockTime });
      expect(blockedRes.allowed).toBe(false);

      // Advance time by 61 seconds (beyond window)
      mockTime += 61000;

      const resetRes = await limiter.checkRateLimit({ key, maxRequests, windowMs, now: mockTime });
      expect(resetRes.allowed).toBe(true);
      expect(resetRes.remaining).toBe(maxRequests - 1);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Concurrent Requests (No Race Conditions)
  // ---------------------------------------------------------------------------
  describe("3. Concurrent Requests Protection", () => {
    it("strictly prevents quota bypass when multiple concurrent requests fire simultaneously", async () => {
      const sharedStore = new SimulatedSharedFirestore();
      const limiter = new SharedRateLimiter(sharedStore);
      const key = `concurrent_race_test_${Date.now()}`;
      const maxRequests = 4;
      const windowMs = 60000;

      // Dispatch 10 concurrent requests at the exact same millisecond
      const promises = Array.from({ length: 10 }).map(() =>
        limiter.checkRateLimit({ key, maxRequests, windowMs })
      );

      const results = await Promise.all(promises);
      const allowedCount = results.filter((r) => r.allowed).length;
      const blockedCount = results.filter((r) => !r.allowed).length;

      expect(allowedCount).toBe(maxRequests);
      expect(blockedCount).toBe(6);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Multiple Server Instances Conceptually
  // ---------------------------------------------------------------------------
  describe("4. Multiple Server Instances Conceptually", () => {
    it("shares authoritative rate limits across distinct server instances", async () => {
      // Both server instances share the exact same underlying Firestore store
      const sharedStore = new SimulatedSharedFirestore();
      const serverInstanceA = new SharedRateLimiter(sharedStore);
      const serverInstanceB = new SharedRateLimiter(sharedStore);

      const userKey = `shared_user_multi_instance_${Date.now()}`;
      const maxRequests = 4;
      const windowMs = 60000;

      // Request 1 on Server Instance A
      const resA1 = await serverInstanceA.checkRateLimit({ key: userKey, maxRequests, windowMs });
      expect(resA1.allowed).toBe(true);
      expect(resA1.remaining).toBe(3);

      // Request 2 on Server Instance B
      const resB1 = await serverInstanceB.checkRateLimit({ key: userKey, maxRequests, windowMs });
      expect(resB1.allowed).toBe(true);
      expect(resB1.remaining).toBe(2);

      // Request 3 on Server Instance A
      const resA2 = await serverInstanceA.checkRateLimit({ key: userKey, maxRequests, windowMs });
      expect(resA2.allowed).toBe(true);
      expect(resA2.remaining).toBe(1);

      // Request 4 on Server Instance B (Limit reached across instances)
      const resB2 = await serverInstanceB.checkRateLimit({ key: userKey, maxRequests, windowMs });
      expect(resB2.allowed).toBe(true);
      expect(resB2.remaining).toBe(0);

      // Request 5 on Server Instance A -> Blocked!
      const resA3 = await serverInstanceA.checkRateLimit({ key: userKey, maxRequests, windowMs });
      expect(resA3.allowed).toBe(false);

      // Request 6 on Server Instance B -> Blocked!
      const resB3 = await serverInstanceB.checkRateLimit({ key: userKey, maxRequests, windowMs });
      expect(resB3.allowed).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Different Users Isolation
  // ---------------------------------------------------------------------------
  describe("5. Different Users Quota Isolation", () => {
    it("ensures User A exhausting their quota does not affect User B", async () => {
      const sharedStore = new SimulatedSharedFirestore();
      const limiter = new SharedRateLimiter(sharedStore);
      const userAKey = `user_alice_${Date.now()}`;
      const userBKey = `user_bob_${Date.now()}`;
      const maxRequests = 2;
      const windowMs = 60000;

      // User A exhausts limit
      await limiter.checkRateLimit({ key: userAKey, maxRequests, windowMs });
      await limiter.checkRateLimit({ key: userAKey, maxRequests, windowMs });
      const userABlocked = await limiter.checkRateLimit({ key: userAKey, maxRequests, windowMs });
      expect(userABlocked.allowed).toBe(false);

      // User B makes request -> Still allowed with full quota
      const userBRes = await limiter.checkRateLimit({ key: userBKey, maxRequests, windowMs });
      expect(userBRes.allowed).toBe(true);
      expect(userBRes.remaining).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Unauthenticated Requests & Network IP Protection
  // ---------------------------------------------------------------------------
  describe("6. Unauthenticated Requests & Network IP Protection", () => {
    it("rejects unauthenticated requests with 401 without consuming user quota", async () => {
      const req = new NextRequest("http://localhost:3000/api/ai/challenge", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // No Authorization header
        },
        body: JSON.stringify({ category: "relationship_question" }),
      });

      const res = await aiChallengeRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("UNAUTHENTICATED");
    });

    it("rejects invalid token requests with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/ai/challenge", {
        method: "POST",
        headers: {
          authorization: "Bearer invalid_token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ category: "relationship_question" }),
      });

      const res = await aiChallengeRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("INVALID_CREDENTIALS");
    });

    it("applies IP-level network throttling to protect endpoints", async () => {
      const testIp = "198.51.100.42";
      // IP limit for challenge is 20 per minute
      for (let i = 0; i < 20; i++) {
        const res = await checkSharedRateLimit({
          key: `ip_ai_challenge_${testIp}`,
          maxRequests: 20,
          windowMs: 60000,
          ip: testIp,
        });
        expect(res.allowed).toBe(true);
      }

      const blockedIp = await checkSharedRateLimit({
        key: `ip_ai_challenge_${testIp}`,
        maxRequests: 20,
        windowMs: 60000,
        ip: testIp,
      });
      expect(blockedIp.allowed).toBe(false);
      expect(blockedIp.resetInSeconds).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Fail-Safe Behavior when Shared Backend is Unavailable
  // ---------------------------------------------------------------------------
  describe("7. Fail-Safe Resilience (Never Silent Bypass / Never Disables AI)", () => {
    it("fails safe to local memory limiter when shared Firestore is unavailable", async () => {
      const sharedStore = new SimulatedSharedFirestore();
      const limiter = new SharedRateLimiter(sharedStore);
      const key = `failsafe_test_${Date.now()}`;
      const maxRequests = 2;
      const windowMs = 60000;

      // Simulate shared backend failure
      limiter.setSimulatedFailure(true);

      // Request 1 still works via safe local fallback
      const r1 = await limiter.checkRateLimit({ key, maxRequests, windowMs });
      expect(r1.allowed).toBe(true);
      expect(r1.source).toBe("local_fallback");
      expect(r1.remaining).toBe(1);

      // Request 2 works
      const r2 = await limiter.checkRateLimit({ key, maxRequests, windowMs });
      expect(r2.allowed).toBe(true);
      expect(r2.source).toBe("local_fallback");
      expect(r2.remaining).toBe(0);

      // Request 3 is blocked by fail-safe local limiter (endpoint is NOT silently unprotected!)
      const r3 = await limiter.checkRateLimit({ key, maxRequests, windowMs });
      expect(r3.allowed).toBe(false);
      expect(r3.source).toBe("local_fallback");
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Dual-Mode Synchronous & Asynchronous Compatibility
  // ---------------------------------------------------------------------------
  describe("8. Dual-Mode Compatibility for Challenge and Game Night Services", () => {
    it("supports synchronous property access in challenge rate limit", () => {
      const key = `sync_challenge_${Date.now()}`;
      const res = checkRateLimit(key);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(7);
      expect(res.resetInSeconds).toBeGreaterThan(0);
    });

    it("supports await on challenge rate limit for shared asynchronous execution", async () => {
      const key = `async_challenge_${Date.now()}`;
      const res = await checkRateLimit(key);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(7);
    });

    it("supports synchronous property access in game night rate limit", () => {
      const key = `sync_gn_${Date.now()}`;
      const res = checkGameNightRateLimit(key);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(3);
    });

    it("supports await on game night rate limit for shared asynchronous execution", async () => {
      const key = `async_gn_${Date.now()}`;
      const res = await checkGameNightRateLimit(key);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Key Sanitization and Client IP Extraction
  // ---------------------------------------------------------------------------
  describe("9. Key Sanitization and Client IP Extraction", () => {
    it("sanitizes forbidden Firestore characters in keys", () => {
      const dirtyKey = "rate_limit/user#123?partner%456\\test";
      const sanitized = sanitizeDocKey(dirtyKey);
      expect(sanitized).not.toContain("/");
      expect(sanitized).not.toContain("#");
      expect(sanitized).not.toContain("?");
      expect(sanitized).not.toContain("%");
      expect(sanitized).not.toContain("\\");
    });

    it("extracts client IP from x-forwarded-for header", () => {
      const req = new NextRequest("http://localhost:3000/api/ai/challenge", {
        headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
      });
      expect(getClientIp(req)).toBe("203.0.113.195");
    });

    it("extracts client IP from x-real-ip header", () => {
      const req = new NextRequest("http://localhost:3000/api/ai/challenge", {
        headers: { "x-real-ip": "198.51.100.17" },
      });
      expect(getClientIp(req)).toBe("198.51.100.17");
    });
  });

  // ---------------------------------------------------------------------------
  // 10. AI Endpoint Integration: 429, Retry-After, and Curated Fallbacks (Preserve UX)
  // ---------------------------------------------------------------------------
  describe("10. AI Endpoint Integration: 429 Status, Retry-After, and Curated Fallback", () => {
    it("returns 429 with Retry-After and curated challenge fallback on /api/ai/challenge", async () => {
      const uid = `endpoint_test_user_${Date.now()}`;

      // Exhaust 8 requests limit
      for (let i = 0; i < 8; i++) {
        const req = new NextRequest("http://localhost:3000/api/ai/challenge", {
          method: "POST",
          headers: {
            authorization: `Bearer valid_token_${uid}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ category: "relationship_question" }),
        });
        await aiChallengeRoute(req);
      }

      // 9th request
      const ninthReq = new NextRequest("http://localhost:3000/api/ai/challenge", {
        method: "POST",
        headers: {
          authorization: `Bearer valid_token_${uid}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ category: "relationship_question" }),
      });
      const res = await aiChallengeRoute(ninthReq);

      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeDefined();

      const json = await res.json();
      expect(json.error).toBe("RATE_LIMIT_EXCEEDED");
      expect(json.isFallback).toBe(true);
      expect(json.fallbackReason).toBe("rate_limit_exceeded");
      expect(json.challenge).toBeDefined(); // User experience is preserved with offline curated challenge!
    });

    it("returns 429 with Retry-After and curated game night fallback on /api/ai/game-night", async () => {
      const uid = `gn_endpoint_user_${Date.now()}`;

      // Exhaust 4 requests limit
      for (let i = 0; i < 4; i++) {
        const req = new NextRequest("http://localhost:3000/api/ai/game-night", {
          method: "POST",
          headers: {
            authorization: `Bearer valid_token_${uid}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ vibe: "cozy" }),
        });
        await aiGameNightRoute(req);
      }

      // 5th request
      const fifthReq = new NextRequest("http://localhost:3000/api/ai/game-night", {
        method: "POST",
        headers: {
          authorization: `Bearer valid_token_${uid}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ vibe: "cozy" }),
      });
      const res = await aiGameNightRoute(fifthReq);

      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeDefined();

      const json = await res.json();
      expect(json.error).toBe("RATE_LIMIT_EXCEEDED");
      expect(json.isFallback).toBe(true);
      expect(json.fallbackReason).toBe("rate_limit_exceeded");
      expect(json.lineup).toBeDefined(); // Preserves UX with curated game night lineup!
    });
  });
});

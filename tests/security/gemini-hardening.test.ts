import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as aiChallengeRoute, GET as getAIChallengeRoute } from "@/app/api/ai/challenge/route";
import { POST as aiGameNightRoute } from "@/app/api/ai/game-night/route";
import {
  generateAIChallenge,
  AIChallengeOutputSchema,
  cleanUntrustedInput,
} from "@/lib/ai/geminiChallengeService";
import {
  generateGameNightLineup,
} from "@/lib/ai/gameNightService";
import {
  GameNightLineupSchema,
} from "@/lib/ai/gameNightTypes";

// Mock Firebase Admin SDK for auth
vi.mock("@/lib/firebase/server/admin", () => ({
  getAdminAuth: vi.fn(() => ({
    verifyIdToken: vi.fn(async (token: string) => {
      if (token && (token.startsWith("valid_token_") || token === "valid_id_token")) {
        const uid = token.startsWith("valid_token_") ? token.replace("valid_token_", "") : "user_authed_test";
        return {
          uid,
          sub: uid,
          email: `${uid}@example.com`,
          email_verified: true,
          auth_time: Math.floor(Date.now() / 1000),
        };
      }
      const err = new Error("Invalid or unverified Firebase ID token.");
      (err as unknown as { code: string }).code = "auth/invalid-id-token";
      throw err;
    }),
  })),
  getAdminFirestore: vi.fn(() => ({})),
  getAdminDatabase: vi.fn(() => ({})),
  getAdminApp: vi.fn(() => ({})),
  isAdminFirebaseConfigured: vi.fn(() => true),
}));

// Mock @google/genai SDK
const mockGenerateContent = vi.fn();
vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models = {
        generateContent: mockGenerateContent,
      };
    },
    Type: {
      OBJECT: "OBJECT",
      STRING: "STRING",
      INTEGER: "INTEGER",
      ARRAY: "ARRAY",
    },
  };
});

describe("Hardened Gemini AI Integration & Security Boundaries", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, GEMINI_API_KEY: "test-fake-gemini-key" };
  });

  // -------------------------------------------------------------------------
  // 1. Authentication & Identity Directives
  // -------------------------------------------------------------------------
  describe("1. Authentication & Identity Integrity", () => {
    it("rejects unauthenticated requests to POST /api/ai/challenge with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/ai/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: "relationship_question" }),
      });

      const res = await aiChallengeRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHENTICATED");
    });

    it("rejects unauthenticated requests to GET /api/ai/challenge with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/ai/challenge?category=relationship_question", {
        method: "GET",
      });

      const res = await getAIChallengeRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHENTICATED");
    });

    it("rejects unauthenticated requests to POST /api/ai/game-night with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/ai/game-night", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vibe: "cozy" }),
      });

      const res = await aiGameNightRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHENTICATED");
    });

    it("rejects invalid/forged Bearer tokens with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/ai/challenge", {
        method: "POST",
        headers: {
          authorization: "Bearer forged_fake_token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ category: "quick_game" }),
      });

      const res = await aiChallengeRoute(req);
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Strict Input Validation & Length Limits
  // -------------------------------------------------------------------------
  describe("2. Strict Request Validation & Bound Enforcement", () => {
    it("rejects unallowed or injected fields in /api/ai/challenge payload with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/ai/challenge", {
        method: "POST",
        headers: {
          authorization: "Bearer valid_token_user_alex",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          category: "relationship_question",
          // Injection attack attempt: client trying to pass score, winner, role, or userId
          score: 100,
          winner: "user_alex",
          role: "admin",
          userId: "hacked_user",
        }),
      });

      const res = await aiChallengeRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("INVALID_REQUEST_PARAMETERS");
    });

    it("rejects unallowed or injected fields in /api/ai/game-night payload with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/ai/game-night", {
        method: "POST",
        headers: {
          authorization: "Bearer valid_token_user_alex",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          vibe: "cozy",
          // Injection attack attempt: client trying to manipulate game state or permissions
          gameState: { completed: true },
          permissions: ["all"],
          deleteMemories: true,
        }),
      });

      const res = await aiGameNightRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("INVALID_REQUEST_PARAMETERS");
    });

    it("rejects partner name exceeding length limits (>50 chars) with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/ai/challenge", {
        method: "POST",
        headers: {
          authorization: "Bearer valid_token_user_alex",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          partnerNames: {
            p1: "A".repeat(51),
          },
        }),
      });

      const res = await aiChallengeRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("INVALID_REQUEST_PARAMETERS");
    });

    it("rejects malformed JSON payload with 400 INVALID_JSON", async () => {
      const req = new NextRequest("http://localhost:3000/api/ai/challenge", {
        method: "POST",
        headers: {
          authorization: "Bearer valid_token_user_alex",
          "content-type": "application/json",
        },
        body: "NOT_VALID_JSON{{{",
      });

      const res = await aiChallengeRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("INVALID_JSON");
    });
  });

  // -------------------------------------------------------------------------
  // 3. Untrusted Input Cleaning & Defense in Depth
  // -------------------------------------------------------------------------
  describe("3. Untrusted Input Cleaning", () => {
    it("strips control characters, XML tags, and limits length", () => {
      const input = "Hello <script>alert(1)</script> World \u0000\u001F Test!";
      const cleaned = cleanUntrustedInput(input, 30);
      expect(cleaned).not.toContain("<");
      expect(cleaned).not.toContain(">");
      expect(cleaned).not.toContain("\u0000");
      expect(cleaned.length).toBeLessThanOrEqual(30);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Rate Limiting Directives
  // -------------------------------------------------------------------------
  describe("4. Rate Limiting Enforced per Verified UID", () => {
    it("returns 429 with Retry-After when rate limit is exceeded", async () => {
      const uid = `rate_limit_test_user_${Date.now()}`;
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify({
          title: "Starlight Connection",
          instructions: "Share a childhood memory with your partner.",
          durationSeconds: 60,
          difficulty: "playful",
          category: "relationship_question",
          safetyLevel: "family_safe",
        }),
      });

      let lastRes: Response | null = null;
      // The challenge rate limiter allows 8 requests per 60 seconds
      for (let i = 0; i < 10; i++) {
        const req = new NextRequest("http://localhost:3000/api/ai/challenge", {
          method: "POST",
          headers: {
            authorization: `Bearer valid_token_${uid}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ category: "relationship_question" }),
        });
        lastRes = await aiChallengeRoute(req);
      }

      expect(lastRes).not.toBeNull();
      expect(lastRes!.status).toBe(429);
      expect(lastRes!.headers.get("Retry-After")).toBeDefined();
      const json = await lastRes!.json();
      expect(json.error).toBe("RATE_LIMIT_EXCEEDED");
      expect(json.isFallback).toBe(true);
      expect(json.challenge).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 5. Untrusted AI Output Handling & Strict Schema Validation
  // -------------------------------------------------------------------------
  describe("5. Untrusted AI Output Validation & Fallback Handling", () => {
    it("falls back gracefully with 'malformed_output' when Gemini returns invalid JSON", async () => {
      mockGenerateContent.mockResolvedValue({
        text: "This is plain conversational text, not valid JSON { broken",
      });

      const result = await generateAIChallenge({
        category: "camera_challenge",
        difficulty: "playful",
      });

      expect(result.isFallback).toBe(true);
      expect(result.fallbackReason).toBe("malformed_output");
      expect(result.challenge).toBeDefined();
      expect(result.challenge.isAIGenerated).toBe(false);
    });

    it("falls back gracefully with 'schema_violation' when Gemini returns JSON missing required fields", async () => {
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify({
          title: "Incomplete Challenge",
          // missing instructions, durationSeconds, difficulty, etc.
        }),
      });

      const result = await generateAIChallenge({
        category: "relationship_question",
        difficulty: "playful",
      });

      expect(result.isFallback).toBe(true);
      expect(result.fallbackReason).toBe("schema_violation");
      expect(result.challenge).toBeDefined();
    });

    it("falls back gracefully with 'schema_violation' when Gemini attempts to return extra unexpected properties", async () => {
      // Because AIChallengeOutputSchema is .strict(), unexpected properties trigger a schema violation
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify({
          title: "Compromised Challenge",
          instructions: "Test instructions for the couple.",
          durationSeconds: 60,
          difficulty: "playful",
          category: "relationship_question",
          safetyLevel: "family_safe",
          // Injected malicious fields that AI should never produce
          winner: "p1",
          scoreGranted: 9999,
          bypassAuth: true,
        }),
      });

      const result = await generateAIChallenge({
        category: "relationship_question",
        difficulty: "playful",
      });

      expect(result.isFallback).toBe(true);
      expect(result.fallbackReason).toBe("schema_violation");
    });

    it("falls back gracefully with 'empty_response' when Gemini returns empty or whitespace output", async () => {
      mockGenerateContent.mockResolvedValue({
        text: "   ",
      });

      const result = await generateAIChallenge({
        category: "quick_game",
        difficulty: "gentle",
      });

      expect(result.isFallback).toBe(true);
      expect(result.fallbackReason).toBe("empty_response");
    });

    it("falls back gracefully with 'timeout' when Gemini generation exceeds deadline", async () => {
      mockGenerateContent.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 500))
      );

      const result = await generateAIChallenge({
        category: "fun_challenge",
        difficulty: "playful",
        timeoutMs: 50, // fast timeout for test
      });

      expect(result.isFallback).toBe(true);
      expect(result.fallbackReason).toBe("timeout");
    });

    it("falls back gracefully with 'gemini_api_key_not_configured' when API key is missing", async () => {
      delete process.env.GEMINI_API_KEY;

      const result = await generateAIChallenge({
        category: "relationship_question",
        difficulty: "playful",
      });

      expect(result.isFallback).toBe(true);
      expect(result.fallbackReason).toBe("gemini_api_key_not_configured");
    });
  });

  // -------------------------------------------------------------------------
  // 6. AI Game Night Execution by Deterministic Game Engine
  // -------------------------------------------------------------------------
  describe("6. AI Game Night produces structured definitions for deterministic engine", () => {
    it("Game Night output schema strictly enforces exactly 5 activities and structured definitions", () => {
      const validActivity = {
        id: "act_1",
        roundNumber: 1,
        type: "find_it_first" as const,
        title: "Tokyo & London Search",
        subtitle: "Find an item with Japanese characters or a British emblem",
        hostIntro: "Welcome couple! Let's kick off with a quick search around your rooms.",
        estimatedMinutes: 3,
        promptData: {
          prompt: "Find something in your room that was made in Asia or Europe.",
          category: "scavenger",
          guidance: "Show your item to your partner on video.",
        },
      };

      const validLineup = {
        theme: "Global Cozy Night",
        themeDescription: "Bridging the distance between Tokyo and London.",
        hostWelcome: "Welcome Alex and Sam to your personalized game night session!",
        activities: [
          validActivity,
          { ...validActivity, id: "act_2", roundNumber: 2, type: "quick_question" as const },
          { ...validActivity, id: "act_3", roundNumber: 3, type: "camera_challenge" as const },
          { ...validActivity, id: "act_4", roundNumber: 4, type: "speed_duel" as const },
          { ...validActivity, id: "act_5", roundNumber: 5, type: "final_challenge" as const },
        ],
      };

      const parsed = GameNightLineupSchema.safeParse(validLineup);
      expect(parsed.success).toBe(true);

      // Verify strictness: rejecting an unauthorized field like 'winner' or 'scores'
      const compromised = {
        ...validLineup,
        scores: { p1: 100, p2: 50 },
        winner: "p1",
      };
      const compromisedParsed = GameNightLineupSchema.safeParse(compromised);
      expect(compromisedParsed.success).toBe(false);
    });

    it("AI Game Night generation falls back gracefully with curated 5-round definition on schema violation", async () => {
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify({
          theme: "Broken Game Night",
          themeDescription: "Missing activities",
          hostWelcome: "Hello!",
          activities: [], // schema requires exactly 5
        }),
      });

      const result = await generateGameNightLineup({
        partnerNames: { p1: "Alex", p2: "Sam" },
        partnerCities: { p1: "London", p2: "Tokyo" },
        vibe: "cozy",
      });

      expect(result.isFallback).toBe(true);
      expect(result.fallbackReason).toBe("schema_violation");
      expect(result.lineup.activities).toHaveLength(5);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Security: Credentials Server-Only & No Client Leakage
  // -------------------------------------------------------------------------
  describe("7. Server-Side Secret Isolation", () => {
    it("never returns GEMINI_API_KEY in API responses", async () => {
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify({
          title: "Secret Test",
          instructions: "Instructions",
          durationSeconds: 60,
          difficulty: "playful",
          category: "relationship_question",
          safetyLevel: "family_safe",
        }),
      });

      const req = new NextRequest("http://localhost:3000/api/ai/challenge", {
        method: "POST",
        headers: {
          authorization: "Bearer valid_token_user_alex",
          "content-type": "application/json",
        },
        body: JSON.stringify({ category: "relationship_question" }),
      });

      const res = await aiChallengeRoute(req);
      const text = await res.text();
      expect(text).not.toContain("test-fake-gemini-key");
    });
  });
});

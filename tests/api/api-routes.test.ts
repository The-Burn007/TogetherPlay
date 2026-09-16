import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as gameActionRoute } from "@/app/api/games/action/route";
import { POST as gameSessionRoute, GET as getGameSessionRoute } from "@/app/api/games/session/route";
import { POST as acceptInviteRoute } from "@/app/api/couples/accept-invite/route";
import { GET as getMemoriesRoute, POST as postMemoryRoute } from "@/app/api/couples/[coupleId]/memories/route";
import { POST as aiChallengeRoute } from "@/app/api/ai/challenge/route";
import { POST as aiGameNightRoute } from "@/app/api/ai/game-night/route";

// Mock Firebase client & firestore
vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: { currentUser: { uid: "user_mock_api" } },
}));

// Mock AI Services for predictable, rapid API testing
vi.mock("@/lib/ai/geminiChallengeService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/geminiChallengeService")>();
  return {
    ...actual,
    generateAIChallenge: vi.fn().mockResolvedValue({
      challenge: {
        id: "mock_ai_chal_1",
        title: "City Lights Connection",
        instructions: "Describe the view from your window right now to your partner.",
        durationSeconds: 120,
        difficulty: "playful",
        category: "relationship_question",
        safetyLevel: "family_safe",
      },
      isFallback: false,
    }),
  };
});

vi.mock("@/lib/ai/gameNightService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/gameNightService")>();
  return {
    ...actual,
    generateGameNightLineup: vi.fn().mockResolvedValue({
      lineup: {
        id: "mock_lineup_1",
        title: "London & Tokyo Romantic Stroll",
        theme: "romantic_journey",
        tagline: "Connecting across timezones",
        estimatedMinutes: 45,
        rounds: [
          {
            roundNumber: 1,
            gameType: "find_it_first",
            title: "Warm-Up Scavenger",
            description: "Find the shared heart symbol",
            targetDurationMinutes: 8,
            recommendedVibe: "playful",
          },
        ],
      },
      isFallback: false,
    }),
  };
});

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db, collection, id) => ({ collection, id, path: `${collection}/${id}` })),
  getDoc: vi.fn(async (ref: { collection: string; id: string }) => {
    if (ref.id === "expired_invite") {
      return {
        exists: () => true,
        data: () => ({
          inviteId: "expired_invite",
          coupleId: "cpl_1",
          inviterId: "user_a",
          status: "pending",
          tokenHash: "abc",
          expiresAt: new Date(Date.now() - 10000).toISOString(),
        }),
      };
    }
    if (ref.id === "used_invite") {
      return {
        exists: () => true,
        data: () => ({
          inviteId: "used_invite",
          coupleId: "cpl_1",
          inviterId: "user_a",
          status: "accepted",
          tokenHash: "abc",
          expiresAt: new Date(Date.now() + 100000).toISOString(),
        }),
      };
    }
    if (ref.collection === "couples" && ref.id === "cpl_demo") {
      return {
        exists: () => true,
        data: () => ({
          coupleId: "cpl_demo",
          name: "Demo Couple",
          memberIds: ["user_a", "user_b"],
        }),
      };
    }
    return {
      exists: () => false,
      data: () => null,
    };
  }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
}));

describe("API Layer: Route Handlers Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. POST /api/games/action", () => {
    it("rejects unauthenticated action requests with 401 Unauthorized", async () => {
      const req = new NextRequest("http://localhost:3000/api/games/action", {
        method: "POST",
        body: JSON.stringify({
          gameId: "game_test_1",
          clientActionId: "act_1",
          type: "ROLL_DICE",
          payload: {},
          clientTimestamp: Date.now(),
        }),
      });

      const response = await gameActionRoute(req);
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error.message).toContain("Authentication required");
    });

    it("rejects malformed action body with 400 Bad Request", async () => {
      const req = new NextRequest("http://localhost:3000/api/games/action", {
        method: "POST",
        headers: {
          authorization: "Bearer uid:user_authed_1",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          // missing gameId and type
          action: "invalid",
        }),
      });

      const response = await gameActionRoute(req);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error.message).toContain("Action validation failed");
    });

    it("rejects attempts to inject authoritative fields into action payload with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/games/action", {
        method: "POST",
        headers: {
          authorization: "Bearer uid:user_authed_1",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          gameId: "game_test_1",
          clientActionId: "act_1",
          type: "SELECT_CELL",
          payload: { score: 9999 },
          clientTimestamp: Date.now(),
        }),
      });

      const response = await gameActionRoute(req);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error.message).toContain("Client cannot submit authoritative field 'score'");
    });
  });

  describe("2. POST & GET /api/games/session", () => {
    it("creates an authoritative session cleanly with 201 status", async () => {
      const req = new NextRequest("http://localhost:3000/api/games/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          coupleId: "cpl_valid_1",
          gameType: "find_it_first",
          playerIds: ["user_a", "user_b"],
        }),
      });

      const response = await gameSessionRoute(req);
      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.session).toBeDefined();
      expect(json.session.gameId).toBeDefined();
      expect(json.session.gameType).toBe("find_it_first");
      expect(json.session.playerIds).toContain("user_a");
      expect(json.state).toBeDefined();
    });

    it("fetches active session using GET /api/games/session?gameId=...", async () => {
      // First create a session to query
      const createReq = new NextRequest("http://localhost:3000/api/games/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gameId: "test_session_query_1",
          coupleId: "cpl_valid_1",
          gameType: "speed_duel",
          playerIds: ["user_a", "user_b"],
        }),
      });
      await gameSessionRoute(createReq);

      const req = new NextRequest("http://localhost:3000/api/games/session?gameId=test_session_query_1");
      const response = await getGameSessionRoute(req);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.session).toBeDefined();
      expect(json.session.gameId).toBe("test_session_query_1");
    });
  });

  describe("3. POST /api/couples/accept-invite", () => {
    it("rejects invitation acceptance when missing required parameters with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/couples/accept-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId: "inv_123" }), // missing code and acceptingUserId
      });

      const response = await acceptInviteRoute(req);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("Missing required invitation parameters");
    });

    it("rejects expired invitations with 410 Gone", async () => {
      const req = new NextRequest("http://localhost:3000/api/couples/accept-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inviteId: "expired_invite",
          code: "SANCT-TEST-CODE",
          acceptingUserId: "user_b",
        }),
      });

      const response = await acceptInviteRoute(req);
      expect(response.status).toBe(410);
      const json = await response.json();
      expect(json.error).toContain("expired");
    });

    it("rejects already accepted invitations with 409 Conflict", async () => {
      const req = new NextRequest("http://localhost:3000/api/couples/accept-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inviteId: "used_invite",
          code: "SANCT-TEST-CODE",
          acceptingUserId: "user_b",
        }),
      });

      const response = await acceptInviteRoute(req);
      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.error).toContain("already been accepted");
    });
  });

  describe("4. GET & POST /api/couples/[coupleId]/memories", () => {
    it("returns curated memories for couples on GET", async () => {
      const req = new NextRequest("http://localhost:3000/api/couples/cpl_demo/memories", {
        headers: {
          authorization: "Bearer uid:user_a",
        },
      });

      const response = await getMemoriesRoute(req, {
        params: Promise.resolve({ coupleId: "cpl_demo" }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.memories).toBeDefined();
      expect(Array.isArray(json.memories)).toBe(true);
      expect(json.memories.length).toBeGreaterThan(0);
    });

    it("rejects memory creations without authentication with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/couples/cpl_demo/memories", {
        method: "POST",
        body: JSON.stringify({
          payload: { title: "Our Paris Trip", context: "Eiffel Tower" },
        }),
      });

      const response = await postMemoryRoute(req, {
        params: Promise.resolve({ coupleId: "cpl_demo" }),
      });

      expect(response.status).toBe(401);
    });

    it("rejects memory creation when missing title or context with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/couples/cpl_demo/memories", {
        method: "POST",
        headers: {
          authorization: "Bearer uid:user_a",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          authorUid: "user_a",
          authorName: "Alex",
          payload: {
            // missing title and context
          },
        }),
      });

      const response = await postMemoryRoute(req, {
        params: Promise.resolve({ coupleId: "cpl_demo" }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("Missing required fields");
    });

    it("creates couple memory successfully when authenticated and valid payload provided", async () => {
      const req = new NextRequest("http://localhost:3000/api/couples/cpl_demo/memories", {
        method: "POST",
        headers: {
          authorization: "Bearer uid:user_a",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          authorUid: "user_a",
          authorName: "Alex",
          payload: {
            title: "First Game Night Victory",
            context: "Won Find It First by 2 seconds",
            type: "game_victory",
            note: "A memorable match together!",
          },
        }),
      });

      const response = await postMemoryRoute(req, {
        params: Promise.resolve({ coupleId: "cpl_demo" }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.memory).toBeDefined();
      expect(json.memory.title).toBe("First Game Night Victory");
    });
  });

  describe("5. POST /api/ai/challenge & /api/ai/game-night", () => {
    it("generates structured curated challenge", async () => {
      const req = new NextRequest("http://localhost:3000/api/ai/challenge", {
        method: "POST",
        headers: {
          authorization: "Bearer uid:user_alex",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          category: "relationship_question",
          difficulty: "playful",
          partnerNames: { p1: "Alex", p2: "Sam" },
        }),
      });

      const response = await aiChallengeRoute(req);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.challenge).toBeDefined();
      expect(json.challenge.title).toBeDefined();
    });

    it("generates complete curated game night itinerary", async () => {
      const req = new NextRequest("http://localhost:3000/api/ai/game-night", {
        method: "POST",
        headers: {
          authorization: "Bearer uid:user_alex",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          partnerNames: { p1: "Alex", p2: "Sam" },
          partnerCities: { p1: "London", p2: "Tokyo" },
          vibe: "cozy",
        }),
      });

      const response = await aiGameNightRoute(req);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.lineup).toBeDefined();
      expect(json.lineup.title).toBeDefined();
    });
  });
});

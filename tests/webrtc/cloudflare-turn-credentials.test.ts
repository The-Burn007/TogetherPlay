import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isCloudflareTurnConfigured,
  generateCloudflareTurnCredentials,
  normalizeIceServers,
  getCloudflareServerConfig,
} from "@/lib/webrtc/server/cloudflareTurn";
import { GET as getIceServersRoute, POST as postIceServersRoute } from "@/app/api/webrtc/ice-servers/route";
import {
  getIceConfiguration,
  fetchServerIceConfiguration,
  clearIceConfigCache,
  buildIceReport,
  DEFAULT_STUN_SERVERS,
} from "@/lib/webrtc/iceConfig";
import { NextRequest } from "next/server";
import * as serverAuthModule from "@/lib/firebase/server/auth";

vi.mock("@/lib/firebase/server/admin", () => {
  const mockVerifyToken = vi.fn(async (token: string) => {
    if (token === "valid_attested_appcheck_token") {
      const proj =
        process.env.FIREBASE_PROJECT_ID ||
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
        "rational-drake-mlcf1";
      return {
        appId: "togetherplay-web-app",
        token: {
          aud: [`projects/${proj}`, proj],
          sub: "togetherplay-web-app",
          app_id: "togetherplay-web-app",
        },
      };
    }
    const err = new Error("Invalid token");
    (err as any).code = "app-check/invalid-argument";
    throw err;
  });

  return {
    getAdminAppCheck: vi.fn(() => ({
      verifyToken: mockVerifyToken,
    })),
    getAdminAuth: vi.fn(() => ({
      verifyIdToken: vi.fn(),
    })),
    getAdminFirestore: vi.fn(() => ({})),
    getAdminDatabase: vi.fn(() => ({})),
    getAdminStorage: vi.fn(() => ({})),
    getAdminApp: vi.fn(() => ({})),
  };
});

describe("Cloudflare WebRTC Temporary TURN Credential Flow", () => {
  const originalEnv = { ...process.env };

  const MOCK_ACCOUNT_ID = "cf_acc_1234567890abcdef";
  const MOCK_KEY_ID = "cf_turn_key_9876543210fedcba";
  const MOCK_API_TOKEN = "cf_secret_token_live_xyz123";

  beforeEach(() => {
    clearIceConfigCache();
    vi.restoreAllMocks();
    delete process.env.ENFORCE_APP_CHECK;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_TURN_KEY_ID;
    delete process.env.CLOUDFLARE_TURN_API_TOKEN;
    delete process.env.NEXT_PUBLIC_WEBRTC_TURN_URL;
    delete process.env.NEXT_PUBLIC_WEBRTC_TURN_USERNAME;
    delete process.env.NEXT_PUBLIC_WEBRTC_TURN_CREDENTIAL;
    delete process.env.NEXT_PUBLIC_WEBRTC_TURN_SERVERS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    clearIceConfigCache();
    vi.restoreAllMocks();
  });

  describe("1. Server Environment & Configuration Guard", () => {
    it("reports not configured when environment variables are missing", () => {
      expect(isCloudflareTurnConfigured()).toBe(false);
      const config = getCloudflareServerConfig();
      expect(config.turnKeyId).toBeUndefined();
      expect(config.turnApiToken).toBeUndefined();
    });

    it("reports configured when key ID and API token are provided", () => {
      process.env.CLOUDFLARE_ACCOUNT_ID = MOCK_ACCOUNT_ID;
      process.env.CLOUDFLARE_TURN_KEY_ID = MOCK_KEY_ID;
      process.env.CLOUDFLARE_TURN_API_TOKEN = MOCK_API_TOKEN;

      expect(isCloudflareTurnConfigured()).toBe(true);
      const config = getCloudflareServerConfig();
      expect(config.accountId).toBe(MOCK_ACCOUNT_ID);
      expect(config.turnKeyId).toBe(MOCK_KEY_ID);
      expect(config.turnApiToken).toBe(MOCK_API_TOKEN);
    });

    it("normalizes diverse iceServers formats safely", () => {
      const normalized = normalizeIceServers([
        { urls: "stun:stun.cloudflare.com:3478" },
        {
          urls: ["turn:turn.cloudflare.com:3478?transport=udp", "turns:turn.cloudflare.com:5349?transport=tcp"],
          username: "temp_user_abc",
          credential: "temp_password_xyz",
        },
        null,
        {},
      ]);

      expect(normalized.length).toBe(2);
      expect(normalized[0].urls).toBe("stun:stun.cloudflare.com:3478");
      expect(normalized[1].username).toBe("temp_user_abc");
      expect(normalized[1].credential).toBe("temp_password_xyz");
    });
  });

  describe("2. Server-Generated Cloudflare TURN Credentials API Client", () => {
    it("returns error when credentials are not configured", async () => {
      const result = await generateCloudflareTurnCredentials();
      expect(result.success).toBe(false);
      expect(result.iceServers).toEqual([]);
      expect(result.error).toContain("not configured");
    });

    it("successfully calls Cloudflare Calls API and parses temporary credentials", async () => {
      process.env.CLOUDFLARE_ACCOUNT_ID = MOCK_ACCOUNT_ID;
      process.env.CLOUDFLARE_TURN_KEY_ID = MOCK_KEY_ID;
      process.env.CLOUDFLARE_TURN_API_TOKEN = MOCK_API_TOKEN;

      const mockCloudflareResponse = {
        iceServers: [
          { urls: "stun:stun.cloudflare.com:3478" },
          {
            urls: [
              "turn:turn.cloudflare.com:3478?transport=udp",
              "turn:turn.cloudflare.com:3478?transport=tcp",
              "turns:turn.cloudflare.com:5349?transport=tcp",
            ],
            username: "cf_temp_user_998877",
            credential: "cf_temp_cred_abcdef123456",
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockCloudflareResponse,
      } as Response);

      const result = await generateCloudflareTurnCredentials({ ttl: 86400 });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOptions] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`https://rtc.live.cloudflare.com/v1/turn/keys/${MOCK_KEY_ID}/credentials/generate-ice-servers`);
      expect((calledOptions?.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${MOCK_API_TOKEN}`);
      expect(JSON.parse(calledOptions?.body as string)).toEqual({ ttl: 86400 });

      expect(result.success).toBe(true);
      expect(result.hasTurnFallback).toBe(true);
      expect(result.turnServerCount).toBe(1);
      expect(result.stunServerCount).toBe(1);
      expect(result.iceServers.length).toBe(2);

      const turnServer = result.iceServers.find((s) =>
        Array.isArray(s.urls) && s.urls.some((u) => u.startsWith("turn:"))
      );
      expect(turnServer).toBeDefined();
      expect(turnServer?.username).toBe("cf_temp_user_998877");
      expect(turnServer?.credential).toBe("cf_temp_cred_abcdef123456");

      // Verify no server secrets are included
      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain(MOCK_API_TOKEN);
    });

    it("falls back to account endpoint when primary endpoint returns 404", async () => {
      process.env.CLOUDFLARE_ACCOUNT_ID = MOCK_ACCOUNT_ID;
      process.env.CLOUDFLARE_TURN_KEY_ID = MOCK_KEY_ID;
      process.env.CLOUDFLARE_TURN_API_TOKEN = MOCK_API_TOKEN;

      const fetchSpy = vi.spyOn(globalThis, "fetch")
        // First call to primary endpoint returns 404
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
          text: async () => "Not Found",
        } as Response)
        // Second call to secondary account endpoint succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            iceServers: [
              {
                urls: ["turn:turn.cloudflare.com:3478?transport=udp"],
                username: "cf_fallback_user",
                credential: "cf_fallback_pass",
              },
            ],
          }),
        } as Response);

      const result = await generateCloudflareTurnCredentials({ ttl: 86400 });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const [secondUrl] = fetchSpy.mock.calls[1];
      expect(secondUrl).toBe(
        `https://api.cloudflare.com/client/v4/accounts/${MOCK_ACCOUNT_ID}/calls/turn/keys/${MOCK_KEY_ID}/credentials/generate-ice-servers`
      );
      expect(result.success).toBe(true);
      expect(result.turnServerCount).toBe(1);
    });

    it("handles Cloudflare API rate limit / 500 error gracefully", async () => {
      process.env.CLOUDFLARE_TURN_KEY_ID = MOCK_KEY_ID;
      process.env.CLOUDFLARE_TURN_API_TOKEN = MOCK_API_TOKEN;

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => "Rate limit exceeded",
      } as Response);

      const result = await generateCloudflareTurnCredentials();
      expect(result.success).toBe(false);
      expect(result.hasTurnFallback).toBe(false);
      expect(result.error).toContain("429");
    });
  });

  describe("3. Authenticated /api/webrtc/ice-servers Route", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/webrtc/ice-servers");
      const response = await getIceServersRoute(req);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe("UNAUTHENTICATED");
    });

    it("returns STUN-only fallback when authenticated but Cloudflare is unconfigured", async () => {
      // Mock authenticated session
      vi.spyOn(serverAuthModule, "requireServerAuth").mockResolvedValueOnce({
        user: {
          uid: "player_test_uid_777",
          email: "player@test.com",
          token: { uid: "player_test_uid_777" } as any,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/webrtc/ice-servers", {
        headers: { Authorization: "Bearer valid_mock_token" },
      });

      const response = await getIceServersRoute(req);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.provider).toBe("default_stun");
      expect(data.hasTurnFallback).toBe(false);
      expect(data.isProductionReliable).toBe(false);
      expect(data.reliabilityLevel).toBe("development_stun_only");
      expect(data.iceServers.length).toBeGreaterThanOrEqual(3);
    });

    it("returns Cloudflare temporary credentials to authorized players", async () => {
      process.env.CLOUDFLARE_TURN_KEY_ID = MOCK_KEY_ID;
      process.env.CLOUDFLARE_TURN_API_TOKEN = MOCK_API_TOKEN;

      vi.spyOn(serverAuthModule, "requireServerAuth").mockResolvedValueOnce({
        user: {
          uid: "player_test_uid_777",
          email: "player@test.com",
          token: { uid: "player_test_uid_777" } as any,
        },
      });

      // Mock Cloudflare response
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          iceServers: [
            { urls: "stun:stun.cloudflare.com:3478" },
            {
              urls: ["turn:turn.cloudflare.com:3478?transport=udp"],
              username: "short_lived_user_123",
              credential: "short_lived_pass_456",
            },
          ],
        }),
      } as Response);

      const req = new NextRequest("http://localhost:3000/api/webrtc/ice-servers", {
        headers: { Authorization: "Bearer valid_mock_token" },
      });

      const response = await postIceServersRoute(req);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.provider).toBe("cloudflare");
      expect(data.hasTurnFallback).toBe(true);
      expect(data.isProductionReliable).toBe(true);
      expect(data.reliabilityLevel).toBe("production_turn_relay");
      expect(data.ttl).toBe(86400);

      const turnItem = data.iceServers.find((s: RTCIceServer) => {
        const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
        return urls.some((u) => typeof u === "string" && u.startsWith("turn:"));
      });
      expect(turnItem).toBeDefined();
      expect(turnItem.username).toBe("short_lived_user_123");
      expect(turnItem.credential).toBe("short_lived_pass_456");

      // Verify no server secrets are exposed in response
      const jsonStr = JSON.stringify(data);
      expect(jsonStr).not.toContain(MOCK_API_TOKEN);
      expect(jsonStr).not.toContain(MOCK_KEY_ID);
    });

    it("rejects request when App Check is enforced and token is missing", async () => {
      process.env.ENFORCE_APP_CHECK = "true";

      const req = new NextRequest("http://localhost:3000/api/webrtc/ice-servers", {
        headers: { Authorization: "Bearer valid_mock_token" },
      });

      const response = await getIceServersRoute(req);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error?.category).toBe("APP_CHECK_ATTESTATION");
      expect(data.error?.code).toBe("MISSING_APP_CHECK");
    });

    it("rejects request when App Check is enforced and token is invalid", async () => {
      process.env.ENFORCE_APP_CHECK = "true";

      const req = new NextRequest("http://localhost:3000/api/webrtc/ice-servers", {
        headers: {
          Authorization: "Bearer valid_mock_token",
          "x-firebase-appcheck": "invalid_signature_appcheck_token",
        },
      });

      const response = await getIceServersRoute(req);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error?.category).toBe("APP_CHECK_ATTESTATION");
      expect(["MALFORMED_APP_CHECK", "INVALID_APP_CHECK_SIGNATURE", "APP_CHECK_FAILED"]).toContain(
        data.error?.code
      );
    });

    it("allows request with valid App Check token and valid auth to reach TURN credential generation", async () => {
      process.env.ENFORCE_APP_CHECK = "true";
      process.env.CLOUDFLARE_TURN_KEY_ID = MOCK_KEY_ID;
      process.env.CLOUDFLARE_TURN_API_TOKEN = MOCK_API_TOKEN;

      vi.spyOn(serverAuthModule, "requireServerAuth").mockResolvedValueOnce({
        user: {
          uid: "player_appcheck_uid_888",
          email: "player@togetherplay.test",
          token: { uid: "player_appcheck_uid_888" } as any,
        },
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          iceServers: [
            { urls: "stun:stun.cloudflare.com:3478" },
            {
              urls: ["turn:turn.cloudflare.com:3478?transport=udp"],
              username: "appcheck_authenticated_turn_user",
              credential: "appcheck_authenticated_turn_pass",
            },
          ],
        }),
      } as Response);

      const req = new NextRequest("http://localhost:3000/api/webrtc/ice-servers", {
        headers: {
          Authorization: "Bearer valid_mock_token",
          "x-firebase-appcheck": "valid_attested_appcheck_token",
        },
      });

      const response = await postIceServersRoute(req);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.provider).toBe("cloudflare");
      expect(data.hasTurnFallback).toBe(true);
      expect(data.isProductionReliable).toBe(true);
    });

    it("gracefully falls back to STUN when Cloudflare API fails despite valid App Check and Auth", async () => {
      process.env.ENFORCE_APP_CHECK = "true";
      process.env.CLOUDFLARE_TURN_KEY_ID = MOCK_KEY_ID;
      process.env.CLOUDFLARE_TURN_API_TOKEN = MOCK_API_TOKEN;

      vi.spyOn(serverAuthModule, "requireServerAuth").mockResolvedValueOnce({
        user: {
          uid: "player_appcheck_uid_888",
          email: "player@togetherplay.test",
          token: { uid: "player_appcheck_uid_888" } as any,
        },
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({ errors: [{ message: "Bad Gateway" }] }),
        text: async () => JSON.stringify({ errors: [{ message: "Bad Gateway" }] }),
      } as unknown as Response);

      const req = new NextRequest("http://localhost:3000/api/webrtc/ice-servers", {
        headers: {
          Authorization: "Bearer valid_mock_token",
          "x-firebase-appcheck": "valid_attested_appcheck_token",
        },
      });

      const response = await getIceServersRoute(req);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.provider).toBe("default_stun");
      expect(data.hasTurnFallback).toBe(false);
      expect(data.iceServers.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("4. Client Traversal Helper & Caching Lifecycle", () => {
    it("returns baseline STUN configuration synchronously", () => {
      const report = getIceConfiguration();
      expect(report.stunServerCount).toBeGreaterThanOrEqual(3);
      expect(report.turnServerCount).toBe(0);
      expect(report.hasTurnFallback).toBe(false);
      expect(report.isProductionReliable).toBe(false);
      expect(report.reliabilityLevel).toBe("development_stun_only");
    });

    it("builds report with accurate reliability calculation", () => {
      const stunReport = buildIceReport(DEFAULT_STUN_SERVERS);
      expect(stunReport.hasTurnFallback).toBe(false);
      expect(stunReport.isProductionReliable).toBe(false);

      const turnReport = buildIceReport([
        ...DEFAULT_STUN_SERVERS,
        {
          urls: "turn:turn.cloudflare.com:3478",
          username: "user",
          credential: "password",
        },
      ]);
      expect(turnReport.hasTurnFallback).toBe(true);
      expect(turnReport.isProductionReliable).toBe(true);
      expect(turnReport.reliabilityLevel).toBe("production_turn_relay");
    });

    it("fetches server ice configuration and caches in memory across calls", async () => {
      const mockApiResponse = {
        success: true,
        provider: "cloudflare",
        iceServers: [
          { urls: "stun:stun.cloudflare.com:3478" },
          {
            urls: ["turn:turn.cloudflare.com:3478"],
            username: "cached_user",
            credential: "cached_password",
          },
        ],
        hasTurnFallback: true,
        ttl: 7200,
        diagnostics: "Cloudflare active",
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      // Call 1
      const report1 = await fetchServerIceConfiguration({ idToken: "test_token_123" });
      expect(report1.hasTurnFallback).toBe(true);
      expect(report1.isProductionReliable).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Call 2 within TTL should hit cache
      const report2 = await fetchServerIceConfiguration({ idToken: "test_token_123" });
      expect(report2.hasTurnFallback).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1); // Not called again

      // Call 3 with forceRefresh should bypass cache
      await fetchServerIceConfiguration({ idToken: "test_token_123", forceRefresh: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});

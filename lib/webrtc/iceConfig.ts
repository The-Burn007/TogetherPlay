/**
 * TogetherPlay WebRTC ICE / STUN / TURN Configuration
 * 
 * Provides robust NAT traversal configuration.
 * 
 * Architecture:
 * - Direct peer-to-peer WebRTC connection using STUN for NAT discovery.
 * - Server-generated temporary TURN credentials via Cloudflare Calls for relay fallback
 *   when symmetric NAT, cellular carriers, or firewalls prevent direct P2P.
 * - Credentials are short-lived and fetched via the authenticated /api/webrtc/ice-servers endpoint.
 * - Never exposes long-term Cloudflare keys or API tokens to client browsers.
 */

import { getClientAuth } from "@/lib/firebase/client";

export interface IceConfigurationReport {
  iceServers: RTCIceServer[];
  hasTurnFallback: boolean;
  stunServerCount: number;
  turnServerCount: number;
  reliabilityLevel: "development_stun_only" | "production_turn_relay";
  diagnostics: string;
  isProductionReliable: boolean;
  provider?: string;
  ttl?: number;
}

export const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

/**
 * Builds an IceConfigurationReport from an array of RTCIceServer objects.
 */
export function buildIceReport(
  iceServers: RTCIceServer[],
  customDiagnostics?: string,
  provider?: string,
  ttl?: number
): IceConfigurationReport {
  let turnServerCount = 0;

  for (const server of iceServers) {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    if (urls.some((u) => u.startsWith("turn:") || u.startsWith("turns:"))) {
      turnServerCount++;
    }
  }

  const stunServerCount = iceServers.length - turnServerCount;
  const hasTurnFallback = turnServerCount > 0;

  let diagnostics = customDiagnostics;
  if (!diagnostics) {
    diagnostics = hasTurnFallback
      ? `Production WebRTC configuration active: ${stunServerCount} STUN server(s), ${turnServerCount} TURN relay server(s).`
      : `Development STUN-only NAT discovery active (${stunServerCount} STUN servers). Direct P2P mode without TURN relay fallback; connections traversing symmetric NAT or restrictive mobile networks may require TURN.`;
  }

  return {
    iceServers,
    hasTurnFallback,
    stunServerCount,
    turnServerCount,
    reliabilityLevel: hasTurnFallback ? "production_turn_relay" : "development_stun_only",
    diagnostics,
    isProductionReliable: hasTurnFallback,
    provider,
    ttl,
  };
}

/**
 * Parses and returns the baseline synchronous WebRTC ICE servers.
 * Used for initial render and local-development fallback.
 */
export function getIceConfiguration(initialServers?: RTCIceServer[]): IceConfigurationReport {
  if (initialServers && initialServers.length > 0) {
    return buildIceReport(initialServers);
  }

  const iceServers: RTCIceServer[] = [...DEFAULT_STUN_SERVERS];

  // Optional local-development fallback if explicitly set in environment
  const localTurnUrl =
    process.env.LOCAL_DEV_TURN_URL ||
    process.env.NEXT_PUBLIC_WEBRTC_TURN_URL;
  const localTurnUsername =
    process.env.LOCAL_DEV_TURN_USERNAME ||
    process.env.NEXT_PUBLIC_WEBRTC_TURN_USERNAME;
  const localTurnCredential =
    process.env.LOCAL_DEV_TURN_CREDENTIAL ||
    process.env.NEXT_PUBLIC_WEBRTC_TURN_CREDENTIAL;

  if (localTurnUrl && localTurnUrl.trim()) {
    const server: RTCIceServer = { urls: localTurnUrl.trim() };
    if (localTurnUsername) server.username = localTurnUsername.trim();
    if (localTurnCredential) server.credential = localTurnCredential.trim();
    iceServers.push(server);
  }

  const rawLocalServers =
    process.env.LOCAL_DEV_TURN_SERVERS ||
    process.env.NEXT_PUBLIC_WEBRTC_TURN_SERVERS;
  if (rawLocalServers && rawLocalServers.trim()) {
    try {
      const parsed = JSON.parse(rawLocalServers.trim());
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && item.urls) {
            iceServers.push(item as RTCIceServer);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return buildIceReport(iceServers);
}

// In-memory cache for short-lived credentials
interface CachedIceConfig {
  report: IceConfigurationReport;
  expiresAt: number;
}

let cachedConfig: CachedIceConfig | null = null;

export function clearIceConfigCache(): void {
  cachedConfig = null;
}

/**
 * Fetches short-lived temporary TURN / ICE credentials from the authenticated server endpoint.
 * Transparently caches credentials in memory based on their TTL.
 */
export async function fetchServerIceConfiguration(options?: {
  idToken?: string;
  appCheckToken?: string;
  forceRefresh?: boolean;
}): Promise<IceConfigurationReport> {
  const now = Date.now();

  if (!options?.forceRefresh && cachedConfig && cachedConfig.expiresAt > now) {
    return cachedConfig.report;
  }

  let token = options?.idToken;

  // If token was not provided explicitly, try getting it from client Firebase Auth
  if (!token && typeof window !== "undefined") {
    try {
      const currentAuth = getClientAuth();
      if (currentAuth?.currentUser) {
        token = await currentAuth.currentUser.getIdToken();
      }
    } catch {
      // ignore
    }
  }

  if (!token) {
    // Unauthenticated or SSR: return baseline configuration
    return getIceConfiguration();
  }

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (options?.appCheckToken) {
      headers["X-Firebase-AppCheck"] = options.appCheckToken;
    }

    const response = await fetch("/api/webrtc/ice-servers", {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      console.warn(`[WebRTC] Failed to fetch ICE servers from server [status ${response.status}]. Using default fallback.`);
      return getIceConfiguration();
    }

    const data = await response.json();
    if (data && data.success && Array.isArray(data.iceServers)) {
      const report = buildIceReport(
        data.iceServers,
        data.diagnostics,
        data.provider,
        data.ttl
      );

      // Cache credentials for 80% of TTL or up to 12 hours
      const ttlSeconds = typeof data.ttl === "number" && data.ttl > 0 ? data.ttl : 3600;
      const cacheDurationMs = Math.min(ttlSeconds * 0.8 * 1000, 12 * 3600 * 1000);
      cachedConfig = {
        report,
        expiresAt: now + cacheDurationMs,
      };

      return report;
    }
  } catch (err) {
    console.warn("[WebRTC] Network error fetching server ICE configuration:", err);
  }

  return getIceConfiguration();
}

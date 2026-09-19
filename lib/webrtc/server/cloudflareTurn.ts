/**
 * Server-Side Cloudflare Calls TURN Integration
 * 
 * ARCHITECTURE PRINCIPLE:
 * This module is STRICTLY server-only. It must NEVER be bundled or sent to the client browser.
 * Cloudflare API tokens and TURN key IDs are server secrets and must never be exposed via NEXT_PUBLIC_*.
 * 
 * Cloudflare Calls TURN uses a long-term TURN Key to generate short-lived, temporary TURN credentials
 * (username, credential, and URLs) on demand for authorized WebRTC peers.
 */

if (typeof window !== "undefined") {
  throw new Error("Security Violation: Cloudflare TURN server module cannot be loaded in client browser bundle.");
}

export interface CloudflareTurnCredentialsResponse {
  iceServers?: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
  result?: {
    iceServers?: Array<{
      urls: string | string[];
      username?: string;
      credential?: string;
    }>;
  };
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
}

export interface CloudflareTurnResult {
  success: boolean;
  iceServers: RTCIceServer[];
  hasTurnFallback: boolean;
  stunServerCount: number;
  turnServerCount: number;
  ttl: number;
  error?: string;
}

export interface CloudflareServerEnvConfig {
  accountId?: string;
  turnKeyId?: string;
  turnApiToken?: string;
}

/**
 * Reads Cloudflare TURN credentials configuration from server environment.
 */
export function getCloudflareServerConfig(): CloudflareServerEnvConfig {
  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || undefined,
    turnKeyId: process.env.CLOUDFLARE_TURN_KEY_ID?.trim() || undefined,
    turnApiToken: process.env.CLOUDFLARE_TURN_API_TOKEN?.trim() || undefined,
  };
}

/**
 * Checks whether Cloudflare TURN key and API token are configured on the server.
 */
export function isCloudflareTurnConfigured(): boolean {
  const { turnKeyId, turnApiToken } = getCloudflareServerConfig();
  return Boolean(turnKeyId && turnApiToken);
}

/**
 * Normalizes raw iceServers into standard RTCIceServer objects.
 */
export function normalizeIceServers(rawServers: unknown): RTCIceServer[] {
  if (!rawServers) return [];
  const list = Array.isArray(rawServers) ? rawServers : [rawServers];
  const normalized: RTCIceServer[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const serverObj = item as Record<string, unknown>;
    const urls = serverObj.urls;

    if (!urls) continue;

    const validatedUrls: string[] = [];
    if (typeof urls === "string" && urls.trim()) {
      validatedUrls.push(urls.trim());
    } else if (Array.isArray(urls)) {
      for (const u of urls) {
        if (typeof u === "string" && u.trim()) {
          validatedUrls.push(u.trim());
        }
      }
    }

    if (validatedUrls.length === 0) continue;

    const server: RTCIceServer = {
      urls: validatedUrls.length === 1 ? validatedUrls[0] : validatedUrls,
    };

    if (typeof serverObj.username === "string" && serverObj.username.trim()) {
      server.username = serverObj.username.trim();
    }
    if (typeof serverObj.credential === "string" && serverObj.credential.trim()) {
      server.credential = serverObj.credential.trim();
    }

    normalized.push(server);
  }

  return normalized;
}

/**
 * Generates short-lived WebRTC ICE / TURN credentials using Cloudflare's TURN API.
 * 
 * @param options.ttl Time to live in seconds (default: 86400 = 24 hours)
 */
export async function generateCloudflareTurnCredentials(options?: {
  ttl?: number;
}): Promise<CloudflareTurnResult> {
  const { accountId, turnKeyId, turnApiToken } = getCloudflareServerConfig();
  const ttl = options?.ttl && options.ttl > 0 ? options.ttl : 86400;

  if (!turnKeyId || !turnApiToken) {
    return {
      success: false,
      iceServers: [],
      hasTurnFallback: false,
      stunServerCount: 0,
      turnServerCount: 0,
      ttl,
      error: "Cloudflare TURN key ID or API token is not configured on the server.",
    };
  }

  // Primary Cloudflare Calls endpoint for short-lived TURN credentials
  const primaryUrl = `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(
    turnKeyId
  )}/credentials/generate-ice-servers`;

  // Secondary endpoint when account ID is specified
  const secondaryUrl = accountId
    ? `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
        accountId
      )}/calls/turn/keys/${encodeURIComponent(turnKeyId)}/credentials/generate-ice-servers`
    : null;

  const requestEndpoints = secondaryUrl ? [primaryUrl, secondaryUrl] : [primaryUrl];
  let lastError: string | null = null;

  for (const endpoint of requestEndpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${turnApiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        lastError = `Cloudflare TURN API error [status ${response.status}]: ${errorText || response.statusText}`;
        // If 404 on primary and secondary exists, attempt secondary endpoint
        if (response.status === 404 && endpoint === primaryUrl && secondaryUrl) {
          continue;
        }
        break;
      }

      const data = (await response.json()) as CloudflareTurnCredentialsResponse;
      const rawServers = data.iceServers || data.result?.iceServers;
      const normalized = normalizeIceServers(rawServers);

      let turnCount = 0;
      for (const server of normalized) {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        if (urls.some((u) => u.startsWith("turn:") || u.startsWith("turns:"))) {
          turnCount++;
        }
      }

      const stunCount = normalized.length - turnCount;

      return {
        success: true,
        iceServers: normalized,
        hasTurnFallback: turnCount > 0,
        stunServerCount: stunCount,
        turnServerCount: turnCount,
        ttl,
      };
    } catch (err: unknown) {
      const errorObj = err as Error;
      lastError = errorObj?.message || "Network timeout or error connecting to Cloudflare TURN API";
    }
  }

  return {
    success: false,
    iceServers: [],
    hasTurnFallback: false,
    stunServerCount: 0,
    turnServerCount: 0,
    ttl,
    error: lastError || "Failed to generate Cloudflare TURN credentials.",
  };
}

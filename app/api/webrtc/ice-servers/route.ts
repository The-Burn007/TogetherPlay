import { NextRequest, NextResponse } from "next/server";
import { requireServerAuth } from "@/lib/firebase/server/auth";
import { checkApiRateLimit } from "@/lib/firebase/server/security";
import {
  generateCloudflareTurnCredentials,
  isCloudflareTurnConfigured,
} from "@/lib/webrtc/server/cloudflareTurn";
import { DEFAULT_STUN_SERVERS, buildIceReport } from "@/lib/webrtc/iceConfig";

export const dynamic = "force-dynamic";

/**
 * Handles WebRTC ICE Server provisioning for authenticated players.
 * Generates short-lived TURN credentials from Cloudflare without exposing secrets to the browser.
 */
async function handleIceServersRequest(req: NextRequest) {
  // 1. Authenticate user identity strictly via Firebase ID token
  const authResult = await requireServerAuth(req);
  if ("errorResponse" in authResult) {
    return authResult.errorResponse;
  }

  // 2. Rate limit ICE credential generation to prevent upstream Cloudflare API exhaustion
  const rateLimit = checkApiRateLimit(`webrtc_ice_${authResult.user.uid}`, 30, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many ICE configuration requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.resetInSeconds) } }
    );
  }

  // 3. Check if Cloudflare Calls TURN credentials service is configured
  if (isCloudflareTurnConfigured()) {
    const cloudflareResult = await generateCloudflareTurnCredentials({ ttl: 86400 });

    if (cloudflareResult.success && cloudflareResult.iceServers.length > 0) {
      // Merge Cloudflare ICE servers with our baseline STUN servers (ensuring fast resolution + relay fallback)
      const mergedServers: RTCIceServer[] = [];
      const seenUrls = new Set<string>();

      // First add Cloudflare temporary TURN & STUN servers
      for (const server of cloudflareResult.iceServers) {
        mergedServers.push(server);
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        urls.forEach((u) => seenUrls.add(u));
      }

      // Add default STUN servers if not already included
      for (const defaultStun of DEFAULT_STUN_SERVERS) {
        const urls = Array.isArray(defaultStun.urls) ? defaultStun.urls : [defaultStun.urls];
        if (!urls.some((u) => seenUrls.has(u))) {
          mergedServers.push(defaultStun);
        }
      }

      const report = buildIceReport(
        mergedServers,
        `Active Cloudflare temporary TURN relay provisioned for authenticated user ${authResult.user.uid}. Session credentials valid for 24 hours.`
      );

      return NextResponse.json({
        success: true,
        provider: "cloudflare",
        iceServers: report.iceServers,
        hasTurnFallback: report.hasTurnFallback,
        stunServerCount: report.stunServerCount,
        turnServerCount: report.turnServerCount,
        reliabilityLevel: report.reliabilityLevel,
        isProductionReliable: report.isProductionReliable,
        diagnostics: report.diagnostics,
        ttl: cloudflareResult.ttl,
      });
    }

    // If Cloudflare call returned an error, log diagnostic on server without crashing client
    console.warn("[WebRTC] Cloudflare TURN generation warning:", cloudflareResult.error);
  }

  // 3. Fallback: Development STUN-only mode
  const fallbackReport = buildIceReport(
    [...DEFAULT_STUN_SERVERS],
    "Development STUN-only active. Configure CLOUDFLARE_TURN_KEY_ID and CLOUDFLARE_TURN_API_TOKEN on server for production TURN relay."
  );

  return NextResponse.json({
    success: true,
    provider: "default_stun",
    iceServers: fallbackReport.iceServers,
    hasTurnFallback: false,
    stunServerCount: fallbackReport.stunServerCount,
    turnServerCount: 0,
    reliabilityLevel: fallbackReport.reliabilityLevel,
    isProductionReliable: false,
    diagnostics: fallbackReport.diagnostics,
  });
}

export async function GET(req: NextRequest) {
  return handleIceServersRequest(req);
}

export async function POST(req: NextRequest) {
  return handleIceServersRequest(req);
}

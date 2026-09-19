import type {
  GameNightLineup,
  GameNightVibe,
} from "./gameNightTypes";
import { getCuratedGameNight } from "./curatedGameNights";
import { auth } from "@/lib/firebase/client";

export interface FetchGameNightParams {
  partnerNames?: { p1: string; p2: string };
  partnerCities?: { p1: string; p2: string };
  vibe?: GameNightVibe;
  themeHint?: string;
  authToken?: string;
}

export interface GameNightFetchResult {
  lineup: GameNightLineup;
  isFallback: boolean;
  fallbackReason?: string;
}

export async function fetchGameNightLineup(
  params: FetchGameNightParams = {}
): Promise<GameNightFetchResult> {
  const {
    partnerNames = { p1: "Alex", p2: "Sam" },
    partnerCities = { p1: "London", p2: "Tokyo" },
    vibe = "balanced",
    themeHint,
    authToken,
  } = params;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Client-side authentication token
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    } else {
      const token = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9500);

    const res = await fetch("/api/ai/game-night", {
      method: "POST",
      headers,
      body: JSON.stringify({
        partnerNames,
        partnerCities,
        vibe,
        themeHint,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.warn("Server responded with error status:", res.status);
      return {
        lineup: getCuratedGameNight(vibe, partnerNames, partnerCities),
        isFallback: true,
        fallbackReason: `Server error (${res.status})`,
      };
    }

    const data = await res.json();
    if (data && data.lineup) {
      return {
        lineup: data.lineup,
        isFallback: Boolean(data.isFallback),
        fallbackReason: data.fallbackReason,
      };
    }

    return {
      lineup: getCuratedGameNight(vibe, partnerNames, partnerCities),
      isFallback: true,
      fallbackReason: "Missing lineup in response",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn("Client Game Night fetch exception, activating curated fallback:", errorMsg);
    return {
      lineup: getCuratedGameNight(vibe, partnerNames, partnerCities),
      isFallback: true,
      fallbackReason: errorMsg,
    };
  }
}

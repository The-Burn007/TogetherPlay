import type {
  AIChallenge,
  AIChallengeRequest,
  AIChallengeResponse,
} from "@/types/domain";
import { getCuratedChallenge } from "./curatedChallenges";
import { getClientAuth } from "@/lib/firebase/client";

/**
 * Client-Side AI Challenge Service
 *
 * Calls the authenticated server endpoint (/api/ai/challenge).
 * NEVER touches or exposes Gemini API keys directly in client code.
 * Implements client-side timeout and instant fallback to curated challenges.
 */
export async function fetchAIChallenge(
  request: AIChallengeRequest,
  token?: string
): Promise<AIChallengeResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    // Resolve authentication token
    let authToken = token;
    if (!authToken) {
      const auth = getClientAuth();
      if (auth.currentUser) {
        authToken = await auth.currentUser.getIdToken().catch(() => undefined);
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch("/api/ai/challenge", {
      method: "POST",
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        challenge: errorData.challenge || getCuratedChallenge(request.category, request.difficulty),
        isFallback: true,
        fallbackReason: errorData.message || `Server error (${response.status})`,
        rateLimit: errorData.rateLimit,
      };
    }

    const data = (await response.json()) as AIChallengeResponse;
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err instanceof DOMException && err.name === "AbortError";
    const reason = isTimeout
      ? "AI request timed out after 9 seconds"
      : "Network connection unavailable";

    return {
      success: false,
      challenge: getCuratedChallenge(request.category, request.difficulty),
      isFallback: true,
      fallbackReason: reason,
    };
  }
}

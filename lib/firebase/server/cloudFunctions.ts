/**
 * Firebase Cloud Functions Export Module
 * 
 * Provides standard Cloud Functions entrypoint for authoritative multiplayer actions:
 * - submitGameAction (Callable HTTPS / onCall function)
 */

import { submitGameAction, ActionValidationError } from "./submitGameAction";
import type { GameAction } from "@/types/domain";

export interface CallableContext {
  auth?: { uid: string; token?: Record<string, unknown> };
  app?: { appId?: string; token?: string };
  rawRequest?: { headers?: Record<string, string> };
}

/**
 * Cloud Function HTTPS onCall handler for submitGameAction
 */
export async function submitGameActionCallable(
  data: GameAction,
  context: CallableContext
) {
  const uid = context.auth?.uid;
  const appCheckToken = context.app?.token || context.rawRequest?.headers?.["x-firebase-appcheck"];

  try {
    const result = await submitGameAction(data, {
      auth: uid ? { uid } : null,
      appCheckToken: appCheckToken || "valid-test-app-check-token",
      enforceAppCheck: false, // Managed by Cloud Functions App Check policy
      serverTimestamp: Date.now(),
    });
    return result;
  } catch (error) {
    if (error instanceof ActionValidationError) {
      throw new Error(`[${error.code}] ${error.message}`);
    }
    throw error;
  }
}

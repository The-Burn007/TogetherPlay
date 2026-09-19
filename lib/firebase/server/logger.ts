/**
 * Server-Side Structured Logger for Authoritative Game Operations
 * 
 * Invariants:
 * 1. Request ID, Game ID, Action ID, and Error Category are always captured.
 * 2. NO secrets (tokens, API keys, credentials, cookies, headers) are logged.
 * 3. NO unnecessary private user content (PII, emails, personal messages) is logged.
 */

export type ErrorCategory =
  | "PERSISTENCE_FAILURE"
  | "VALIDATION_FAILURE"
  | "AUTHORIZATION_FAILURE"
  | "RATE_LIMIT_EXCEEDED"
  | "CONCURRENCY_CONFLICT"
  | "INTERNAL_FAILURE";

export interface StructuredLogPayload {
  requestId: string;
  gameId: string;
  actionId: string;
  errorCategory: ErrorCategory;
  message: string;
  playerId?: string;
  operation?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
  error?: unknown;
}

const REDACTED_KEYS = new Set([
  "token",
  "authorization",
  "auth",
  "appcheck",
  "password",
  "secret",
  "key",
  "privatekey",
  "clientsecret",
  "cookie",
  "session",
  "credential",
  "email",
  "serviceaccount",
]);

export function sanitizeLogData(data: unknown, depth = 0): unknown {
  if (depth > 4) return "[Truncated]";
  if (data === null || data === undefined) return data;
  if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
    return data;
  }
  if (Array.isArray(data)) {
    return data.slice(0, 10).map((item) => sanitizeLogData(item, depth + 1));
  }
  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (Array.from(REDACTED_KEYS).some((rk) => lowerKey.includes(rk))) {
        sanitized[k] = "[REDACTED]";
      } else {
        sanitized[k] = sanitizeLogData(v, depth + 1);
      }
    }
    return sanitized;
  }
  return String(data);
}

export function logStructuredError(payload: StructuredLogPayload): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: "ERROR",
    requestId: payload.requestId || "unknown_req",
    gameId: payload.gameId || "unknown_game",
    actionId: payload.actionId || "none",
    errorCategory: payload.errorCategory,
    message: payload.message,
    ...(payload.playerId ? { playerId: payload.playerId } : {}),
    ...(payload.operation ? { operation: payload.operation } : {}),
    ...(payload.statusCode ? { statusCode: payload.statusCode } : {}),
    ...(payload.details ? { details: sanitizeLogData(payload.details) } : {}),
    ...(payload.error instanceof Error
      ? {
          errorName: payload.error.name,
          errorMessage: payload.error.message,
        }
      : payload.error
      ? { errorRaw: String(payload.error) }
      : {}),
  };

  console.error("[STRUCTURED_ERROR]", JSON.stringify(logEntry));
}

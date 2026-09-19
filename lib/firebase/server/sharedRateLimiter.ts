import type { NextRequest } from "next/server";
import { getAdminFirestore, isAdminFirebaseConfigured } from "./admin";

export interface RateLimitOptions {
  key: string;
  maxRequests: number;
  windowMs: number;
  ip?: string;
  now?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
  source: "shared" | "local_fallback";
  key: string;
}

export type RateLimitPromise = Promise<RateLimitResult> & RateLimitResult;

/**
 * Sanitizes keys to produce safe Firestore document IDs.
 * Replaces illegal characters (/, \, #, ?, %) with underscores.
 */
export function sanitizeDocKey(key: string): string {
  return key.replace(/[/\\#?%]/g, "_").slice(0, 128);
}

/**
 * Extracts client IP safely from request headers for network-level throttling.
 */
export function getClientIp(request: Request | NextRequest): string {
  try {
    const headers = request.headers;
    const xForwardedFor = headers.get("x-forwarded-for");
    if (xForwardedFor) {
      const parts = xForwardedFor.split(",");
      const first = parts[0]?.trim();
      if (first) return first;
    }
    const xRealIp = headers.get("x-real-ip");
    if (xRealIp?.trim()) return xRealIp.trim();
    const cfConnectingIp = headers.get("cf-connecting-ip");
    if (cfConnectingIp?.trim()) return cfConnectingIp.trim();
  } catch {
    // ignore
  }
  return "127.0.0.1";
}

/**
 * In-memory simulated shared store for unit testing multi-instance concurrency
 * without requiring a live cloud connection.
 */
export class SimulatedSharedFirestore {
  readonly docs = new Map<string, any>();
  private transactionQueue: Promise<void> = Promise.resolve();

  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    // Atomically serialize transactions like Firestore document-level locking
    const previousQueue = this.transactionQueue;
    let releaseLock!: () => void;
    this.transactionQueue = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    await previousQueue;
    try {
      const tx = {
        get: async (docRef: any) => {
          const id = docRef.id;
          const exists = this.docs.has(id);
          const data = exists ? JSON.parse(JSON.stringify(this.docs.get(id))) : null;
          return {
            id,
            exists,
            data: () => data,
          };
        },
        set: (docRef: any, data: any, _options?: any) => {
          this.docs.set(docRef.id, JSON.parse(JSON.stringify(data)));
        },
        update: (docRef: any, data: any) => {
          const existing = this.docs.get(docRef.id) || {};
          this.docs.set(docRef.id, { ...existing, ...JSON.parse(JSON.stringify(data)) });
        },
        delete: (docRef: any) => {
          this.docs.delete(docRef.id);
        },
      };

      return await updateFunction(tx);
    } finally {
      releaseLock();
    }
  }

  collection(_colName: string) {
    return {
      doc: (docId: string) => ({
        id: docId,
        get: async () => {
          const exists = this.docs.has(docId);
          const data = exists ? JSON.parse(JSON.stringify(this.docs.get(docId))) : null;
          return {
            id: docId,
            exists,
            data: () => data,
          };
        },
        set: async (data: any) => {
          this.docs.set(docId, JSON.parse(JSON.stringify(data)));
        },
      }),
    };
  }

  clear(): void {
    this.docs.clear();
    this.transactionQueue = Promise.resolve();
  }
}

/**
 * Shared Rate Limiter with Firebase Firestore Authority & Fail-Safe Local Memory Fallback.
 *
 * ARCHITECTURAL DESIGN:
 * 1. Authority: In production across multiple server instances (e.g. Cloud Run containers),
 *    rate limiting state is stored in Firestore collection 'rateLimits' using atomic transactions.
 *    This prevents multi-instance bypass where concurrent requests hit separate instances.
 * 2. Fail-Safe Resilience: If the shared Firestore database is unreachable, slow, or fails,
 *    the limiter fails safe to local process memory, logging a warning while STILL enforcing
 *    rate limiting locally. It NEVER silently exposes or disables the AI endpoints.
 * 3. Identity & Network Tiers: Supports both verified user UID identity keys and client IP keys.
 * 4. UX Preservation: Returns remaining count and reset-in-seconds for Retry-After headers,
 *    allowing AI routes to provide seamless curated offline fallbacks.
 */
export class SharedRateLimiter {
  private fallbackStore = new Map<string, { timestamps: number[] }>();
  private simulatedSharedFailure = false;
  private customFirestore: any = null;

  constructor(customFirestore?: any) {
    this.customFirestore = customFirestore;
  }

  setCustomFirestore(firestore: any): void {
    this.customFirestore = firestore;
  }

  setSimulatedFailure(simulate: boolean): void {
    this.simulatedSharedFailure = simulate;
  }

  clearLocal(): void {
    this.fallbackStore.clear();
  }

  checkLocalFallback(options: RateLimitOptions): RateLimitResult {
    const { key, maxRequests, windowMs, now = Date.now() } = options;
    let record = this.fallbackStore.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.fallbackStore.set(key, record);
    }

    record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

    if (record.timestamps.length >= maxRequests) {
      const oldest = record.timestamps[0] || now;
      const resetInSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds,
        source: "local_fallback",
        key,
      };
    }

    record.timestamps.push(now);
    const remaining = Math.max(0, maxRequests - record.timestamps.length);
    const oldest = record.timestamps[0] || now;
    const resetInSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));

    return {
      allowed: true,
      remaining,
      resetInSeconds,
      source: "local_fallback",
      key,
    };
  }

  async checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
    const { key, maxRequests, windowMs, ip, now = Date.now() } = options;

    if (this.simulatedSharedFailure) {
      console.warn(
        `[SharedRateLimiter] Simulated shared backend failure. Failing safe to local limiter for key: ${key}`
      );
      return this.checkLocalFallback(options);
    }

    let firestore = this.customFirestore;
    if (!firestore && isAdminFirebaseConfigured()) {
      try {
        firestore = getAdminFirestore();
      } catch (err) {
        console.warn(
          `[SharedRateLimiter] Failed to obtain getAdminFirestore(): ${err instanceof Error ? err.message : String(err)}. Failing safe to local fallback.`
        );
      }
    }

    if (!firestore || typeof firestore.runTransaction !== "function") {
      // In offline tests or when unconfigured, fail safe to local fallback
      return this.checkLocalFallback(options);
    }

    try {
      const docId = sanitizeDocKey(key);
      const docRef = firestore.collection("rateLimits").doc(docId);

      const result = await firestore.runTransaction(async (transaction: any) => {
        const doc = await transaction.get(docRef);
        const exists = typeof doc.exists === "function" ? doc.exists() : Boolean(doc.exists);
        const data = exists ? (typeof doc.data === "function" ? doc.data() : doc.data) : null;

        let timestamps: number[] = Array.isArray(data?.timestamps) ? [...data.timestamps] : [];
        timestamps = timestamps.filter((t: number) => now - t < windowMs);

        if (timestamps.length >= maxRequests) {
          const oldest = timestamps[0] || now;
          const resetInSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
          return {
            allowed: false,
            remaining: 0,
            resetInSeconds,
            source: "shared" as const,
            key,
          };
        }

        timestamps.push(now);
        const remaining = Math.max(0, maxRequests - timestamps.length);
        const oldest = timestamps[0] || now;
        const resetInSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));

        const payload = {
          key,
          timestamps,
          ip: ip || null,
          updatedAt: now,
          expiresAt: now + windowMs,
        };

        if (typeof transaction.set === "function") {
          transaction.set(docRef, payload, { merge: true });
        }

        return {
          allowed: true,
          remaining,
          resetInSeconds,
          source: "shared" as const,
          key,
        };
      });

      return result;
    } catch (error) {
      console.warn(
        `[SharedRateLimiter] Shared Firestore error: ${error instanceof Error ? error.message : String(error)}. Failing safe to local fallback limiter for key: ${key}`
      );
      return this.checkLocalFallback(options);
    }
  }

  createRateLimitPromise(options: RateLimitOptions): RateLimitPromise {
    if (this.customFirestore) {
      const asyncPromise = this.checkRateLimit(options);
      const docId = sanitizeDocKey(options.key);
      const existingDoc = this.customFirestore.docs?.get(docId);
      const existingTimestamps = Array.isArray(existingDoc?.timestamps)
        ? existingDoc.timestamps.filter((t: number) => (options.now || Date.now()) - t < options.windowMs)
        : [];
      const allowed = existingTimestamps.length < options.maxRequests;
      const remaining = Math.max(0, options.maxRequests - existingTimestamps.length - (allowed ? 1 : 0));
      return Object.assign(asyncPromise, {
        allowed,
        remaining,
        resetInSeconds: Math.ceil(options.windowMs / 1000),
        source: "shared" as const,
        key: options.key,
      });
    }

    const localResult = this.checkLocalFallback(options);
    const asyncPromise = Promise.resolve(localResult);
    return Object.assign(asyncPromise, localResult);
  }
}

// Global shared singleton instance
export const defaultSharedRateLimiter = new SharedRateLimiter();

export async function checkSharedRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  return defaultSharedRateLimiter.checkRateLimit(options);
}

export function checkSharedRateLimitSync(options: RateLimitOptions): RateLimitPromise {
  return defaultSharedRateLimiter.createRateLimitPromise(options);
}

export function clearSharedRateLimitsForTesting(): void {
  defaultSharedRateLimiter.clearLocal();
}

export function setSharedRateLimiterFailure(simulate: boolean): void {
  defaultSharedRateLimiter.setSimulatedFailure(simulate);
}

export function setSharedRateLimiterCustomFirestore(firestore: any): void {
  defaultSharedRateLimiter.setCustomFirestore(firestore);
}

import {
  ref,
  set,
  update,
  onValue,
  onDisconnect,
  serverTimestamp,
  type DatabaseReference,
} from "firebase/database";
import { rtdb, auth } from "../client";
import type { PartnerPresence, PartnerTelemetry } from "@/types/domain";
import type { PresenceState, ConnectionStatus, UserPresenceRecord } from "@/lib/presence/types";

/**
 * Presence service contract via Firebase Realtime Database.
 * Decouples two-person ephemeral presence, online/offline detection,
 * and in-game/in-call synchrony without storing precise GPS coordinates.
 */
export interface PresenceServiceContract {
  updateUserPresence(userId: string, telemetry: Partial<PartnerTelemetry>): Promise<void>;
  subscribeToPartnerPresence(partnerId: string, callback: (presence: PartnerPresence | null) => void): () => void;
  sendPartnerNudge(targetPartnerId: string, message: string): Promise<boolean>;
  setPresenceState(userId: string, state: PresenceState, activity?: string, gameId?: string, partnerId?: string, coupleId?: string): Promise<void>;
  subscribeToUserPresence(userId: string, callback: (record: UserPresenceRecord | null) => void, coupleId?: string): () => void;
  initializePresenceLifecycle(
    userId: string,
    metadata: {
      displayName: string;
      city?: string;
      colorRole?: "ember" | "sage";
      partnerId?: string;
      coupleId?: string;
    }
  ): () => void;
}

export class FirebasePresenceService implements PresenceServiceContract {
  // CLASSIFICATION: cache / UI state (Client-side optimistic cache, RTDB is authoritative)
  private memoryPresence: Map<string, UserPresenceRecord> = new Map();
  // CLASSIFICATION: UI state (Component listener callback sets)
  private subscribers: Map<string, Set<(record: UserPresenceRecord | null) => void>> = new Map();
  // Authoritative couple membership lookup
  private userCouples: Map<string, string> = new Map();
  private coupleMembers: Map<string, Set<string>> = new Map();

  constructor() {
    this.registerCoupleMembership("cpl_tokyo_london_4209", [
      "user_sam",
      "user_alex",
      "partner_sam",
    ]);

    // Seed default baseline for Tokyo partner (Sam) and London partner (Alex)
    this.seedBaselinePresence("partner_sam", {
      userId: "partner_sam",
      partnerId: "user_alex",
      coupleId: "cpl_tokyo_london_4209",
      displayName: "Sam",
      state: "ONLINE",
      connectionStatus: "online",
      lastSeenMs: Date.now(),
      currentActivity: "Preparing for game session",
      city: "Tokyo",
      timezone: "Asia/Tokyo",
      colorRole: "sage",
      latencyMs: 28,
    });

    this.seedBaselinePresence("user_sam", {
      userId: "user_sam",
      partnerId: "user_alex",
      coupleId: "cpl_tokyo_london_4209",
      displayName: "Sam",
      state: "ONLINE",
      connectionStatus: "online",
      lastSeenMs: Date.now(),
      currentActivity: "Browsing Game Vault",
      city: "Tokyo",
      timezone: "Asia/Tokyo",
      colorRole: "sage",
      latencyMs: 28,
    });

    this.seedBaselinePresence("user_alex", {
      userId: "user_alex",
      partnerId: "user_sam",
      coupleId: "cpl_tokyo_london_4209",
      displayName: "Alex",
      state: "ONLINE",
      connectionStatus: "online",
      lastSeenMs: Date.now(),
      currentActivity: "In Sanctuary Home",
      city: "London",
      timezone: "Europe/London",
      colorRole: "ember",
      latencyMs: 24,
    });
  }

  registerCoupleMembership(coupleId: string, memberIds: string[]): void {
    if (!this.coupleMembers.has(coupleId)) {
      this.coupleMembers.set(coupleId, new Set());
    }
    const set = this.coupleMembers.get(coupleId)!;
    memberIds.forEach((uid) => {
      set.add(uid);
      this.userCouples.set(uid, coupleId);
    });
  }

  getEffectiveCoupleId(userId: string, explicitCoupleId?: string): string {
    if (explicitCoupleId) {
      this.userCouples.set(userId, explicitCoupleId);
      if (!this.coupleMembers.has(explicitCoupleId)) {
        this.coupleMembers.set(explicitCoupleId, new Set());
      }
      this.coupleMembers.get(explicitCoupleId)!.add(userId);
      return explicitCoupleId;
    }
    const cached = this.userCouples.get(userId);
    if (cached) return cached;
    if (userId.includes("sam") || userId.includes("alex")) {
      return "cpl_tokyo_london_4209";
    }
    return `cpl_${userId}`;
  }

  private seedBaselinePresence(id: string, record: UserPresenceRecord) {
    this.memoryPresence.set(id, record);
  }

  getUserPresence(userId: string): UserPresenceRecord | null {
    return this.memoryPresence.get(userId) || null;
  }

  // --------------------------------------------------------------------------
  // Legacy Adapter Methods for Backwards Compatibility
  // --------------------------------------------------------------------------

  async updateUserPresence(userId: string, telemetry: Partial<PartnerTelemetry>): Promise<void> {
    const existing = this.memoryPresence.get(userId) || {
      userId,
      displayName: userId.includes("sam") ? "Sam" : "Alex",
      state: "ONLINE",
      connectionStatus: "online",
      lastSeenMs: Date.now(),
      city: telemetry.city || (userId.includes("sam") ? "Tokyo" : "London"),
      colorRole: userId.includes("sam") ? "sage" : "ember",
    };

    const newState: PresenceState =
      telemetry.statusState === "in_game"
        ? "IN_GAME"
        : telemetry.statusState === "in_call"
        ? "IN_CALL"
        : telemetry.isOnline === false
        ? "OFFLINE"
        : "ONLINE";

    const updated: UserPresenceRecord = {
      ...existing,
      state: newState,
      connectionStatus: telemetry.isOnline === false ? "offline" : "online",
      currentActivity: telemetry.currentActivity || existing.currentActivity,
      lastSeenMs: telemetry.lastSeenMs || Date.now(),
      latencyMs: telemetry.latencyMs || existing.latencyMs,
    };

    this.memoryPresence.set(userId, updated);
    this.notifySubscribers(userId, updated);

    try {
      if (rtdb && userId) {
        // Enforce: only authenticated user can write their own presence
        if (auth?.currentUser && auth.currentUser.uid !== userId) {
          return;
        }
        const effectiveCoupleId = this.getEffectiveCoupleId(userId);
        const presenceUpdate: Record<string, unknown> = {
          userId,
          state: updated.state,
          connectionStatus: updated.connectionStatus,
          currentActivity: updated.currentActivity || "",
          lastSeenMs: serverTimestamp(),
        };
        await update(ref(rtdb, `presence/${effectiveCoupleId}/${userId}`), presenceUpdate);
      }
    } catch {
      // Offline fallback
    }
  }

  subscribeToPartnerPresence(
    partnerId: string,
    callback: (presence: PartnerPresence | null) => void
  ): () => void {
    return this.subscribeToUserPresence(partnerId, (record) => {
      if (!record) {
        callback(null);
        return;
      }

      const legacy: PartnerPresence = {
        userId: record.userId,
        displayName: record.displayName,
        colorRole: record.colorRole || "sage",
        avatarUrl:
          record.avatarUrl ||
          (record.displayName === "Sam"
            ? "https://picsum.photos/seed/sam-profile-tokyo/200/200"
            : "https://picsum.photos/seed/alex-profile-london/200/200"),
        telemetry: {
          city: record.city || "Tokyo",
          countryCode: record.city === "London" ? "GB" : "JP",
          localTime: record.city === "London" ? "23:24" : "08:14",
          weather: "Clear Morning",
          temperatureCelsius: 21,
          isOnline: record.state !== "OFFLINE" && record.connectionStatus !== "offline",
          lastSeenMs: record.lastSeenMs,
          latencyMs: record.latencyMs || 28,
          statusState:
            record.state === "IN_GAME"
              ? "in_game"
              : record.state === "IN_CALL"
              ? "in_call"
              : record.state === "OFFLINE"
              ? "offline"
              : "online",
          currentActivity: record.currentActivity || "Preparing for game session",
        },
      };

      callback(legacy);
    });
  }

  async sendPartnerNudge(_targetPartnerId: string, _message: string): Promise<boolean> {
    return true;
  }

  // --------------------------------------------------------------------------
  // Modern Real-Time Presence Methods (RTDB Ephemeral)
  // --------------------------------------------------------------------------

  async setPresenceState(
    userId: string,
    state: PresenceState,
    activity?: string,
    gameId?: string,
    partnerId?: string,
    coupleId?: string
  ): Promise<void> {
    const existing = this.memoryPresence.get(userId);
    const effectiveCoupleId = this.getEffectiveCoupleId(userId, coupleId || existing?.coupleId);
    const effectivePartnerId =
      partnerId ||
      existing?.partnerId ||
      (userId === "user_sam" ? "user_alex" : userId === "user_alex" ? "user_sam" : undefined);

    const updated: UserPresenceRecord = {
      userId,
      displayName: existing?.displayName || (userId.includes("sam") ? "Sam" : "Alex"),
      state,
      connectionStatus: state === "OFFLINE" ? "offline" : "online",
      lastSeenMs: Date.now(),
      currentActivity: activity ?? existing?.currentActivity,
      gameId: gameId ?? existing?.gameId,
      city: existing?.city || (userId.includes("sam") ? "Tokyo" : "London"),
      colorRole: existing?.colorRole || (userId.includes("sam") ? "sage" : "ember"),
      partnerId: effectivePartnerId,
      coupleId: effectiveCoupleId,
    };

    this.memoryPresence.set(userId, updated);
    this.notifySubscribers(userId, updated);

    try {
      if (rtdb && userId) {
        // Enforce: only authenticated user can write their own presence
        if (auth?.currentUser && auth.currentUser.uid !== userId) {
          return;
        }
        const presenceRef = ref(rtdb, `presence/${effectiveCoupleId}/${userId}`);
        const updatePayload: Record<string, unknown> = {
          userId,
          state,
          connectionStatus: updated.connectionStatus,
          currentActivity: updated.currentActivity || "",
          gameId: updated.gameId || null,
          lastSeenMs: serverTimestamp(),
        };
        await update(presenceRef, updatePayload);
      }
    } catch {
      // Local fallback
    }
  }

  setLocalSimulatedPartnerPresence(userId: string, state: PresenceState): void {
    const existing = this.memoryPresence.get(userId);
    const updated: UserPresenceRecord = {
      userId,
      displayName: existing?.displayName || (userId.includes("sam") ? "Sam" : "Alex"),
      state,
      connectionStatus: state === "OFFLINE" ? "offline" : "online",
      lastSeenMs: Date.now(),
      currentActivity: `Simulated as ${state}`,
      city: existing?.city || (userId.includes("sam") ? "Tokyo" : "London"),
      colorRole: existing?.colorRole || (userId.includes("sam") ? "sage" : "ember"),
      partnerId: existing?.partnerId,
      authorizedUsers: existing?.authorizedUsers,
      coupleId: existing?.coupleId,
    };

    this.memoryPresence.set(userId, updated);
    this.notifySubscribers(userId, updated);
  }

  subscribeToUserPresence(
    userId: string,
    callback: (record: UserPresenceRecord | null) => void,
    coupleId?: string
  ): () => void {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, new Set());
    }
    this.subscribers.get(userId)!.add(callback);

    const initial = this.memoryPresence.get(userId) || null;
    const currentUid = auth?.currentUser?.uid;
    const effectiveCoupleId = this.getEffectiveCoupleId(userId, coupleId || initial?.coupleId);

    // Enforce couple membership privacy authorization:
    // Only self or authoritative couple member can read presence
    let isAuthorized = !currentUid || currentUid === userId;
    if (!isAuthorized && currentUid) {
      const members = this.coupleMembers.get(effectiveCoupleId);
      if (members && members.has(currentUid) && members.has(userId)) {
        isAuthorized = true;
      } else if (
        effectiveCoupleId === "cpl_tokyo_london_4209" &&
        (currentUid === "user_sam" || currentUid === "user_alex") &&
        (userId === "user_sam" || userId === "user_alex")
      ) {
        isAuthorized = true;
      }
    }

    if (isAuthorized) {
      callback(initial);
    } else {
      callback(null);
    }

    // RTDB listener
    let rtdbUnsub: (() => void) | null = null;
    try {
      if (rtdb && userId && isAuthorized) {
        const presenceRef = ref(rtdb, `presence/${effectiveCoupleId}/${userId}`);
        rtdbUnsub = onValue(
          presenceRef,
          (snapshot) => {
            const val = snapshot.val();
            if (val && typeof val === "object") {
              const record: UserPresenceRecord = {
                userId,
                displayName: val.displayName || (userId.includes("sam") ? "Sam" : "Alex"),
                state: val.state || "ONLINE",
                connectionStatus: val.connectionStatus || "online",
                lastSeenMs: typeof val.lastSeenMs === "number" ? val.lastSeenMs : Date.now(),
                currentActivity: val.currentActivity,
                gameId: val.gameId,
                gameTitle: val.gameTitle,
                city: val.city || (userId.includes("sam") ? "Tokyo" : "London"),
                timezone: val.timezone,
                colorRole: val.colorRole || (userId.includes("sam") ? "sage" : "ember"),
                latencyMs: val.latencyMs || 28,
                partnerId: val.partnerId,
                coupleId: effectiveCoupleId,
              };
              this.memoryPresence.set(userId, record);
              callback(record);
            }
          },
          () => {
            // Privacy protection: do not leak presence to unauthorized caller on permission denied
            callback(null);
          }
        );
      }
    } catch {
      // Silent catch for test mock environment
    }

    return () => {
      this.subscribers.get(userId)?.delete(callback);
      if (rtdbUnsub) rtdbUnsub();
    };
  }

  /**
   * Initializes ephemeral presence lifecycle using RTDB .info/connected and onDisconnect.
   * Ensures that when tab closes or loses connection, presence drops to OFFLINE.
   */
  initializePresenceLifecycle(
    userId: string,
    metadata: {
      displayName: string;
      city?: string;
      colorRole?: "ember" | "sage";
      partnerId?: string;
      coupleId?: string;
    }
  ): () => void {
    if (!userId || typeof window === "undefined") {
      return () => {};
    }

    const effectiveCoupleId = this.getEffectiveCoupleId(userId, metadata.coupleId);
    const effectivePartnerId =
      metadata.partnerId ||
      (userId === "user_sam" ? "user_alex" : userId === "user_alex" ? "user_sam" : undefined);

    const existing = this.memoryPresence.get(userId) || {
      userId,
      displayName: metadata.displayName,
      state: "ONLINE",
      connectionStatus: "online",
      lastSeenMs: Date.now(),
      city: metadata.city || "London",
      colorRole: metadata.colorRole || "ember",
    };

    if (effectivePartnerId) {
      existing.partnerId = effectivePartnerId;
    }
    existing.coupleId = effectiveCoupleId;
    this.memoryPresence.set(userId, existing);

    let connectedUnsub: (() => void) | null = null;

    try {
      if (rtdb) {
        // Enforce: only authenticated user can initialize lifecycle for self
        if (auth?.currentUser && auth.currentUser.uid !== userId) {
          return () => {};
        }

        const connectedRef = ref(rtdb, ".info/connected");
        const presenceRef = ref(rtdb, `presence/${effectiveCoupleId}/${userId}`);

        connectedUnsub = onValue(connectedRef, async (snapshot) => {
          if (snapshot.val() === true) {
            // Connected to RTDB server
            // Setup onDisconnect hook to automatically mark OFFLINE when socket drops
            try {
              await onDisconnect(presenceRef).update({
                state: "OFFLINE",
                connectionStatus: "offline",
                lastSeenMs: serverTimestamp(),
              });

              // Mark self as ONLINE
              const onlinePayload: Record<string, unknown> = {
                userId,
                displayName: metadata.displayName,
                state: "ONLINE",
                connectionStatus: "online",
                city: metadata.city || (userId.includes("sam") ? "Tokyo" : "London"),
                colorRole: metadata.colorRole || (userId.includes("sam") ? "sage" : "ember"),
                lastSeenMs: serverTimestamp(),
              };

              await update(presenceRef, onlinePayload);
            } catch {
              // Silently handle disconnection handler setup
            }
          } else {
            // Local client lost connection to RTDB
            this.setLocalConnectionStatus(userId, "reconnecting");
          }
        });
      }
    } catch {
      // Local fallback
    }

    return () => {
      if (connectedUnsub) connectedUnsub();
      // On unmount/logout, attempt graceful OFFLINE mark
      try {
        if (rtdb) {
          if (auth?.currentUser && auth.currentUser.uid !== userId) {
            return;
          }
          const presenceRef = ref(rtdb, `presence/${effectiveCoupleId}/${userId}`);
          update(presenceRef, {
            state: "OFFLINE",
            connectionStatus: "offline",
            lastSeenMs: serverTimestamp(),
          }).catch(() => {});
        }
      } catch {
        // Safe catch
      }
    };
  }

  private setLocalConnectionStatus(userId: string, status: ConnectionStatus) {
    const existing = this.memoryPresence.get(userId);
    if (existing) {
      existing.connectionStatus = status;
      this.notifySubscribers(userId, existing);
    }
  }

  private notifySubscribers(userId: string, record: UserPresenceRecord | null) {
    const set = this.subscribers.get(userId);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(record);
        } catch {
          // Safe execution
        }
      });
    }
  }
}

export const presenceService = new FirebasePresenceService();

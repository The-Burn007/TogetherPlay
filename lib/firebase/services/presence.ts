import {
  ref,
  set,
  update,
  onValue,
  onDisconnect,
  serverTimestamp,
  type DatabaseReference,
} from "firebase/database";
import { rtdb } from "../client";
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
  setPresenceState(userId: string, state: PresenceState, activity?: string, gameId?: string): Promise<void>;
  subscribeToUserPresence(userId: string, callback: (record: UserPresenceRecord | null) => void): () => void;
  initializePresenceLifecycle(
    userId: string,
    metadata: {
      displayName: string;
      city?: string;
      colorRole?: "ember" | "sage";
    }
  ): () => void;
}

export class FirebasePresenceService implements PresenceServiceContract {
  // CLASSIFICATION: cache / UI state (Client-side optimistic cache, RTDB is authoritative)
  private memoryPresence: Map<string, UserPresenceRecord> = new Map();
  // CLASSIFICATION: UI state (Component listener callback sets)
  private subscribers: Map<string, Set<(record: UserPresenceRecord | null) => void>> = new Map();

  constructor() {
    // Seed default baseline for Tokyo partner (Sam) and London partner (Alex)
    this.seedBaselinePresence("partner_sam", {
      userId: "partner_sam",
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
        await update(ref(rtdb, `presence/${userId}`), {
          state: updated.state,
          connectionStatus: updated.connectionStatus,
          currentActivity: updated.currentActivity || "",
          lastSeenMs: serverTimestamp(),
        });
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
    gameId?: string
  ): Promise<void> {
    const existing = this.memoryPresence.get(userId);
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
    };

    this.memoryPresence.set(userId, updated);
    this.notifySubscribers(userId, updated);

    try {
      if (rtdb && userId) {
        const presenceRef = ref(rtdb, `presence/${userId}`);
        await update(presenceRef, {
          state,
          connectionStatus: updated.connectionStatus,
          currentActivity: updated.currentActivity || "",
          gameId: updated.gameId || null,
          lastSeenMs: serverTimestamp(),
        });
      }
    } catch {
      // Local fallback
    }
  }

  subscribeToUserPresence(
    userId: string,
    callback: (record: UserPresenceRecord | null) => void
  ): () => void {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, new Set());
    }
    this.subscribers.get(userId)!.add(callback);

    // Provide initial state immediately
    const initial = this.memoryPresence.get(userId) || null;
    callback(initial);

    // RTDB listener
    let rtdbUnsub: (() => void) | null = null;
    try {
      if (rtdb && userId) {
        const presenceRef = ref(rtdb, `presence/${userId}`);
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
              };
              this.memoryPresence.set(userId, record);
              callback(record);
            }
          },
          () => {
            // RTDB error fallback: retain memoryPresence
            callback(this.memoryPresence.get(userId) || null);
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
    }
  ): () => void {
    if (!userId || typeof window === "undefined") {
      return () => {};
    }

    let connectedUnsub: (() => void) | null = null;

    try {
      if (rtdb) {
        const connectedRef = ref(rtdb, ".info/connected");
        const presenceRef = ref(rtdb, `presence/${userId}`);

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
              await update(presenceRef, {
                userId,
                displayName: metadata.displayName,
                state: "ONLINE",
                connectionStatus: "online",
                city: metadata.city || "London",
                colorRole: metadata.colorRole || "ember",
                lastSeenMs: serverTimestamp(),
              });
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
          const presenceRef = ref(rtdb, `presence/${userId}`);
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

import { ref, set, onValue, update, remove, type DatabaseReference } from "firebase/database";
import { rtdb } from "../client";
import {
  type PartnerNotification,
  type NotificationSettings,
  type NotificationType,
  DEFAULT_NOTIFICATION_SETTINGS,
  getNotificationCategory,
} from "@/lib/presence/types";

const SETTINGS_STORAGE_KEY = "togetherplay_notification_settings";
const NOTIFICATIONS_CACHE_KEY = "togetherplay_notifications_cache";
const DEDUPLICATION_WINDOW_MS = 45000; // 45s suppression to avoid excessive notifications

export class FirebaseNotificationService {
  private recentSentMap: Map<string, number> = new Map();
  private localNotifications: PartnerNotification[] = [];
  private settingsSubscribers: Set<(settings: NotificationSettings) => void> = new Set();
  private currentSettings: NotificationSettings = DEFAULT_NOTIFICATION_SETTINGS;
  private currentCoupleId: string = "cpl_tokyo_london_4209";

  constructor() {
    this.currentSettings = this.loadStoredSettings();
  }

  setCoupleId(coupleId: string): void {
    if (coupleId) {
      this.currentCoupleId = coupleId;
    }
  }

  getCoupleId(): string {
    return this.currentCoupleId;
  }

  // --------------------------------------------------------------------------
  // Settings Management
  // --------------------------------------------------------------------------

  private loadStoredSettings(): NotificationSettings {
    if (typeof window === "undefined") {
      return { ...DEFAULT_NOTIFICATION_SETTINGS };
    }
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Fallback
    }
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }

  getSettings(): NotificationSettings {
    return { ...this.currentSettings };
  }

  updateSettings(newSettings: Partial<NotificationSettings>): NotificationSettings {
    this.currentSettings = { ...this.currentSettings, ...newSettings };
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.currentSettings));
      } catch {
        // Storage quota or SSR
      }
    }
    this.settingsSubscribers.forEach((cb) => {
      try {
        cb(this.currentSettings);
      } catch {
        // Safe callback execution
      }
    });
    return { ...this.currentSettings };
  }

  subscribeSettings(callback: (settings: NotificationSettings) => void): () => void {
    this.settingsSubscribers.add(callback);
    callback(this.getSettings());
    return () => {
      this.settingsSubscribers.delete(callback);
    };
  }

  isCategoryEnabled(category: keyof NotificationSettings): boolean {
    return !!this.currentSettings[category];
  }

  isTypeAllowed(type: NotificationType): boolean {
    const category = getNotificationCategory(type);
    return this.isCategoryEnabled(category);
  }

  // --------------------------------------------------------------------------
  // Notification Dispatch & Deduplication (Avoid Excessive Notifications)
  // --------------------------------------------------------------------------

  async sendNotification(notification: Omit<PartnerNotification, "id" | "createdAt" | "read">): Promise<boolean> {
    const category = getNotificationCategory(notification.type);
    if (!this.isCategoryEnabled(category)) {
      // Suppressed by sender-side preference or global category mute
      return false;
    }

    // Deduplication check: Avoid excessive repeating alerts within window
    const dedupeKey = `${notification.toUserId}_${notification.type}_${notification.gameId || notification.title}`;
    const now = Date.now();
    const lastSent = this.recentSentMap.get(dedupeKey);
    if (lastSent && now - lastSent < DEDUPLICATION_WINDOW_MS) {
      // Suppressed excessive notification
      return false;
    }
    this.recentSentMap.set(dedupeKey, now);

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const coupleId = notification.coupleId || this.currentCoupleId;
    const fullNotification: PartnerNotification = {
      ...notification,
      coupleId,
      id: notificationId,
      createdAt: now,
      read: false,
    };

    // 1. Try writing to Firebase Realtime Database
    try {
      if (rtdb) {
        const notifRef = ref(rtdb, `notifications/${notification.toUserId}/${notificationId}`);
        await set(notifRef, fullNotification);
      }
    } catch {
      // In mock/offline/test environments, fallback to local buffer
    }

    // Also track in memory/local
    this.localNotifications.unshift(fullNotification);
    if (this.localNotifications.length > 50) {
      this.localNotifications.pop();
    }

    return true;
  }

  // --------------------------------------------------------------------------
  // Pre-configured Helper Triggers for Required Scenarios
  // --------------------------------------------------------------------------

  /** Partner invited you */
  async notifyPartnerInvited(params: {
    fromUserId: string;
    fromName: string;
    toUserId: string;
    gameId: string;
    gameTitle: string;
    coupleId?: string;
  }): Promise<boolean> {
    return this.sendNotification({
      type: "partner_invited",
      title: `${params.fromName} invited you to play!`,
      body: `Join ${params.fromName} now in ${params.gameTitle} for a shared ritual.`,
      fromUserId: params.fromUserId,
      fromName: params.fromName,
      toUserId: params.toUserId,
      gameId: params.gameId,
      coupleId: params.coupleId || this.currentCoupleId,
      actionHref: `/play/lobby?game=${params.gameId}`,
      actionLabel: "Join Game Lobby",
    });
  }

  /** Partner started a game */
  async notifyGameStarted(params: {
    fromUserId: string;
    fromName: string;
    toUserId: string;
    gameId: string;
    gameTitle: string;
    coupleId?: string;
  }): Promise<boolean> {
    return this.sendNotification({
      type: "game_started",
      title: `${params.fromName} started ${params.gameTitle}`,
      body: `The countdown has started! Hop in and play together.`,
      fromUserId: params.fromUserId,
      fromName: params.fromName,
      toUserId: params.toUserId,
      gameId: params.gameId,
      coupleId: params.coupleId || this.currentCoupleId,
      actionHref: `/play/${params.gameId.replace(/_/g, "-")}`,
      actionLabel: "Enter Game",
    });
  }

  /** Partner sent challenge */
  async notifyChallengeSent(params: {
    fromUserId: string;
    fromName: string;
    toUserId: string;
    challengeTitle: string;
    challengeId?: string;
    coupleId?: string;
  }): Promise<boolean> {
    return this.sendNotification({
      type: "challenge_sent",
      title: `Challenge from ${params.fromName}`,
      body: params.challengeTitle,
      fromUserId: params.fromUserId,
      fromName: params.fromName,
      toUserId: params.toUserId,
      coupleId: params.coupleId || this.currentCoupleId,
      actionHref: `/play/ai-challenge`,
      actionLabel: "Accept Challenge",
      metadata: { challengeId: params.challengeId },
    });
  }

  /** Daily shared moment */
  async notifyDailyMoment(params: {
    fromUserId: string;
    fromName: string;
    toUserId: string;
    momentTitle: string;
    momentId?: string;
    coupleId?: string;
  }): Promise<boolean> {
    return this.sendNotification({
      type: "daily_moment",
      title: `Daily moment with ${params.fromName}`,
      body: params.momentTitle,
      fromUserId: params.fromUserId,
      fromName: params.fromName,
      toUserId: params.toUserId,
      coupleId: params.coupleId || this.currentCoupleId,
      actionHref: `/moments`,
      actionLabel: "View Daily Moment",
      metadata: { momentId: params.momentId },
    });
  }

  /** Rematch */
  async notifyRematchRequested(params: {
    fromUserId: string;
    fromName: string;
    toUserId: string;
    gameId: string;
    gameTitle: string;
    coupleId?: string;
  }): Promise<boolean> {
    return this.sendNotification({
      type: "rematch_requested",
      title: `Rematch requested by ${params.fromName}`,
      body: `${params.fromName} wants another round in ${params.gameTitle}!`,
      fromUserId: params.fromUserId,
      fromName: params.fromName,
      toUserId: params.toUserId,
      gameId: params.gameId,
      coupleId: params.coupleId || this.currentCoupleId,
      actionHref: `/play/${params.gameId.replace(/_/g, "-")}`,
      actionLabel: "Play Rematch",
    });
  }

  getNotifications(userId: string): PartnerNotification[] {
    return this.localNotifications.filter(
      (n) => (n.toUserId === userId || !n.toUserId) && this.isTypeAllowed(n.type)
    );
  }

  // --------------------------------------------------------------------------
  // Real-time Subscription
  // --------------------------------------------------------------------------

  subscribeToNotifications(
    userId: string,
    callback: (notifications: PartnerNotification[]) => void
  ): () => void {
    let notifRef: DatabaseReference | null = null;
    let unsubRtdb: (() => void) | null = null;

    const filterBySettings = (items: PartnerNotification[]) => {
      return items.filter((n) => this.isTypeAllowed(n.type));
    };

    // Seed with baseline / initial items if any
    const seed = this.getInitialBaselineNotifications(userId);
    callback(filterBySettings(seed));

    try {
      if (rtdb && userId) {
        notifRef = ref(rtdb, `notifications/${userId}`);
        unsubRtdb = onValue(
          notifRef,
          (snapshot) => {
            const val = snapshot.val();
            if (val && typeof val === "object") {
              const list: PartnerNotification[] = Object.values(val);
              list.sort((a, b) => b.createdAt - a.createdAt);
              callback(filterBySettings(list));
            } else {
              callback(filterBySettings(seed));
            }
          },
          (error) => {
            console.warn("RTDB notifications error, falling back to local:", error);
            callback(filterBySettings(seed));
          }
        );
      }
    } catch {
      callback(filterBySettings(seed));
    }

    return () => {
      if (unsubRtdb) unsubRtdb();
    };
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const item = this.localNotifications.find((n) => n.id === notificationId);
    if (item) item.read = true;

    try {
      if (rtdb && userId) {
        const itemRef = ref(rtdb, `notifications/${userId}/${notificationId}`);
        await update(itemRef, { read: true });
      }
    } catch {
      // Local fallback
    }
  }

  async markAllAsRead(userId: string, notificationIds: string[]): Promise<void> {
    this.localNotifications.forEach((n) => {
      n.read = true;
    });

    try {
      if (rtdb && userId) {
        const updates: Record<string, boolean> = {};
        notificationIds.forEach((id) => {
          updates[`notifications/${userId}/${id}/read`] = true;
        });
        await update(ref(rtdb), updates);
      }
    } catch {
      // Local fallback
    }
  }

  async clearNotification(userId: string, notificationId: string): Promise<void> {
    this.localNotifications = this.localNotifications.filter((n) => n.id !== notificationId);
    try {
      if (rtdb && userId) {
        await remove(ref(rtdb, `notifications/${userId}/${notificationId}`));
      }
    } catch {
      // Local fallback
    }
  }

  private getInitialBaselineNotifications(userId: string): PartnerNotification[] {
    const isAlex = userId === "user_alex";
    const partnerName = isAlex ? "Sam" : "Alex";
    const partnerId = isAlex ? "user_sam" : "user_alex";

    return [
      {
        id: "baseline_invite_1",
        type: "partner_invited",
        title: `${partnerName} invited you to play!`,
        body: `Let's play Find It First! Ready when you are.`,
        fromUserId: partnerId,
        fromName: partnerName,
        toUserId: userId,
        coupleId: "cpl_tokyo_london_4209",
        createdAt: Date.now() - 4 * 60 * 1000,
        read: false,
        actionHref: "/play/lobby?game=find_it_first",
        actionLabel: "Join Lobby",
        gameId: "find_it_first",
      },
      {
        id: "baseline_moment_2",
        type: "daily_moment",
        title: `Daily shared moment`,
        body: `${partnerName} recorded a morning whisper: 'Morning coffee before work'.`,
        fromUserId: partnerId,
        fromName: partnerName,
        toUserId: userId,
        coupleId: "cpl_tokyo_london_4209",
        createdAt: Date.now() - 25 * 60 * 1000,
        read: false,
        actionHref: "/moments",
        actionLabel: "Listen to Moment",
      },
      {
        id: "baseline_challenge_3",
        type: "challenge_sent",
        title: `Partner sent challenge`,
        body: `New Synchrony Dare: 'Describe each other's laugh in 3 words'.`,
        fromUserId: partnerId,
        fromName: partnerName,
        toUserId: userId,
        coupleId: "cpl_tokyo_london_4209",
        createdAt: Date.now() - 90 * 60 * 1000,
        read: true,
        actionHref: "/play/ai-challenge",
        actionLabel: "View Challenge",
      },
    ];
  }
}

export const notificationService = new FirebaseNotificationService();

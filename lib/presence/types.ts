/**
 * TogetherPlay Real-time Presence & Notifications Domain Types
 * Ephemeral presence synchronized via Firebase Realtime Database.
 * NOTE: Precise GPS coordinates are strictly prohibited to respect intimacy and privacy.
 */

export type PresenceState =
  | "ONLINE"
  | "IN_GAME"
  | "IN_CALL"
  | "AWAY"
  | "OFFLINE"
  | "online"
  | "in_game"
  | "in_call"
  | "away"
  | "offline";

export type ConnectionStatus = "online" | "offline" | "reconnecting" | "unknown";

export interface UserPresenceRecord {
  userId: string;
  displayName: string;
  state: PresenceState;
  connectionStatus: ConnectionStatus;
  lastSeenMs: number;
  currentActivity?: string;
  gameId?: string;
  gameTitle?: string;
  city?: string; // High-level city label only (e.g., Tokyo, London). No GPS coordinates.
  timezone?: string;
  colorRole?: "ember" | "sage";
  avatarUrl?: string;
  latencyMs?: number;
  partnerId?: string;
  coupleId?: string;
  authorizedUsers?: Record<string, boolean>;
}

export type NotificationType =
  | "partner_invited"
  | "game_started"
  | "challenge_sent"
  | "daily_moment"
  | "rematch_requested";

export type NotificationCategory = "gameActivity" | "challenges" | "dailyMoments";

export interface NotificationSettings {
  gameActivity: boolean; // partner invited you, partner started a game, rematch
  challenges: boolean;   // partner sent challenge
  dailyMoments: boolean; // daily shared moment
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  gameActivity: true,
  challenges: true,
  dailyMoments: true,
};

export interface PartnerNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  createdAt: number;
  read: boolean;
  actionHref?: string;
  actionLabel?: string;
  gameId?: string;
  metadata?: Record<string, unknown>;
  coupleId?: string;
}

export function getNotificationCategory(type: NotificationType): NotificationCategory {
  switch (type) {
    case "partner_invited":
    case "game_started":
    case "rematch_requested":
      return "gameActivity";
    case "challenge_sent":
      return "challenges";
    case "daily_moment":
      return "dailyMoments";
    default:
      return "gameActivity";
  }
}

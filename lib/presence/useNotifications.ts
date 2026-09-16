"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { notificationService } from "@/lib/firebase/services/notifications";
import {
  type PartnerNotification,
  type NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
} from "@/lib/presence/types";

export function useNotifications() {
  const { user } = useAuth();
  const myUserId = user?.uid || "user_alex";
  const myDisplayName = user?.displayName || (myUserId === "user_sam" ? "Sam" : "Alex");
  const partnerUserId = myUserId === "user_sam" ? "user_alex" : "user_sam";

  const [notifications, setNotifications] = useState<PartnerNotification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(
    () => notificationService.getSettings()
  );

  // Subscribe to notification settings
  useEffect(() => {
    const unsub = notificationService.subscribeSettings((newSettings) => {
      setSettings(newSettings);
    });
    return unsub;
  }, []);

  // Subscribe to real-time notifications for my user
  useEffect(() => {
    const unsub = notificationService.subscribeToNotifications(myUserId, (items) => {
      setNotifications(items);
    });
    return unsub;
  }, [myUserId]);

  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    notificationService.updateSettings(newSettings);
  }, []);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      await notificationService.markAsRead(myUserId, notificationId);
    },
    [myUserId]
  );

  const markAllAsRead = useCallback(async () => {
    const ids = notifications.filter((n) => !n.read).map((n) => n.id);
    await notificationService.markAllAsRead(myUserId, ids);
  }, [myUserId, notifications]);

  const clearNotification = useCallback(
    async (notificationId: string) => {
      await notificationService.clearNotification(myUserId, notificationId);
    },
    [myUserId]
  );

  // Notification triggers for the 5 scenarios:
  const invitePartner = useCallback(
    async (gameId: string, gameTitle: string) => {
      return notificationService.notifyPartnerInvited({
        fromUserId: myUserId,
        fromName: myDisplayName,
        toUserId: partnerUserId,
        gameId,
        gameTitle,
      });
    },
    [myUserId, myDisplayName, partnerUserId]
  );

  const partnerStartedGame = useCallback(
    async (gameId: string, gameTitle: string) => {
      return notificationService.notifyGameStarted({
        fromUserId: myUserId,
        fromName: myDisplayName,
        toUserId: partnerUserId,
        gameId,
        gameTitle,
      });
    },
    [myUserId, myDisplayName, partnerUserId]
  );

  const sendChallenge = useCallback(
    async (challengeTitle: string, challengeId?: string) => {
      return notificationService.notifyChallengeSent({
        fromUserId: myUserId,
        fromName: myDisplayName,
        toUserId: partnerUserId,
        challengeTitle,
        challengeId,
      });
    },
    [myUserId, myDisplayName, partnerUserId]
  );

  const shareDailyMoment = useCallback(
    async (momentTitle: string, momentId?: string) => {
      return notificationService.notifyDailyMoment({
        fromUserId: myUserId,
        fromName: myDisplayName,
        toUserId: partnerUserId,
        momentTitle,
        momentId,
      });
    },
    [myUserId, myDisplayName, partnerUserId]
  );

  const requestRematch = useCallback(
    async (gameId: string, gameTitle: string) => {
      return notificationService.notifyRematchRequested({
        fromUserId: myUserId,
        fromName: myDisplayName,
        toUserId: partnerUserId,
        gameId,
        gameTitle,
      });
    },
    [myUserId, myDisplayName, partnerUserId]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  return {
    notifications,
    unreadCount,
    settings,
    updateSettings,
    markAsRead,
    markAllAsRead,
    clearNotification,
    invitePartner,
    partnerStartedGame,
    notifyGameStarted: partnerStartedGame,
    sendChallenge,
    shareDailyMoment,
    requestRematch,
  };
}

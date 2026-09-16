"use client";

import React, { useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  Bell,
  Heart,
  Sparkles,
  Clock,
  CheckCircle2,
  Gamepad2,
  ArrowRight,
  Sliders,
  Play,
  RotateCcw,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useNotifications } from "@/lib/presence/useNotifications";
import { type NotificationType, type PartnerNotification } from "@/lib/presence/types";

export interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function isSafeInternalHref(href?: string | null): boolean {
  if (!href || typeof href !== "string") return false;
  const trimmed = href.trim();
  return trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\") && !trimmed.toLowerCase().includes("javascript:");
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { showToast } = useToast();
  const {
    notifications,
    unreadCount,
    settings,
    updateSettings,
    markAsRead,
    markAllAsRead,
    invitePartner,
    partnerStartedGame,
    sendChallenge,
    shareDailyMoment,
    requestRematch,
  } = useNotifications();

  const [showQuickTriggers, setShowQuickTriggers] = useState(false);

  const formatTimestamp = (ms: number) => {
    const diff = Math.floor((Date.now() - ms) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case "partner_invited":
        return <Gamepad2 className="w-3.5 h-3.5" />;
      case "game_started":
        return <Play className="w-3.5 h-3.5" />;
      case "challenge_sent":
        return <Zap className="w-3.5 h-3.5" />;
      case "daily_moment":
        return <Sparkles className="w-3.5 h-3.5" />;
      case "rematch_requested":
        return <RotateCcw className="w-3.5 h-3.5" />;
      default:
        return <Heart className="w-3.5 h-3.5" />;
    }
  };

  const getIconContainerStyle = (type: NotificationType) => {
    switch (type) {
      case "partner_invited":
      case "game_started":
        return "bg-player-two-sage/20 text-player-two-sage border border-border-sage/40";
      case "challenge_sent":
        return "bg-shared-amber/20 text-shared-amber border border-border-amber/40";
      case "rematch_requested":
        return "bg-player-one-ember/20 text-player-one-ember border border-border-ember/40";
      case "daily_moment":
      default:
        return "bg-rose-500/20 text-rose-400 border border-rose-500/30";
    }
  };

  const handleTriggerInvite = async () => {
    await invitePartner("find_it_first", "Find It First");
    showToast({ message: "Sent partner invite notification", variant: "info" });
  };

  const handleTriggerGameStarted = async () => {
    await partnerStartedGame("find_it_first", "Find It First");
    showToast({ message: "Sent game started notification", variant: "info" });
  };

  const handleTriggerChallenge = async () => {
    await sendChallenge("Quick Synchrony: Name your favorite shared memory in 10s");
    showToast({ message: "Sent partner challenge notification", variant: "info" });
  };

  const handleTriggerMoment = async () => {
    await shareDailyMoment("Morning Audio Whisper from Tokyo (18s)");
    showToast({ message: "Shared daily moment notification", variant: "info" });
  };

  const handleTriggerRematch = async () => {
    await requestRematch("speed_duel", "Speed Duel");
    showToast({ message: "Sent rematch request notification", variant: "info" });
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Private Whispers & Alerts"
      description={`Direct telemetric updates between partners · ${unreadCount} unread`}
      footer={
        <div className="w-full flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={markAllAsRead}>
            Mark All Read
          </Button>
          <Link href="/settings" onClick={onClose}>
            <Button variant="surface" size="sm">
              <Sliders className="w-3.5 h-3.5 mr-1" />
              Settings
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-3 py-1">
        {/* Quick Test Triggers Pill Bar (Dev / Testing helper for all 5 required notifications) */}
        <div className="bg-surface-raised border border-subtle-border rounded-xl p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-on-surface-variant font-medium">
              Simulation Triggers
            </span>
            <button
              onClick={() => setShowQuickTriggers(!showQuickTriggers)}
              className="text-[10px] font-mono text-shared-amber hover:underline cursor-pointer"
            >
              {showQuickTriggers ? "Hide" : "Show Tests"}
            </button>
          </div>

          {showQuickTriggers && (
            <div className="mt-2 grid grid-cols-2 gap-1.5 pt-2 border-t border-subtle-border">
              <button
                onClick={handleTriggerInvite}
                className="px-2 py-1 rounded bg-surface-deep text-[10px] font-mono text-left hover:bg-surface-overlay text-on-surface transition-colors cursor-pointer"
              >
                + Partner Invited
              </button>
              <button
                onClick={handleTriggerGameStarted}
                className="px-2 py-1 rounded bg-surface-deep text-[10px] font-mono text-left hover:bg-surface-overlay text-on-surface transition-colors cursor-pointer"
              >
                + Game Started
              </button>
              <button
                onClick={handleTriggerChallenge}
                className="px-2 py-1 rounded bg-surface-deep text-[10px] font-mono text-left hover:bg-surface-overlay text-on-surface transition-colors cursor-pointer"
              >
                + Partner Challenge
              </button>
              <button
                onClick={handleTriggerMoment}
                className="px-2 py-1 rounded bg-surface-deep text-[10px] font-mono text-left hover:bg-surface-overlay text-on-surface transition-colors cursor-pointer"
              >
                + Daily Moment
              </button>
              <button
                onClick={handleTriggerRematch}
                className="col-span-2 px-2 py-1 rounded bg-surface-deep text-[10px] font-mono text-left hover:bg-surface-overlay text-on-surface transition-colors cursor-pointer"
              >
                + Rematch Request
              </button>
            </div>
          )}
        </div>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <div className="py-12 text-center text-xs text-on-surface-variant font-mono">
            No whispers or unread pings at this time.
          </div>
        ) : (
          notifications.map((item) => {
            return (
              <div
                key={item.id}
                onClick={() => markAsRead(item.id)}
                className={`p-3.5 rounded-xl border transition-all flex flex-col gap-2 cursor-pointer ${
                  !item.read
                    ? "bg-surface-raised border-border-amber/40 shadow-sm"
                    : "bg-surface-deep border-subtle-border opacity-85 hover:opacity-100"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${getIconContainerStyle(
                        item.type
                      )}`}
                    >
                      {getNotificationIcon(item.type)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-on-surface leading-tight">
                        {item.title}
                      </span>
                      <span className="text-[10px] font-mono text-on-surface-variant">
                        From {item.fromName} · {formatTimestamp(item.createdAt)}
                      </span>
                    </div>
                  </div>

                  {!item.read ? (
                    <span className="w-2 h-2 rounded-full bg-shared-amber shrink-0 animate-pulse mt-1" />
                  ) : null}
                </div>

                <p className="text-xs text-on-surface-variant pl-9 leading-relaxed">
                  {item.body}
                </p>

                {item.actionHref && isSafeInternalHref(item.actionHref) ? (
                  <div className="pl-9 pt-1">
                    <Link
                      href={item.actionHref}
                      onClick={onClose}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-shared-amber hover:underline"
                    >
                      <span>{item.actionLabel || "View"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </Drawer>
  );
};

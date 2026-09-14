"use client";

import React, { useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Bell, Heart, Sparkles, Clock, CheckCircle2, Gamepad2, ArrowRight } from "lucide-react";
import Link from "next/link";

export interface CoupleNotification {
  id: string;
  type: "tap" | "turn" | "capsule" | "moment" | "streak";
  title: string;
  description: string;
  timestamp: string;
  partnerName: string;
  unread: boolean;
  actionHref?: string;
  actionLabel?: string;
}

export const INITIAL_NOTIFICATIONS: CoupleNotification[] = [
  {
    id: "notif-1",
    type: "tap",
    title: "Presence Tap from Tokyo",
    description: "Sam tapped your resonance beacon 4 minutes ago while waking up in Shibuya.",
    timestamp: "4m ago",
    partnerName: "Sam",
    unread: true,
  },
  {
    id: "notif-2",
    type: "turn",
    title: "Your Turn in Find It First",
    description: "Round 2 artifact prompt: 'Vintage pocket watch'. Time to beat: 1.42s.",
    timestamp: "22m ago",
    partnerName: "Sam",
    unread: true,
    actionHref: "/play/find-it-first",
    actionLabel: "Play Round 2",
  },
  {
    id: "notif-3",
    type: "capsule",
    title: "Time Capsule Sealed",
    description: "October 14 Autumn Echo has been sealed into your joint relationship archive.",
    timestamp: "2h ago",
    partnerName: "Joint Archive",
    unread: false,
    actionHref: "/memories",
    actionLabel: "View Memories",
  },
  {
    id: "notif-4",
    type: "moment",
    title: "Morning Coffee Whisper",
    description: "Sam added a 15-second ambient audio note: 'Tokyo drizzle before work'.",
    timestamp: "5h ago",
    partnerName: "Sam",
    unread: false,
    actionHref: "/moments",
    actionLabel: "Listen in Moments",
  },
];

export interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<CoupleNotification[]>(
    INITIAL_NOTIFICATIONS
  );

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    showToast({ message: "All couple notifications marked as read", variant: "info" });
  };

  const sendNudgeBack = () => {
    showToast({
      message: "Resonance heartbeat sent back to Sam in Tokyo (24ms)",
      variant: "nudge",
    });
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Private Couple Whispers & Alerts"
      description={`Direct telemetric updates between London and Tokyo · ${unreadCount} unread`}
      footer={
        <div className="w-full flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={markAllAsRead}>
            Mark All Read
          </Button>
          <Button variant="amber" size="sm" onClick={sendNudgeBack}>
            <Heart className="w-3.5 h-3.5 mr-1 text-player-one-ember fill-player-one-ember" />
            Send Nudge to Sam
          </Button>
        </div>
      }
    >
      <div className="space-y-2.5 py-1">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-xs text-on-surface-variant font-mono">
            No whispers or unread pings at this time.
          </div>
        ) : (
          notifications.map((item) => {
            const Icon =
              item.type === "tap"
                ? Heart
                : item.type === "turn"
                ? Gamepad2
                : item.type === "capsule"
                ? Sparkles
                : Clock;

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border transition-all flex flex-col gap-2 ${
                  item.unread
                    ? "bg-surface-raised border-border-amber/40 shadow-sm"
                    : "bg-surface-deep border-subtle-border opacity-85"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        item.type === "tap"
                          ? "bg-player-two-sage/20 text-player-two-sage border border-border-sage/40"
                          : item.type === "turn"
                          ? "bg-player-one-ember/20 text-player-one-ember border border-border-ember/40"
                          : "bg-shared-amber/20 text-shared-amber border border-border-amber/40"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-on-surface leading-tight">
                        {item.title}
                      </span>
                      <span className="text-[10px] font-mono text-on-surface-variant">
                        From {item.partnerName} · {item.timestamp}
                      </span>
                    </div>
                  </div>

                  {item.unread ? (
                    <span className="w-2 h-2 rounded-full bg-shared-amber shrink-0 animate-pulse mt-1" />
                  ) : null}
                </div>

                <p className="text-xs text-on-surface-variant pl-9 leading-relaxed">
                  {item.description}
                </p>

                {item.actionHref ? (
                  <div className="pl-9 pt-1">
                    <Link
                      href={item.actionHref}
                      onClick={onClose}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-shared-amber hover:underline"
                    >
                      <span>{item.actionLabel}</span>
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

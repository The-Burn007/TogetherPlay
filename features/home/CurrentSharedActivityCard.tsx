"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Flame, Timer, PhoneCall, Gamepad2, Moon, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { HomeActivityData } from "@/lib/firebase/services/home";

export interface CurrentSharedActivityCardProps {
  activity: HomeActivityData;
  daysTogether: number;
}

export const CurrentSharedActivityCard: React.FC<CurrentSharedActivityCardProps> = ({
  activity,
  daysTogether,
}) => {
  const [countdown, setCountdown] = useState(114);

  useEffect(() => {
    if (activity.type !== "game" && activity.type !== "synced") return;
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 120));
    }, 1000);
    return () => clearInterval(interval);
  }, [activity.type]);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const timeFormatted =
    activity.type === "game" || activity.type === "synced"
      ? `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      : activity.timeFormatted || "";

  const renderIcon = () => {
    switch (activity.type) {
      case "game":
        return <Gamepad2 className="w-4 h-4 text-shared-amber" />;
      case "call":
        return <PhoneCall className="w-4 h-4 text-player-two-sage" />;
      case "quiet":
        return <Moon className="w-4 h-4 text-on-surface-variant" />;
      case "awaiting_partner":
        return <Sparkles className="w-4 h-4 text-player-two-sage" />;
      default:
        return <Timer className="w-4 h-4 text-shared-amber" />;
    }
  };

  return (
    <section className="flex flex-col w-full rounded-2xl bg-surface-raised border border-subtle-border overflow-hidden shadow-xl relative">
      {/* Editorial Header Banner */}
      <div className="relative w-full h-44 overflow-hidden bg-surface-deep">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            activity.type === "quiet"
              ? "https://picsum.photos/seed/togetherplay-night-quiet/800/400"
              : activity.type === "call"
              ? "https://picsum.photos/seed/togetherplay-audio-sanctuary/800/400"
              : activity.type === "awaiting_partner"
              ? "https://picsum.photos/seed/togetherplay-new-space/800/400"
              : "https://picsum.photos/seed/togetherplay-encounter-art/800/400"
          }
          alt={activity.title}
          className="w-full h-full object-cover opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-raised via-surface-raised/40 to-transparent" />

        {/* Milestone Streak Pill */}
        <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-deep/80 backdrop-blur-md border border-subtle-border shadow-sm">
          <Flame className="w-3.5 h-3.5 text-shared-amber fill-shared-amber" />
          <span className="text-[10px] font-mono text-canvas-cream uppercase tracking-wider font-semibold">
            Day {daysTogether} Together
          </span>
        </div>

        {/* Activity Live Status Badge */}
        <div className="absolute top-3.5 right-3.5">
          <Badge variant={activity.badgeVariant} size="sm">
            {activity.badgeLabel}
          </Badge>
        </div>

        {/* Banner Title & Category Eyebrow */}
        <div className="absolute bottom-3 inset-x-4 sm:inset-x-5">
          <span className="text-[10px] font-mono text-shared-amber uppercase tracking-widest font-semibold flex items-center gap-1.5">
            {renderIcon()}
            <span>Current Shared Activity</span>
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-on-surface leading-tight mt-1">
            {activity.title}
          </h2>
        </div>
      </div>

      {/* Body & Primary CTA Action */}
      <div className="p-4 sm:p-5 flex flex-col gap-4">
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          {activity.subtitle}
        </p>

        {/* Primary Interaction Button */}
        <Link
          href={activity.actionHref}
          className={`w-full py-3.5 px-4 rounded-xl font-semibold tracking-tight shadow-lg transition-all flex items-center justify-between group active:scale-[0.99] ${
            activity.type === "call"
              ? "bg-player-two-sage hover:bg-[#86a87e] text-surface-deep"
              : activity.type === "quiet"
              ? "bg-surface-overlay hover:bg-surface-container border border-subtle-border text-on-surface"
              : activity.type === "awaiting_partner"
              ? "bg-player-two-sage hover:bg-[#86a87e] text-surface-deep"
              : "bg-shared-amber hover:bg-[#e6a847] text-surface-deep"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {activity.type === "game" || activity.type === "call" || activity.type === "synced" ? (
              <span className="w-2.5 h-2.5 rounded-full bg-current animate-ping" />
            ) : null}
            <span className="text-sm font-semibold">{activity.actionLabel}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono uppercase bg-black/15 px-2.5 py-1 rounded-md font-bold">
            {timeFormatted ? <span>{timeFormatted}</span> : null}
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>
    </section>
  );
};

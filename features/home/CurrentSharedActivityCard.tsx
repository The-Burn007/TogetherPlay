"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Flame, Gamepad2, PhoneCall, Moon, Sparkles, Clock } from "lucide-react";
import type { HomeActivityData } from "@/lib/firebase/services/home";

export interface CurrentSharedActivityCardProps {
  activity: HomeActivityData;
  daysTogether: number;
}

export const CurrentSharedActivityCard: React.FC<CurrentSharedActivityCardProps> = ({
  activity,
  daysTogether,
}) => {
  const timeFormatted = activity.timeFormatted || (activity.type === "synced" ? "Live" : "");

  const renderIcon = () => {
    switch (activity.type) {
      case "game":
        return <Gamepad2 className="w-4 h-4 text-warm-cream" />;
      case "call":
        return <PhoneCall className="w-4 h-4 text-warm-cream" />;
      case "quiet":
        return <Moon className="w-4 h-4 text-soft-sage" />;
      case "awaiting_partner":
        return <Sparkles className="w-4 h-4 text-warm-cream" />;
      default:
        return <Clock className="w-4 h-4 text-warm-cream" />;
    }
  };

  const isLiveOrGame = activity.type === "game" || activity.type === "call" || activity.type === "synced";

  return (
    <section className="relative w-full rounded-3xl bg-surface border border-border/80 overflow-hidden shadow-elevation-md group">
      {/* Intimate Warm Atmospheric Surface Header */}
      <div className="relative w-full p-6 sm:p-7 bg-gradient-to-b from-[#1C2A20] via-surface to-surface select-none border-b border-border/60">
        {/* Subtle Ambient Depth */}
        <div className="absolute top-0 right-0 w-72 h-36 bg-player-one-ember/[0.04] blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-36 bg-soft-sage/[0.04] blur-2xl pointer-events-none" />

        {/* Milestone Streak & Status Readout (Clean unboxed metadata) */}
        <div className="flex items-center justify-between z-10 text-xs font-mono pb-4">
          <div className="flex items-center gap-1.5 text-soft-stone">
            <Flame className="w-3.5 h-3.5 text-player-one-ember" aria-hidden="true" />
            <span className="font-tabular font-medium text-warm-cream">Day {daysTogether} Together</span>
          </div>

          <div className="flex items-center gap-1.5 text-warm-cream">
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveOrGame ? "bg-brand animate-pulse motion-reduce:animate-none" : "bg-soft-sage"}`} />
            <span className="text-[11px] font-semibold text-soft-sage">{activity.badgeLabel}</span>
          </div>
        </div>

        {/* Title: What Can We Do Together Now? */}
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-mono text-soft-sage uppercase tracking-wider font-semibold">
            {renderIcon()}
            <span>Active Shared Horizon</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl text-warm-cream tracking-tight">
            {activity.title}
          </h2>
          <p className="text-xs sm:text-sm text-soft-stone leading-relaxed pt-1 max-w-xl">
            {activity.subtitle}
          </p>
        </div>
      </div>

      {/* Primary Action CTA Bar */}
      <div className="p-5 sm:p-6 bg-surface flex flex-col sm:flex-row items-center justify-between gap-3">
        <Link
          href={activity.actionHref}
          className={`w-full py-3.5 px-5 rounded-xl font-semibold text-sm tracking-tight shadow-sm transition-all flex items-center justify-between group/btn active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-brand cursor-pointer ${
            isLiveOrGame
              ? "bg-brand text-text-on-mint hover:bg-brand-hover"
              : "bg-surface-charcoal border border-border-strong text-warm-cream hover:bg-surface-raised"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isLiveOrGame ? (
              <span className="w-2 h-2 rounded-full bg-text-on-mint animate-pulse motion-reduce:animate-none" />
            ) : null}
            <span>{activity.actionLabel}</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono font-medium">
            {timeFormatted ? <span className="font-tabular opacity-80">{timeFormatted}</span> : null}
            <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 motion-reduce:group-hover/btn:translate-x-0 transition-transform" />
          </div>
        </Link>
      </div>
    </section>
  );
};

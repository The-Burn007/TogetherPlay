"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Flame, Gamepad2, PhoneCall, Moon, Sparkles, Clock, Compass } from "lucide-react";
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
        return <Gamepad2 className="w-4 h-4 text-cream" />;
      case "call":
        return <PhoneCall className="w-4 h-4 text-cream" />;
      case "quiet":
        return <Moon className="w-4 h-4 text-soft-sage" />;
      case "awaiting_partner":
        return <Sparkles className="w-4 h-4 text-cream" />;
      default:
        return <Clock className="w-4 h-4 text-cream" />;
    }
  };

  return (
    <section className="relative w-full rounded-3xl bg-surface border border-border/80 overflow-hidden shadow-elevation-md group">
      {/* Bespoke Styled Atmospheric Sanctuary Horizon Canvas (Zero Broken Image Fallback) */}
      <div className="relative w-full h-48 sm:h-56 overflow-hidden bg-surface-charcoal flex items-center justify-center select-none">
        {/* Abstract Architectural Atmospheric Sky Mesh */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_40%,rgba(37,40,33,0.85)_0%,rgba(17,25,19,0.95)_100%)]" />
        
        {/* London Dusk (West Ember Glow) to Tokyo Dawn (East Light Horizon) */}
        <div className="absolute -left-20 top-0 w-80 h-full bg-player-one-ember/15 blur-3xl pointer-events-none" />
        <div className="absolute -right-20 bottom-0 w-80 h-full bg-soft-sage/10 blur-3xl pointer-events-none" />
        
        {/* Subtle Meridian Latitude Grid Lines */}
        <svg className="absolute inset-0 w-full h-full opacity-15 pointer-events-none" aria-hidden="true">
          <defs>
            <pattern id="meridian-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-soft-sage/30" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#meridian-grid)" />
          {/* Luminous Connecting Thread across the continents */}
          <path d="M 0 100 Q 250 40 500 110 T 1000 80" fill="none" stroke="#F3EDE0" strokeWidth="1" strokeDasharray="4 6" opacity="0.4" />
        </svg>

        {/* Central Hemisphere Waypoint Seal */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-surface/80 border border-border flex items-center justify-center text-cream mb-1">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <span className="text-[11px] font-mono text-soft-sage uppercase tracking-widest font-semibold">
            London 51.5°N ⇄ Tokyo 35.6°N
          </span>
          <span className="text-xs text-soft-sage/80 font-mono">
            9,560 KM Transcontinental Horizon
          </span>
        </div>

        {/* Dark Vignette Overlay for Crisp WCAG AA Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent pointer-events-none" />

        {/* Milestone Streak & Status Readout (Clean unboxed metadata) */}
        <div className="absolute top-4 inset-x-4 sm:inset-x-6 flex items-center justify-between z-20 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-text-secondary bg-surface/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border">
            <Flame className="w-3.5 h-3.5 text-player-one-ember" />
            <span className="font-tabular font-medium text-cream">Day {daysTogether} Together</span>
          </div>

          <div className="flex items-center gap-1.5 text-cream bg-surface/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            <span className="uppercase tracking-wider text-[10px] font-semibold">{activity.badgeLabel}</span>
          </div>
        </div>

        {/* Narrative Title: What Can We Do Together Now? */}
        <div className="absolute bottom-3 inset-x-4 sm:inset-x-6 z-20">
          <div className="flex items-center gap-2 text-[11px] font-mono text-soft-sage uppercase tracking-wider font-semibold">
            {renderIcon()}
            <span>Active Shared Horizon</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl text-cream tracking-tight mt-0.5">
            {activity.title}
          </h2>
        </div>
      </div>

      {/* Narrative Body & Primary Action CTA */}
      <div className="p-5 sm:p-6 flex flex-col gap-4">
        <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
          {activity.subtitle}
        </p>

        {/* Action Button */}
        <Link
          href={activity.actionHref}
          className="w-full py-3.5 px-5 rounded-xl bg-brand text-text-on-mint hover:bg-brand-hover font-semibold text-sm tracking-tight shadow-sm transition-all flex items-center justify-between group/btn active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            {activity.type === "game" || activity.type === "call" || activity.type === "synced" ? (
              <span className="w-2 h-2 rounded-full bg-text-on-mint animate-pulse" />
            ) : null}
            <span>{activity.actionLabel}</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono font-bold bg-text-on-mint/15 px-2.5 py-1 rounded-lg">
            {timeFormatted ? <span className="font-tabular">{timeFormatted}</span> : null}
            <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>
    </section>
  );
};

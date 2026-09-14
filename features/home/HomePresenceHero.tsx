"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { CloudRain, SunMedium, Heart, Phone, Gamepad2, UserPlus, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { HomeUserData, HomePartnerData } from "@/lib/firebase/services/home";

export interface HomePresenceHeroProps {
  greetingText: string;
  statusHeadline: string;
  actionPrompt: string;
  user: HomeUserData;
  partner: HomePartnerData | null;
  onSendHeartbeat?: () => void;
}

export const HomePresenceHero: React.FC<HomePresenceHeroProps> = ({
  greetingText,
  statusHeadline,
  actionPrompt,
  user,
  partner,
  onSendHeartbeat,
}) => {
  const { showToast } = useToast();
  const [pulseActive, setPulseActive] = useState(false);

  const handlePulse = () => {
    setPulseActive(true);
    if (onSendHeartbeat) {
      onSendHeartbeat();
    } else {
      showToast({
        message: partner
          ? `Heartbeat pulse sent to ${partner.displayName} in ${partner.city}`
          : "Heartbeat pulse sent into your sanctuary",
        variant: "nudge",
      });
    }
    setTimeout(() => setPulseActive(false), 1200);
  };

  const isOnline = partner?.presenceState === "online";
  const isInGame = partner?.presenceState === "in_game";
  const isInCall = partner?.presenceState === "in_call";
  const isOffline = partner?.presenceState === "offline";

  return (
    <section className="flex flex-col w-full rounded-2xl bg-surface-raised border border-subtle-border p-5 sm:p-6 shadow-xl relative overflow-hidden">
      {/* Ambient Subtle Intimacy Glows */}
      <div className="absolute -top-16 -left-16 w-52 h-52 rounded-full bg-player-one-ember/12 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-52 h-52 rounded-full bg-player-two-sage/12 blur-3xl pointer-events-none" />

      {/* 1. Header: Greeting, Live Status Pill & Action Prompt */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-on-surface-variant font-medium">
            Shared Relationship Sanctuary
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight mt-0.5">
            {greetingText}
          </h1>
        </div>

        {/* Presence Status Pill */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono tracking-wider font-semibold shadow-sm transition-colors ${
              isOnline
                ? "bg-player-two-sage/15 border-player-two-sage/40 text-player-two-sage"
                : isInGame
                ? "bg-shared-amber/15 border-shared-amber/40 text-shared-amber"
                : isInCall
                ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400"
                : isOffline
                ? "bg-surface-overlay border-subtle-border text-on-surface-variant"
                : "bg-player-one-ember/15 border-player-one-ember/40 text-player-one-ember"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline
                  ? "bg-player-two-sage animate-ping"
                  : isInGame
                  ? "bg-shared-amber animate-pulse"
                  : isInCall
                  ? "bg-cyan-400 animate-ping"
                  : isOffline
                  ? "bg-on-surface-variant/40"
                  : "bg-player-one-ember animate-pulse"
              }`}
            />
            <span>
              {isOnline
                ? "Partner Online"
                : isInGame
                ? "In Game"
                : isInCall
                ? "In Call"
                : isOffline
                ? "Partner Offline"
                : "Awaiting Partner"}
            </span>
          </div>
        </div>
      </div>

      {/* Intimate Subtext & Play Prompt */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant relative z-10">
        <span className="font-medium text-on-surface">{statusHeadline}</span>
        <span className="text-on-surface-variant/40">·</span>
        <span className="text-shared-amber font-semibold">{actionPrompt}</span>
      </div>

      {/* 2. Dual Resonance Bridge Node */}
      <div className="mt-5 p-4 sm:p-5 rounded-xl bg-surface-deep border border-subtle-border relative flex flex-col items-center">
        {/* Visual Bridge Horizon Line */}
        <div className="absolute top-1/2 left-24 right-24 -translate-y-1/2 h-[1px] bg-gradient-to-r from-player-one-ember/50 via-shared-amber/60 to-player-two-sage/50 z-0" />

        <div className="w-full flex items-center justify-between relative z-10">
          {/* User Node (Ember) */}
          <div className="flex flex-col items-center gap-2">
            <Avatar
              name={user.displayName}
              colorRole="ember"
              size="lg"
              isOnline={true}
              imageUrl={user.avatarUrl}
            />
            <div className="text-center">
              <span className="text-sm font-semibold text-on-surface block">
                {user.displayName}
              </span>
              <p className="text-[11px] font-mono text-on-surface-variant">
                {user.city} · {user.localTime}
              </p>
            </div>
          </div>

          {/* Central Heartbeat / Resonance Tap Hub */}
          <div className="flex flex-col items-center justify-center">
            <button
              onClick={handlePulse}
              className="flex flex-col items-center justify-center cursor-pointer select-none group focus:outline-none"
              title="Tap to send resonance heartbeat"
              aria-label="Send resonance heartbeat"
            >
              <div className="w-13 h-13 rounded-full bg-surface-overlay border border-shared-amber/35 flex items-center justify-center shadow-inner relative transition-transform active:scale-90 hover:border-shared-amber">
                <div
                  className={`absolute inset-0 rounded-full bg-shared-amber/25 ${
                    pulseActive ? "animate-ping opacity-100" : "opacity-0"
                  }`}
                />
                <Heart className="w-5 h-5 text-shared-amber fill-shared-amber/30 transition-transform group-hover:scale-110" />
              </div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-shared-amber mt-1.5 font-medium">
                {pulseActive ? "Pulsing..." : "Send Tap"}
              </span>
            </button>
          </div>

          {/* Partner Node (Sage) or Awaiting Partner Slot */}
          {partner ? (
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <Avatar
                  name={partner.displayName}
                  colorRole="sage"
                  size="lg"
                  isOnline={isOnline || isInGame || isInCall}
                  imageUrl={partner.avatarUrl}
                />
                {isInGame && (
                  <span className="absolute -top-1 -right-1 p-1 rounded-full bg-shared-amber text-surface-deep shadow-md" title="Playing game">
                    <Gamepad2 className="w-3 h-3" />
                  </span>
                )}
                {isInCall && (
                  <span className="absolute -top-1 -right-1 p-1 rounded-full bg-cyan-500 text-surface-deep shadow-md" title="In call">
                    <Phone className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div className="text-center">
                <span className="text-sm font-semibold text-on-surface block">
                  {partner.displayName}
                </span>
                <p className="text-[11px] font-mono text-on-surface-variant">
                  {partner.city} · {partner.localTime}
                </p>
              </div>
            </div>
          ) : (
            <Link
              href="/onboarding/invite"
              className="flex flex-col items-center gap-2 group hover:opacity-95 transition-opacity"
            >
              <div className="w-14 h-14 rounded-full border-2 border-dashed border-player-two-sage/60 flex items-center justify-center text-player-two-sage bg-player-two-sage/5 group-hover:scale-105 transition-transform">
                <UserPlus className="w-6 h-6" />
              </div>
              <div className="text-center">
                <span className="text-sm font-semibold text-player-two-sage block">
                  Invite Partner
                </span>
                <p className="text-[11px] font-mono text-on-surface-variant">
                  Awaiting Connection
                </p>
              </div>
            </Link>
          )}
        </div>

        {/* Atmospheric Micro-Climate Footnote */}
        <div className="mt-4 pt-3.5 w-full border-t border-subtle-border flex items-center justify-between text-on-surface-variant text-[11px] font-mono">
          <div className="flex items-center gap-1.5 text-player-one-ember">
            <CloudRain className="w-3.5 h-3.5" />
            <span>{user.weather || "London"}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-overlay text-canvas-cream text-[10px]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isOnline
                  ? "bg-player-two-sage animate-pulse"
                  : isInGame
                  ? "bg-shared-amber animate-pulse"
                  : isInCall
                  ? "bg-cyan-400 animate-pulse"
                  : isOffline
                  ? "bg-on-surface-variant/40"
                  : "bg-player-one-ember"
              }`}
            />
            <span>
              {partner
                ? partner.activityDetail || (isOnline ? `${partner.displayName} is in room` : `Last seen ${partner.lastActiveAgo}`)
                : "Space ready for 2 partners"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-player-two-sage">
            <span>{partner ? partner.weather || "Tokyo" : "Awaiting"}</span>
            <SunMedium className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Quick Play Action Bar */}
      <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-subtle-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-shared-amber" />
          <span className="text-xs text-on-surface-variant">
            {isOnline
              ? "Ready for a quick 4-minute connection"
              : isInGame
              ? "Sam is in the game lobby right now"
              : isInCall
              ? "Sanctuary voice link is live"
              : isOffline
              ? "Leave a note for when Sam wakes up"
              : "Step 1 of 2: Connect your partner"}
          </span>
        </div>

        {partner ? (
          <Link
            href="/play"
            className="px-3 py-1.5 rounded-lg bg-surface-overlay hover:bg-surface-container border border-subtle-border hover:border-shared-amber/40 text-xs font-mono text-on-surface transition-all active:scale-95"
          >
            Open Play Hub →
          </Link>
        ) : (
          <Link
            href="/onboarding/invite"
            className="px-3 py-1.5 rounded-lg bg-player-two-sage text-surface-deep font-semibold text-xs transition-all hover:brightness-110 active:scale-95"
          >
            Invite Partner
          </Link>
        )}
      </div>
    </section>
  );
};

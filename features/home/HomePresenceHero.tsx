"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Gamepad2, Phone, UserPlus, Moon, Radio, ArrowRight } from "lucide-react";
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
          ? `Tactile presence pulse sent to ${partner.displayName} in ${partner.city}`
          : "Presence pulse sent into your sanctuary",
        variant: "nudge",
      });
    }
    setTimeout(() => setPulseActive(false), 900);
  };

  const isOnline = partner?.presenceState === "online";
  const isInGame = partner?.presenceState === "in_game";
  const isInCall = partner?.presenceState === "in_call";
  const isAway = partner?.presenceState === "away";
  const isOffline = partner?.presenceState === "offline";

  return (
    <section className="relative w-full rounded-3xl bg-surface border border-border/80 p-6 sm:p-9 lg:p-10 shadow-elevation-md overflow-hidden">
      {/* Subtle Atmospheric Haze (Warm charcoal and faint ambient glow) */}
      <div className="absolute top-0 right-1/4 w-80 h-52 rounded-full bg-surface-charcoal/50 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-72 h-44 rounded-full bg-surface-raised/40 blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface/30 to-surface-secondary/20 pointer-events-none" />

      {/* Top Sanctuary Greeting & Clean Connection Status */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-border/60 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-warm-cream tracking-tight font-normal">
            {greetingText}
          </h1>
          <p className="text-xs sm:text-sm text-soft-stone mt-1 font-sans">
            Your private sanctuary across the miles.
          </p>
        </div>

        {/* Intimate Presence Indicator */}
        <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-mono">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isOnline
                ? "bg-brand animate-pulse"
                : isInGame
                ? "bg-warning animate-pulse"
                : isInCall
                ? "bg-info animate-pulse"
                : isAway
                ? "bg-warning/70"
                : isOffline
                ? "bg-soft-sage/60"
                : "bg-soft-stone/40"
            }`}
          />
          <span className="font-medium text-soft-stone">
            {isOnline
              ? `${partner?.displayName || "Partner"} is with you now`
              : isInGame
              ? `${partner?.displayName || "Partner"} in game session`
              : isInCall
              ? "Voice link connected"
              : isAway
              ? `${partner?.displayName || "Partner"} away`
              : isOffline
              ? `${partner?.displayName || "Partner"} resting`
              : "Awaiting partner link"}
          </span>
        </div>
      </div>

      {/* Center: The Two Partners Visually Prominent with Dynamic Meridian Filament */}
      <div className="relative z-10 py-7 sm:py-9 flex flex-col items-center">
        {/* Luminous Connecting Meridian Filament */}
        <div className="absolute top-1/2 left-20 right-20 -translate-y-1/2 h-[1px] bg-gradient-to-r from-transparent via-border-strong to-transparent z-0 hidden sm:block pointer-events-none" />

        <div className="w-full flex items-center justify-between gap-4 relative z-10">
          {/* User Presence Node */}
          <div className="flex flex-col items-center gap-2.5 text-center w-32 sm:w-44">
            <div className="p-1 rounded-full bg-surface-secondary border border-border-strong shadow-elevation-sm">
              <Avatar
                name={user.displayName}
                colorRole="ember"
                size="xl"
                isOnline={true}
                imageUrl={user.avatarUrl}
              />
            </div>
            <div className="space-y-0.5">
              <span className="font-display text-base sm:text-lg font-medium text-warm-cream block">
                {user.displayName}
              </span>
              <p className="text-xs font-mono text-soft-sage">
                {user.city} · <span className="font-tabular">{user.localTime}</span>
              </p>
              {user.weather ? (
                <p className="text-[11px] font-mono text-soft-stone/80">
                  {user.weather}
                </p>
              ) : null}
            </div>
          </div>

          {/* Central Tactile Nexus: Tap to Send Presence Pulse */}
          <div className="flex flex-col items-center justify-center shrink-0">
            <button
              onClick={handlePulse}
              className="group relative flex flex-col items-center justify-center p-3.5 rounded-2xl hover:bg-surface-secondary/70 transition-all select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-brand"
              title="Tap to send tactile presence pulse"
              aria-label="Send resonance pulse to partner"
            >
              <div
                className={`w-14 h-14 rounded-full border border-border-strong flex items-center justify-center bg-surface-charcoal transition-all duration-300 relative shadow-elevation-sm group-hover:border-warm-cream/40 group-hover:scale-105 group-active:scale-95 ${
                  pulseActive ? "border-brand bg-brand/10 shadow-mint-glow scale-110" : ""
                }`}
              >
                <Radio
                  className={`w-5 h-5 transition-colors ${
                    pulseActive ? "text-brand" : "text-soft-stone group-hover:text-warm-cream"
                  }`}
                />
                {pulseActive && (
                  <span className="absolute inset-0 rounded-full border border-brand animate-ping" />
                )}
              </div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-soft-sage mt-2 font-medium group-hover:text-warm-cream transition-colors">
                {pulseActive ? "Pulse Sent" : "Send Pulse"}
              </span>
            </button>
          </div>

          {/* Partner Presence Node or Invitation Slot */}
          {partner ? (
            <div className="flex flex-col items-center gap-2.5 text-center w-32 sm:w-44">
              <div className="relative p-1 rounded-full bg-surface-secondary border border-border-strong shadow-elevation-sm">
                <Avatar
                  name={partner.displayName}
                  colorRole="sage"
                  size="xl"
                  isOnline={isOnline || isInGame || isInCall || isAway}
                  imageUrl={partner.avatarUrl}
                />
                {isInGame && (
                  <span
                    className="absolute -top-1 -right-1 p-1.5 rounded-full bg-warning text-text-on-mint shadow-elevation-sm"
                    title="In game"
                  >
                    <Gamepad2 className="w-3.5 h-3.5" />
                  </span>
                )}
                {isInCall && (
                  <span
                    className="absolute -top-1 -right-1 p-1.5 rounded-full bg-info text-text-on-mint shadow-elevation-sm"
                    title="In call"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </span>
                )}
                {isAway && (
                  <span
                    className="absolute -top-1 -right-1 p-1.5 rounded-full bg-warning/80 text-text-on-mint shadow-elevation-sm"
                    title="Away"
                  >
                    <Moon className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                <span className="font-display text-base sm:text-lg font-medium text-warm-cream block">
                  {partner.displayName}
                </span>
                <p className="text-xs font-mono text-soft-sage">
                  {partner.city} · <span className="font-tabular">{partner.localTime}</span>
                </p>
                {partner.weather ? (
                  <p className="text-[11px] font-mono text-soft-stone/80">
                    {partner.weather}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <Link
              href="/onboarding/invite"
              className="flex flex-col items-center gap-2.5 text-center w-32 sm:w-44 group focus-visible:outline-2 focus-visible:outline-brand rounded-2xl p-2.5"
            >
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-border-strong flex items-center justify-center text-soft-stone bg-surface-charcoal group-hover:border-brand group-hover:text-brand transition-all">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <span className="font-display text-sm font-semibold text-warm-cream group-hover:text-brand transition-colors block">
                  Invite Partner
                </span>
                <p className="text-xs font-mono text-soft-sage">
                  Awaiting link
                </p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* One Clear Primary Action Bar with Generous Breathing Room */}
      <div className="relative z-10 pt-5 border-t border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs sm:text-sm text-soft-stone">
          <span>{statusHeadline}</span>
          <span className="text-soft-sage mx-1.5" aria-hidden="true">·</span>
          <span className="text-warm-cream font-medium">{actionPrompt}</span>
        </div>

        {partner ? (
          <Link
            href={isInGame ? "/play" : isInCall ? "/play" : isOnline ? "/play" : "/moments"}
            className="self-stretch sm:self-auto px-6 py-3 rounded-xl bg-brand text-text-on-mint font-semibold text-sm transition-all hover:bg-brand-hover active:scale-95 shadow-sm inline-flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
          >
            <span>
              {isInGame
                ? "Rejoin Game Session"
                : isInCall
                ? "Join Voice Link"
                : isOnline
                ? "Start Quick Duel"
                : "Leave a Daily Whisper"}
            </span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        ) : (
          <Link
            href="/onboarding/invite"
            className="self-stretch sm:self-auto px-6 py-3 rounded-xl bg-brand text-text-on-mint font-semibold text-sm transition-all hover:bg-brand-hover active:scale-95 shadow-sm inline-flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
          >
            <span>Invite Partner</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
};

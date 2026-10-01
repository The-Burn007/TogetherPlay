"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { ArrowRight, Gamepad2, Phone, UserPlus, Moon, Radio, WifiOff } from "lucide-react";
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
          ? partner.city
            ? `Resonance heartbeat sent to ${partner.displayName} in ${partner.city}`
            : `Resonance heartbeat sent to ${partner.displayName}`
          : "Presence pulse sent into your sanctuary",
        variant: "nudge",
      });
    }
    setTimeout(() => setPulseActive(false), 900);
  };

  // 1. Distinct Semantic Presence States
  const isUnverified =
    partner?.presenceVerified === false || partner?.presenceState === "unverified";
  const isInGame = !isUnverified && partner?.presenceState === "in_game";
  const isInCall = !isUnverified && partner?.presenceState === "in_call";
  const isOnline = !isUnverified && partner?.presenceState === "online";
  const isAway = !isUnverified && partner?.presenceState === "away";
  const isOffline = !isUnverified && (partner?.presenceState === "offline" || !partner?.presenceState);

  return (
    <section className="relative w-full rounded-3xl bg-surface border border-border/80 p-6 sm:p-8 shadow-elevation-md overflow-hidden">
      {/* Ambient Atmospheric Sanctuary Glow */}
      <div className="absolute top-0 right-1/4 w-80 h-48 rounded-full bg-brand/[0.04] blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-72 h-40 rounded-full bg-surface-charcoal/60 blur-2xl pointer-events-none" />

      {/* 1. Header & Quiet Sanctuary Kicker */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pb-5 border-b border-border/60">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-soft-sage font-medium">
            {partner ? "Private Sanctuary for Two" : "Sanctuary · Awaiting Partner"}
          </span>
          <h1 className="font-display text-2xl sm:text-3xl text-warm-cream tracking-tight mt-0.5">
            {greetingText}
          </h1>
        </div>
      </div>

      {/* 2. WHO WE ARE: The Partner Relationship Focal Point */}
      <div className="relative z-10 py-6 sm:py-8 flex flex-col items-center">
        {/* Dynamic Resonance Bridge Filament across distance */}
        <div
          className={`absolute top-1/2 left-20 right-20 -translate-y-1/2 h-[1px] z-0 hidden sm:block transition-opacity duration-500 ${
            !isUnverified && (isOnline || isInGame || isInCall)
              ? "bg-gradient-to-r from-border via-brand/40 to-border opacity-100"
              : "bg-gradient-to-r from-border via-border/40 to-border opacity-40"
          }`}
          aria-hidden="true"
        />

        <div className="w-full flex items-center justify-between gap-4 relative z-10">
          {/* User Node */}
          <div className="flex flex-col items-center gap-2 text-center w-32 sm:w-40">
            <div className="relative transition-transform duration-200 motion-reduce:transition-none hover:scale-105">
              <Avatar
                name={user.displayName}
                colorRole="ember"
                size="xl"
                isOnline={true}
                imageUrl={user.avatarUrl}
              />
            </div>
            <div>
              <span className="font-display text-base sm:text-lg font-semibold text-warm-cream block tracking-tight">
                {user.displayName}
              </span>
              <p className="text-[11px] font-mono text-soft-stone mt-0.5">
                {user.city ? `${user.city}` : "Local"}
                {user.localTime ? ` · ${user.localTime}` : ""}
              </p>
            </div>
          </div>

          {/* Center Tactile Resonance Nexus */}
          <div className="flex flex-col items-center justify-center shrink-0">
            <button
              onClick={handlePulse}
              className="group relative flex flex-col items-center justify-center p-3 rounded-2xl hover:bg-surface-raised transition-all select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-brand"
              title="Tap to send tactile heartbeat pulse"
              aria-label="Send resonance pulse to partner"
            >
              <div
                className={`w-12 h-12 rounded-full border border-border flex items-center justify-center bg-surface-charcoal transition-all duration-300 relative group-hover:border-soft-sage group-hover:scale-105 group-active:scale-95 motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${
                  pulseActive ? "border-brand bg-brand/15 shadow-mint-glow scale-110" : ""
                }`}
              >
                <Radio
                  className={`w-5 h-5 transition-colors ${
                    pulseActive ? "text-brand" : "text-soft-sage group-hover:text-warm-cream"
                  }`}
                  aria-hidden="true"
                />
                {pulseActive && (
                  <span className="absolute inset-0 rounded-full border border-brand animate-ping motion-reduce:animate-none" />
                )}
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-soft-sage mt-2 font-medium group-hover:text-warm-cream transition-colors">
                {pulseActive ? "Pulse Sent" : "Send Pulse"}
              </span>
            </button>
          </div>

          {/* Partner Node or Invitation Slot */}
          {partner ? (
            <div className="flex flex-col items-center gap-2 text-center w-32 sm:w-40">
              <div className="relative transition-transform duration-200 motion-reduce:transition-none hover:scale-105">
                {/* Visual semantics: only pass isOnline=true for pure ONLINE state. Do NOT pass away into isOnline! */}
                <Avatar
                  name={partner.displayName}
                  colorRole="sage"
                  size="xl"
                  isOnline={isOnline}
                  imageUrl={partner.avatarUrl}
                />
                {isInGame && (
                  <span
                    className="absolute -top-1 -right-1 p-1 rounded-full bg-brand text-text-on-mint shadow-elevation-sm"
                    title="In game session"
                    aria-label="In game session"
                    data-testid="partner-in-game-indicator"
                  >
                    <Gamepad2 className="w-3.5 h-3.5" />
                  </span>
                )}
                {isInCall && (
                  <span
                    className="absolute -top-1 -right-1 p-1 rounded-full bg-info text-warm-cream shadow-elevation-sm"
                    title="In call"
                    aria-label="In call"
                    data-testid="partner-in-call-indicator"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </span>
                )}
                {isAway && (
                  <span
                    className="absolute -top-1 -right-1 p-1 rounded-full bg-warning text-warm-cream shadow-elevation-sm"
                    title="Away"
                    aria-label="Away"
                    data-testid="partner-away-indicator"
                  >
                    <Moon className="w-3.5 h-3.5" />
                  </span>
                )}
                {isUnverified && (
                  <span
                    className="absolute -top-1 -right-1 p-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-elevation-sm"
                    title="Presence unverified"
                    aria-label="Presence unverified"
                    data-testid="partner-unverified-indicator"
                  >
                    <WifiOff className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
              <div>
                <span className="font-display text-base sm:text-lg font-semibold text-warm-cream block tracking-tight">
                  {partner.displayName}
                </span>
                <p className="text-[11px] font-mono text-soft-stone mt-0.5">
                  {partner.city ? `${partner.city}` : "Partner"}
                  {partner.localTime ? ` · ${partner.localTime}` : ""}
                </p>
              </div>
            </div>
          ) : (
            <Link
              href="/onboarding/invite"
              className="flex flex-col items-center gap-2 text-center w-32 sm:w-40 group focus-visible:outline-2 focus-visible:outline-brand rounded-2xl p-2 transition-colors hover:bg-surface-raised"
            >
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-border-strong flex items-center justify-center text-soft-stone bg-surface-charcoal group-hover:border-brand group-hover:text-brand transition-all">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <span className="font-display text-base sm:text-lg font-semibold text-brand block tracking-tight">
                  Invite Partner
                </span>
                <p className="text-[11px] font-mono text-soft-stone mt-0.5">
                  Share private link
                </p>
              </div>
            </Link>
          )}
        </div>

        {/* 3. ARE WE CONNECTED? Specific semantic states prioritized before generic online state */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs sm:text-sm font-sans text-center">
          {isUnverified ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-200 font-medium">
              <WifiOff className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>Live presence unverified · Sync paused</span>
            </div>
          ) : isInGame ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-warm-cream font-medium">
              <Gamepad2 className="w-3.5 h-3.5 text-brand" />
              <span>{partner?.displayName || "Partner"} is in a tabletop session</span>
            </div>
          ) : isInCall ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-info/10 border border-info/20 text-warm-cream font-medium">
              <Phone className="w-3.5 h-3.5 text-info" />
              <span>Voice connection active with {partner?.displayName || "Partner"}</span>
            </div>
          ) : isOnline ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-warm-cream font-medium">
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse motion-reduce:animate-none" />
              <span>{partner?.displayName || "Partner"} is here in your sanctuary</span>
            </div>
          ) : isAway ? (
            <div className="inline-flex items-center gap-2 text-soft-stone">
              <Moon className="w-3.5 h-3.5 text-warning" />
              <span>{partner?.displayName || "Partner"} is away</span>
            </div>
          ) : isOffline ? (
            <div className="inline-flex items-center gap-2 text-soft-stone">
              <span className="w-2 h-2 rounded-full bg-soft-sage/40" />
              <span>
                {partner?.displayName || "Partner"} is offline
                {partner?.lastActiveAgo ? ` · Last active ${partner.lastActiveAgo}` : ""}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 text-soft-stone">
              <span className="w-2 h-2 rounded-full bg-brand/60" />
              <span>Your sanctuary space is ready for two</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. WHAT CAN WE DO TOGETHER? One Clear Primary Action */}
      <div className="relative z-10 pt-5 border-t border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-soft-stone">
          <span className="font-medium text-warm-cream">{statusHeadline}</span>
          {actionPrompt ? <span className="text-soft-sage"> · {actionPrompt}</span> : null}
        </div>

        {partner ? (
          <Link
            href={
              isUnverified
                ? "/moments"
                : isInGame
                ? "/play"
                : isInCall
                ? "/play"
                : isOnline
                ? "/play"
                : "/moments"
            }
            className={
              !isUnverified && (isOnline || isInGame || isInCall)
                ? "self-start sm:self-auto px-5 py-2.5 rounded-xl bg-brand text-text-on-mint font-semibold text-xs transition-all hover:bg-brand-hover active:scale-95 shadow-sm inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
                : "self-start sm:self-auto px-5 py-2.5 rounded-xl bg-surface-charcoal border border-border-strong text-warm-cream hover:bg-surface-raised font-semibold text-xs transition-all active:scale-95 inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
            }
          >
            <span>
              {isUnverified
                ? `Leave a Whisper for ${partner.displayName}`
                : isInGame
                ? "Rejoin Game Session"
                : isInCall
                ? "Join Voice Link"
                : isOnline
                ? `Play with ${partner.displayName}`
                : `Leave a Whisper for ${partner.displayName}`}
            </span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <Link
            href="/onboarding/invite"
            className="self-start sm:self-auto px-5 py-2.5 rounded-xl bg-brand text-text-on-mint font-semibold text-xs transition-all hover:bg-brand-hover active:scale-95 shadow-sm inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
          >
            <span>Share Invitation Link</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>

      {/* 5. SECONDARY INFORMATION: Visually Subordinated Single-Line Telemetry */}
      {(user.weather || partner?.weather) && (
        <div className="relative z-10 mt-3 pt-3 border-t border-border/40 text-[11px] font-mono text-soft-sage/75 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {user.weather ? <span>{user.city ? `${user.city}: ` : ""}{user.weather}</span> : null}
          {user.weather && partner?.weather ? <span aria-hidden="true">·</span> : null}
          {partner?.weather ? <span>{partner.city ? `${partner.city}: ` : ""}{partner.weather}</span> : null}
        </div>
      )}
    </section>
  );
};

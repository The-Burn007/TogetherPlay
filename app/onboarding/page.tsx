"use client";

import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  Heart,
  Sparkles,
  ArrowRight,
  KeyRound,
  ShieldCheck,
  Radio,
} from "lucide-react";

export default function OnboardingWelcomePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 text-center animate-fade-in">
      {/* 1. Ritual Emblem Header */}
      <div className="flex flex-col items-center space-y-3">
        {/* Interlocking Heart Orbs */}
        <div className="relative flex items-center justify-center py-2">
          {/* Ambient Glow Aura */}
          <div className="absolute w-28 h-28 rounded-full bg-shared-amber/10 blur-2xl -z-10 pointer-events-none" />

          <div className="relative flex items-center -space-x-3">
            {/* Player One Ember Ring */}
            <div className="w-14 h-14 rounded-full bg-surface-raised border-2 border-player-one-ember/60 flex items-center justify-center shadow-lg shadow-player-one-ember/15">
              <span className="w-4 h-4 rounded-full bg-player-one-ember animate-pulse" />
            </div>

            {/* Golden Heart Core */}
            <div className="z-10 w-10 h-10 rounded-full bg-surface-deep border border-shared-amber/60 flex items-center justify-center text-shared-amber shadow-inner">
              <Heart className="w-5 h-5 fill-current" />
            </div>

            {/* Player Two Sage Ring */}
            <div className="w-14 h-14 rounded-full bg-surface-raised border-2 border-player-two-sage/60 flex items-center justify-center shadow-lg shadow-player-two-sage/15">
              <span className="w-4 h-4 rounded-full bg-player-two-sage animate-pulse" />
            </div>
          </div>
        </div>

        {/* Identity & Status */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-raised border border-subtle-border text-[11px] font-mono text-on-surface-variant">
          <Sparkles className="w-3 h-3 text-shared-amber" />
          <span>TogetherPlay Couple Sanctuary</span>
        </div>

        {/* Headline & Subtitle */}
        <div className="space-y-2 px-2 max-w-md mx-auto">
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-on-surface tracking-tight leading-tight">
            You and your person are creating your own space.
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
            A private sanctuary built for two. Share real-time presence, intimate
            games, daily whispers, and memories across any time zone.
          </p>
        </div>
      </div>

      {/* 2. Onboarding Path Selection Cards */}
      <div className="space-y-3.5 pt-2 text-left">
        {/* Path A: Create Couple (Primary) */}
        <Link href="/onboarding/create-couple" className="block group">
          <Card
            variant="raised"
            className="p-5 border-shared-amber/40 hover:border-shared-amber transition-all bg-gradient-to-r from-surface-raised via-surface-raised to-shared-amber/5 relative overflow-hidden cursor-pointer"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="amber">Recommended</Badge>
                  <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">
                    Step 1 of 3
                  </span>
                </div>
                <h2 className="text-base font-semibold text-on-surface group-hover:text-shared-amber transition-colors flex items-center gap-1.5">
                  <span>Start Our Couple Space</span>
                  <ArrowRight className="w-4 h-4 text-shared-amber group-hover:translate-x-1 transition-transform" />
                </h2>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Dedicate a brand-new space for you and your partner, then receive
                  a private invite code to send them.
                </p>
              </div>
            </div>
          </Card>
        </Link>

        {/* Path B: Join Existing Couple with Code */}
        <Link href="/onboarding/invite" className="block group">
          <Card
            variant="raised"
            className="p-5 border-subtle-border hover:border-player-two-sage/50 transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">Pairing Code</Badge>
                  <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">
                    Join Space
                  </span>
                </div>
                <h2 className="text-base font-semibold text-on-surface group-hover:text-player-two-sage transition-colors flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-player-two-sage" />
                  <span>I Have an Invitation Code</span>
                  <ArrowRight className="w-4 h-4 text-on-surface-variant group-hover:translate-x-1 transition-transform" />
                </h2>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Your partner already created your sanctuary? Enter their private
                  pairing code or link to step right in.
                </p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* 3. Sanctuary Privacy Guarantee & User Info */}
      <footer className="pt-4 border-t border-subtle-border space-y-3">
        <div className="flex items-center justify-center gap-4 text-[11px] text-on-surface-variant font-mono">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-player-two-sage" />
            <span>Strict 2-Person Limit</span>
          </div>
          <span className="text-subtle-border">·</span>
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-shared-amber" />
            <span>Encrypted Room Feeds</span>
          </div>
        </div>

        {user && (
          <p className="text-[10px] text-on-surface-variant font-mono">
            Signed in as{" "}
            <span className="text-on-surface font-semibold">
              {user.displayName || user.email}
            </span>
          </p>
        )}
      </footer>
    </div>
  );
}

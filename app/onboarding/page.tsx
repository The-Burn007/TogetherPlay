"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { motion } from "motion/react";
import {
  Heart,
  ArrowRight,
  KeyRound,
  ShieldCheck,
  Radio,
} from "lucide-react";

export default function OnboardingWelcomePage() {
  const { user } = useAuth();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 text-center max-w-lg mx-auto py-6 sm:py-10"
    >
      {/* 1. Ritual Emblem Header */}
      <div className="flex flex-col items-center space-y-4">
        {/* Interlocking Presence Nodes */}
        <div className="relative flex items-center justify-center py-2">
          {/* Subtle Ambient Mint Glow */}
          <div className="absolute w-32 h-32 rounded-full bg-brand/10 blur-3xl -z-10 pointer-events-none" />

          <div className="relative flex items-center -space-x-3">
            {/* Player One Ember Ring */}
            <div className="w-14 h-14 rounded-full bg-surface border-2 border-player-one-ember/70 flex items-center justify-center shadow-lg shadow-player-one-ember/20">
              <span className="w-4 h-4 rounded-full bg-player-one-ember animate-pulse" />
            </div>

            {/* Core Heart */}
            <div className="z-10 w-10 h-10 rounded-full bg-background-canvas border border-border flex items-center justify-center text-brand shadow-inner">
              <Heart className="w-5 h-5 fill-current" />
            </div>

            {/* Player Two Sage Ring */}
            <div className="w-14 h-14 rounded-full bg-surface border-2 border-player-two-sage/70 flex items-center justify-center shadow-lg shadow-player-two-sage/20">
              <span className="w-4 h-4 rounded-full bg-player-two-sage animate-pulse" />
            </div>
          </div>
        </div>

        {/* Identity & Status */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-[11px] font-mono text-brand">
          <span className="w-1.5 h-1.5 rounded-full bg-brand" />
          <span>TogetherPlay Sanctuary</span>
        </div>

        {/* Headline & Subtitle */}
        <div className="space-y-2 px-2 max-w-md mx-auto">
          <h1 className="text-2xl sm:text-3xl font-display font-medium text-text-primary tracking-tight leading-tight">
            You and your person are creating your own space.
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            A private sanctuary built for two. Share real-time presence, intimate
            games, daily whispers, and memories across any time zone.
          </p>
        </div>
      </div>

      {/* 2. Onboarding Path Selection Cards */}
      <div className="space-y-3.5 pt-2 text-left">
        {/* Path A: Create Couple (Primary) */}
        <Link href="/onboarding/create-couple" className="block group">
          <div className="p-5 rounded-2xl bg-surface border border-border hover:border-brand/60 transition-all shadow-elevation-sm hover:shadow-elevation-md relative overflow-hidden cursor-pointer">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="brand">Recommended</Badge>
                  <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                    Step 1 of 3
                  </span>
                </div>
                <h2 className="text-base font-display font-medium text-text-primary group-hover:text-brand transition-colors flex items-center gap-1.5">
                  <span>Start Our Couple Space</span>
                  <ArrowRight className="w-4 h-4 text-brand group-hover:translate-x-1 transition-transform" />
                </h2>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Dedicate a brand-new space for you and your partner, then receive
                  a private invite code to send them.
                </p>
              </div>
            </div>
          </div>
        </Link>

        {/* Path B: Join Existing Couple with Code */}
        <Link href="/onboarding/invite" className="block group">
          <div className="p-5 rounded-2xl bg-surface border border-border hover:border-player-two-sage/60 transition-all shadow-elevation-sm hover:shadow-elevation-md cursor-pointer">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">Pairing Code</Badge>
                  <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                    Join Space
                  </span>
                </div>
                <h2 className="text-base font-display font-medium text-text-primary group-hover:text-player-two-sage transition-colors flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-player-two-sage" />
                  <span>I Have an Invitation Code</span>
                  <ArrowRight className="w-4 h-4 text-text-muted group-hover:translate-x-1 transition-transform" />
                </h2>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Your partner already created your sanctuary? Enter their private
                  pairing code or link to step right in.
                </p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* 3. Sanctuary Privacy Guarantee & User Info */}
      <footer className="pt-4 border-t border-border space-y-3">
        <div className="flex items-center justify-center gap-4 text-[11px] text-text-muted font-mono">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-player-two-sage" />
            <span>Strict 2-Person Limit</span>
          </div>
          <span className="text-border">·</span>
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-brand" />
            <span>Encrypted Room Feeds</span>
          </div>
        </div>

        {user && (
          <p className="text-[10px] text-text-muted font-mono">
            Signed in as{" "}
            <span className="text-text-primary font-semibold">
              {user.displayName || user.email}
            </span>
          </p>
        )}
      </footer>
    </motion.div>
  );
}

"use client";

import React, { useState } from "react";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import {
  Heart,
  Flame,
  Globe,
  ShieldCheck,
  Radio,
  Sparkles,
  Database,
  Bell,
  CheckCircle2,
  Sliders,
  Moon,
  Gamepad2,
  Phone,
  Wifi,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { usePresence } from "@/lib/presence/usePresence";
import { PartnerPresenceBadge } from "@/components/ui/PartnerPresenceBadge";
import { PresenceIndicator } from "@/components/ui/PresenceIndicator";
import type { PresenceState } from "@/lib/presence/types";

export default function ProfilePage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const {
    myState,
    partnerState,
    partnerDisplayName,
    partnerCity,
    partnerActivity,
    partnerConnection,
    setMyState,
    setSimulatedPartnerState,
  } = usePresence();
  const [viewState, setViewState] = useState<"normal" | "loading" | "empty">("normal");
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [wakeChimes, setWakeChimes] = useState(true);

  return (
    <Container size="sm" className="space-y-6">
      {/* 1. Profile Header */}
      <header className="flex flex-col space-y-1">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="uppercase tracking-widest text-shared-amber font-semibold">
            Couple Sanctuary
          </span>
          <div className="flex items-center gap-1 bg-surface-raised border border-subtle-border rounded-full p-0.5 text-[10px] font-mono">
            <button
              onClick={() => setViewState("normal")}
              className={`px-2 py-0.5 rounded-full transition-all ${
                viewState === "normal"
                  ? "bg-surface-overlay text-shared-amber font-semibold"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Sanctuary
            </button>
            <button
              onClick={() => setViewState("loading")}
              className={`px-2 py-0.5 rounded-full transition-all ${
                viewState === "loading"
                  ? "bg-surface-overlay text-shared-amber font-semibold"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Loading
            </button>
            <button
              onClick={() => setViewState("empty")}
              className={`px-2 py-0.5 rounded-full transition-all ${
                viewState === "empty"
                  ? "bg-surface-overlay text-shared-amber font-semibold"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Empty
            </button>
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-on-surface tracking-tight">
          Alex &amp; Sam
        </h1>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          TogetherPlay space established October 2024 · London &amp; Tokyo.
        </p>
      </header>

      {/* Loading State */}
      {viewState === "loading" && (
        <div className="space-y-4 py-4">
          <CardSkeleton />
          <div className="p-8 flex flex-col items-center justify-center">
            <LoadingSpinner size="md" label="Loading couple profile telemetry..." />
          </div>
          <CardSkeleton />
        </div>
      )}

      {/* Empty State */}
      {viewState === "empty" && (
        <EmptyState
          title="Sanctuary Profile Unpaired"
          description="Your profile is not yet linked to a partner. Enter your partner's invite code or send an invite link to establish your shared room."
          actionLabel="Reconnect with Sam"
          onAction={() => setViewState("normal")}
        />
      )}

      {/* Normal State */}
      {viewState === "normal" && (
        <>
          {/* 2. Dual Avatar Interlock Card */}
          <Card variant="raised" className="p-5 flex flex-col space-y-4">
            <div className="flex items-center justify-around py-2">
              {/* Authenticated User / Player One */}
              <div className="flex flex-col items-center gap-2">
                <Avatar
                  name={user?.displayName || "Alex"}
                  colorRole="ember"
                  size="lg"
                  isOnline={true}
                  imageUrl={user?.photoURL || "https://picsum.photos/seed/alex-profile-london/200/200"}
                />
                <div className="text-center">
                  <span className="text-sm font-semibold text-on-surface">
                    {user?.displayName || "Alex"}
                  </span>
                  <p className="text-[10px] font-mono text-player-one-ember">
                    {user?.email || "London · 23:24 (GMT)"}
                  </p>
                </div>
              </div>

              {/* Golden Cord Interlock */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-surface-deep border border-shared-amber/40 flex items-center justify-center text-shared-amber shadow-inner">
                  <Heart className="w-5 h-5 fill-current" />
                </div>
                <span className="text-[9px] font-mono text-shared-amber uppercase font-semibold">
                  42 Days
                </span>
              </div>

              {/* Sam */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <Avatar
                    name={partnerDisplayName || "Sam"}
                    colorRole="sage"
                    size="lg"
                    isOnline={partnerState !== "offline"}
                    imageUrl="https://picsum.photos/seed/sam-profile-tokyo/200/200"
                  />
                  {partnerState === "in_game" && (
                    <span className="absolute -top-1 -right-1 p-1 rounded-full bg-shared-amber text-surface-deep shadow-md">
                      <Gamepad2 className="w-3 h-3" />
                    </span>
                  )}
                  {partnerState === "in_call" && (
                    <span className="absolute -top-1 -right-1 p-1 rounded-full bg-cyan-500 text-surface-deep shadow-md">
                      <Phone className="w-3 h-3" />
                    </span>
                  )}
                  {partnerState === "away" && (
                    <span className="absolute -top-1 -right-1 p-1 rounded-full bg-amber-400 text-surface-deep shadow-md">
                      <Moon className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <div className="text-center">
                  <span className="text-sm font-semibold text-on-surface">
                    {partnerDisplayName || "Sam"}
                  </span>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <PresenceIndicator state={partnerState} size="sm" />
                    <span className="text-[10px] font-mono capitalize text-on-surface-variant">
                      {partnerState.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Meridian Telemetry Details */}
            <div className="bg-surface-deep border border-subtle-border rounded-lg p-3 grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant">Time Offset</span>
                <span className="text-on-surface font-semibold mt-0.5">+8 Hours</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant">Distance</span>
                <span className="text-on-surface font-semibold mt-0.5">9,560 km</span>
              </div>
            </div>
          </Card>

          {/* Real-time Ephemeral Presence Card */}
          <PartnerPresenceBadge
            partnerName={partnerDisplayName}
            partnerCity={partnerCity}
            state={partnerState}
            activity={partnerActivity}
            connectionStatus={partnerConnection}
            variant="card"
          />

          {/* Your Presence Controls */}
          <Card variant="raised" className="p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-subtle-border pb-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-shared-amber" />
                <span className="text-xs font-semibold text-on-surface">
                  Your Sanctuary Presence
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-player-one-ember">
                <PresenceIndicator state={myState} size="sm" />
                <span className="capitalize">{myState.replace("_", " ")}</span>
              </div>
            </div>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Broadcast your real-time state to your partner across the secure RTDB socket. No precise GPS is stored or transmitted.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 pt-1">
              {(
                [
                  { state: "online", label: "Online", desc: "Browsing" },
                  { state: "in_game", label: "In Game", desc: "Playing" },
                  { state: "in_call", label: "In Call", desc: "Voice" },
                  { state: "away", label: "Away", desc: "Stepped out" },
                  { state: "offline", label: "Offline", desc: "Disconnected" },
                ] as const
              ).map((item) => (
                <button
                  key={item.state}
                  onClick={() => {
                    setMyState(item.state as PresenceState, item.desc);
                    showToast({
                      message: `Your presence updated to ${item.label}`,
                      variant: "info",
                    });
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                    myState === item.state
                      ? "bg-surface-overlay border-shared-amber text-shared-amber font-semibold shadow-sm"
                      : "bg-surface-deep border-subtle-border/60 text-on-surface-variant hover:text-on-surface hover:border-subtle-border"
                  }`}
                >
                  <PresenceIndicator state={item.state as PresenceState} size="sm" />
                  <span className="text-[11px] mt-1 font-mono">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Simulation trigger for partner presence testing */}
            <div className="pt-2 border-t border-subtle-border/50 flex items-center justify-between">
              <span className="text-[10px] font-mono text-on-surface-variant">
                Simulate Partner State:
              </span>
              <div className="flex items-center gap-1">
                {(["online", "in_game", "in_call", "away", "offline"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setSimulatedPartnerState(st);
                      showToast({
                        message: `Partner presence simulated as ${st}`,
                        variant: "info",
                      });
                    }}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase transition-colors ${
                      partnerState === st
                        ? "bg-player-two-sage/20 border border-player-two-sage text-player-two-sage font-bold"
                        : "bg-surface-deep border border-subtle-border text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {st.slice(0, 4)}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* 3. Foundation Architecture & Services Verification */}
          <Card variant="raised" className="p-5 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-shared-amber" />
                <span className="text-xs font-semibold text-on-surface">
                  Architecture &amp; Services Foundation
                </span>
              </div>
              <Badge variant="amber" size="sm">
                Modular Ready
              </Badge>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              TogetherPlay separation of concerns: UI, Firebase Services, Game Engine, WebRTC, and AI are strictly decoupled.
            </p>

            <div className="flex flex-col space-y-2 pt-1 font-mono text-xs">
              <div className="flex items-center justify-between p-2.5 rounded bg-surface-deep border border-subtle-border">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-player-one-ember" />
                  <span className="text-on-surface">Firebase Client Abstraction</span>
                </div>
                <span className="text-[10px] text-player-two-sage flex items-center gap-1 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Initialized
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded bg-surface-deep border border-subtle-border">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-shared-amber" />
                  <span className="text-on-surface">WebRTC Peer Signaling</span>
                </div>
                <span className="text-[10px] text-player-two-sage flex items-center gap-1 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded bg-surface-deep border border-subtle-border">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-player-two-sage" />
                  <span className="text-on-surface">Gemini AI Host &amp; Sparks</span>
                </div>
                <span className="text-[10px] text-player-two-sage flex items-center gap-1 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Server Contract
                </span>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <Link
                  href="/settings"
                  className="flex-1 flex items-center justify-between p-2.5 rounded bg-surface-overlay hover:bg-surface-raised border border-subtle-border text-on-surface transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-shared-amber" />
                    <span className="font-semibold text-xs">Sanctuary Settings</span>
                  </div>
                  <span className="text-[11px] text-shared-amber">Configure →</span>
                </Link>

                <Link
                  href="/design-system"
                  className="flex-1 flex items-center justify-between p-2.5 rounded bg-surface-overlay hover:bg-surface-raised border border-subtle-border text-on-surface transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-player-two-sage" />
                    <span className="font-semibold text-xs">Design System Specs</span>
                  </div>
                  <span className="text-[11px] text-player-two-sage">View →</span>
                </Link>
              </div>
            </div>
          </Card>

          {/* 4. Sensory & Micro-Haptic Preferences */}
          <Card variant="raised" className="p-5 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-player-one-ember" />
                <span className="text-xs font-semibold text-on-surface">
                  Sensory Feedback
                </span>
              </div>
            </div>

            <div className="flex flex-col space-y-3 pt-1">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-on-surface">
                    Tactile Touch Vibrations
                  </span>
                  <span className="text-[10px] font-mono text-on-surface-variant">
                    Subtle haptic pulses on partner taps
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={hapticsEnabled}
                  onChange={(e) => {
                    setHapticsEnabled(e.target.checked);
                    showToast({
                      message: e.target.checked ? "Haptic pulses enabled" : "Haptics disabled",
                      variant: "info",
                    });
                  }}
                  className="w-4 h-4 accent-shared-amber rounded"
                />
              </label>

              <div className="h-[1px] bg-subtle-border" />

              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-on-surface">
                    Dawn Wake-Up Chimes
                  </span>
                  <span className="text-[10px] font-mono text-on-surface-variant">
                    Soft chime when Sam unlocks your morning time capsule
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={wakeChimes}
                  onChange={(e) => {
                    setWakeChimes(e.target.checked);
                    showToast({
                      message: e.target.checked ? "Dawn chimes active" : "Dawn chimes muted",
                      variant: "info",
                    });
                  }}
                  className="w-4 h-4 accent-shared-amber rounded"
                />
              </label>
            </div>
          </Card>

          {/* Couple Sanctuary & Pairing Portal */}
          <Card variant="raised" className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-player-one-ember" />
                <span className="text-xs font-semibold text-on-surface">
                  Couple Space &amp; Partner Pairing
                </span>
              </div>
              <Badge variant="amber">MVP Active</Badge>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Your room is sealed for two. Manage your secure invitation code or invite
              your partner into TogetherPlay.
            </p>

            <div className="pt-1">
              <Link href="/onboarding/invite" className="block">
                <Button variant="outline" size="sm" className="w-full justify-center">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-shared-amber" />
                  <span>Open Partner Pairing Sanctuary</span>
                </Button>
              </Link>
            </div>
          </Card>
        </>
      )}
    </Container>
  );
}

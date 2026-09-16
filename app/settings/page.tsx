"use client";

import React, { useState } from "react";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Sliders,
  Bell,
  Volume2,
  Lock,
  Globe,
  Camera,
  Mic,
  Shield,
  Radio,
  CheckCircle2,
  Sparkles,
  Smartphone,
  Eye,
  KeyRound,
  LogOut,
  User,
  Gamepad2,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useNotifications } from "@/lib/presence/useNotifications";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { settings: notifSettings, updateSettings } = useNotifications();
  const [viewState, setViewState] = useState<"normal" | "loading" | "empty">("normal");
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      showToast({
        message: "Successfully signed out of sanctuary session.",
        variant: "info",
      });
      router.replace("/login");
    } catch {
      showToast({
        message: "Sign out failed.",
        variant: "error",
      });
      setIsSigningOut(false);
    }
  };

  // State toggles
  const [haptics, setHaptics] = useState(true);
  const [wakeChimes, setWakeChimes] = useState(true);
  const [lowLatencyAudio, setLowLatencyAudio] = useState(true);
  const [dualCameraSync, setDualCameraSync] = useState(true);
  const [roomKey, setRoomKey] = useState("TP-4209-LON-TYO-SECURE");

  const handleSave = () => {
    showToast({
      message: "Room preferences updated & synced with Sam's terminal",
      variant: "success",
    });
  };

  const handleRegenerateKey = () => {
    const newKey = `TP-${Math.floor(1000 + Math.random() * 9000)}-LON-TYO`;
    setRoomKey(newKey);
    showToast({
      message: "New end-to-end sanctuary key generated",
      variant: "info",
    });
  };

  return (
    <Container size="sm" className="space-y-6">
      {/* 1. Header & Dev State Switcher */}
      <header className="flex flex-col space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="uppercase tracking-widest text-shared-amber font-semibold">
            Couple Settings
          </span>
          <div className="flex items-center gap-1 bg-surface-raised border border-subtle-border rounded-full p-0.5">
            <button
              onClick={() => setViewState("normal")}
              className={`px-2 py-0.5 rounded-full transition-all ${
                viewState === "normal"
                  ? "bg-surface-overlay text-shared-amber font-semibold"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Active
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
          Sanctuary Settings
        </h1>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Configure real-time presence relay, haptic chimes, WebRTC streams, and shared space privacy.
        </p>
      </header>

      {viewState === "loading" && (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <LoadingSpinner size="lg" label="Decrypting sanctuary configurations..." />
        </div>
      )}

      {viewState === "empty" && (
        <EmptyState
          title="No Custom Preferences Saved"
          description="Your private room is currently running on default intimacy parameters. Adjust toggles below to customize your experience."
          actionLabel="Load Recommended Presets"
          onAction={() => setViewState("normal")}
        />
      )}

      {viewState === "normal" && (
        <div className="space-y-4">
          {/* 1. Partner Presence & Real-time Resonance */}
          <Card variant="raised" className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-on-surface border-b border-subtle-border pb-3">
              <Radio className="w-4 h-4 text-player-two-sage" />
              <span>Resonance &amp; Telemetry</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5 max-w-[80%]">
                <span className="text-xs font-medium text-on-surface">
                  Tactile Haptic Pulses
                </span>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Vibrate mobile device when Sam touches the resonance beacon or sends a nudge.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHaptics(!haptics)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  haptics ? "bg-shared-amber" : "bg-surface-overlay"
                }`}
                aria-pressed={haptics}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-surface-deep transition-transform absolute top-1 ${
                    haptics ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-subtle-border/60">
              <div className="space-y-0.5 max-w-[80%]">
                <span className="text-xs font-medium text-on-surface">
                  Morning Wake Chimes
                </span>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Play subtle ambient chord when Sam comes online in Tokyo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWakeChimes(!wakeChimes)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  wakeChimes ? "bg-shared-amber" : "bg-surface-overlay"
                }`}
                aria-pressed={wakeChimes}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-surface-deep transition-transform absolute top-1 ${
                    wakeChimes ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>
          </Card>

          {/* 2. Media, Stream & WebRTC Relay */}
          <Card variant="raised" className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-on-surface border-b border-subtle-border pb-3">
              <Camera className="w-4 h-4 text-player-one-ember" />
              <span>Camera &amp; Audio Relay</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5 max-w-[80%]">
                <span className="text-xs font-medium text-on-surface">
                  Dual Camera Scavenger Sync
                </span>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Hardware-accelerated peer-to-peer WebRTC video feed for games like Find It First.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDualCameraSync(!dualCameraSync)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  dualCameraSync ? "bg-shared-amber" : "bg-surface-overlay"
                }`}
                aria-pressed={dualCameraSync}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-surface-deep transition-transform absolute top-1 ${
                    dualCameraSync ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-subtle-border/60">
              <div className="space-y-0.5 max-w-[80%]">
                <span className="text-xs font-medium text-on-surface">
                  Low-Latency Spatial Audio
                </span>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Opus 48kHz audio codec with echo suppression for simultaneous whisper notes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLowLatencyAudio(!lowLatencyAudio)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  lowLatencyAudio ? "bg-shared-amber" : "bg-surface-overlay"
                }`}
                aria-pressed={lowLatencyAudio}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-surface-deep transition-transform absolute top-1 ${
                    lowLatencyAudio ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>
          </Card>

          {/* 3. Notification Settings (Game Activity, Challenges, Daily Moments) */}
          <Card variant="raised" className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-subtle-border pb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                <Bell className="w-4 h-4 text-shared-amber" />
                <span>Partner Notification Channels</span>
              </div>
              <Badge variant="sage" size="sm">
                Real-time Sync
              </Badge>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Tailor the gentle alerts you receive when your partner interacts with your sanctuary across distances.
            </p>

            {/* A. Game Activity */}
            <div className="flex items-center justify-between pt-1">
              <div className="space-y-0.5 max-w-[80%]">
                <div className="flex items-center gap-1.5">
                  <Gamepad2 className="w-3.5 h-3.5 text-shared-amber" />
                  <span className="text-xs font-medium text-on-surface">
                    Game Activity
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Alerts when partner invites you to a match, starts a new game, or requests a rematch.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !notifSettings.gameActivity;
                  updateSettings({ gameActivity: nextVal });
                  showToast({
                    message: `Game activity notifications ${nextVal ? "enabled" : "muted"}`,
                    variant: "info",
                  });
                }}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  notifSettings.gameActivity ? "bg-shared-amber" : "bg-surface-overlay"
                }`}
                aria-pressed={notifSettings.gameActivity}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-surface-deep transition-transform absolute top-1 ${
                    notifSettings.gameActivity ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            {/* B. Challenges */}
            <div className="flex items-center justify-between pt-2 border-t border-subtle-border/60">
              <div className="space-y-0.5 max-w-[80%]">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-player-one-ember" />
                  <span className="text-xs font-medium text-on-surface">
                    Challenges
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Real-time toasts and drawer alerts when partner sends playful synchronous challenges.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !notifSettings.challenges;
                  updateSettings({ challenges: nextVal });
                  showToast({
                    message: `Challenge notifications ${nextVal ? "enabled" : "muted"}`,
                    variant: "info",
                  });
                }}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  notifSettings.challenges ? "bg-shared-amber" : "bg-surface-overlay"
                }`}
                aria-pressed={notifSettings.challenges}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-surface-deep transition-transform absolute top-1 ${
                    notifSettings.challenges ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            {/* C. Daily Moments */}
            <div className="flex items-center justify-between pt-2 border-t border-subtle-border/60">
              <div className="space-y-0.5 max-w-[80%]">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-player-two-sage" />
                  <span className="text-xs font-medium text-on-surface">
                    Daily Moments
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Shared daily spark prompts, newly archived memory milestones, and partner notes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !notifSettings.dailyMoments;
                  updateSettings({ dailyMoments: nextVal });
                  showToast({
                    message: `Daily moments notifications ${nextVal ? "enabled" : "muted"}`,
                    variant: "info",
                  });
                }}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  notifSettings.dailyMoments ? "bg-shared-amber" : "bg-surface-overlay"
                }`}
                aria-pressed={notifSettings.dailyMoments}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-surface-deep transition-transform absolute top-1 ${
                    notifSettings.dailyMoments ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>
          </Card>

          {/* 4. Sanctuary Encryption & Passkey */}
          <Card variant="raised" className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-on-surface border-b border-subtle-border pb-3">
              <Lock className="w-4 h-4 text-shared-amber" />
              <span>Private Room Security</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-on-surface">
                Shared Room Passkey
              </label>
              <div className="flex items-center gap-2">
                <Input
                  value={roomKey}
                  onChange={(e) => setRoomKey(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button variant="ghost" size="sm" onClick={handleRegenerateKey}>
                  <KeyRound className="w-3.5 h-3.5 mr-1" />
                  Regen
                </Button>
              </div>
              <p className="text-[10px] text-on-surface-variant leading-relaxed font-mono">
                Only devices with this private key can pair and decrypt the live couple feed.
              </p>
            </div>
          </Card>

          {/* 4. Authenticated Account & Session */}
          <Card variant="raised" className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-subtle-border pb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                <User className="w-4 h-4 text-shared-amber" />
                <span>Account &amp; Sanctuary Session</span>
              </div>
              <Badge variant="ember">Authenticated</Badge>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-on-surface">
                  {user?.displayName || "Player One"}
                </span>
                <p className="text-[11px] text-on-surface-variant font-mono">
                  {user?.email || "Signed in with private credentials"}
                </p>
                <p className="text-[10px] text-on-surface-variant/80 font-mono">
                  UID: {user?.uid ? `${user.uid.slice(0, 12)}...` : "—"}
                </p>
              </div>

              <Button
                variant="ember"
                size="sm"
                onClick={handleSignOut}
                isLoading={isSigningOut}
                className="shrink-0"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                <span>Sign Out</span>
              </Button>
            </div>
          </Card>

          {/* Save Button */}
          <div className="pt-2 flex justify-end">
            <Button variant="amber" onClick={handleSave} className="w-full sm:w-auto">
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Save Preferences
            </Button>
          </div>
        </div>
      )}
    </Container>
  );
}

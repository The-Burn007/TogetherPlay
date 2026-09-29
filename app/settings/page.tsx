"use client";

import React, { useState } from "react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { motion } from "motion/react";
import {
  Bell,
  Lock,
  Camera,
  Radio,
  CheckCircle2,
  KeyRound,
  LogOut,
  User,
  Gamepad2,
  Zap,
  Sparkles,
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
    <Container size="sm" className="space-y-6 pb-20">
      {/* 1. Header & Dev State Switcher */}
      <header className="flex flex-col space-y-2 pt-1">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand" />
            <span className="uppercase tracking-widest text-text-muted font-semibold">
              Couple Controls
            </span>
          </div>

          <div className="flex items-center gap-1 bg-surface-raised border border-border rounded-full p-0.5">
            <button
              onClick={() => setViewState("normal")}
              className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                viewState === "normal"
                  ? "bg-brand text-text-on-mint font-semibold"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setViewState("loading")}
              className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                viewState === "loading"
                  ? "bg-brand text-text-on-mint font-semibold"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Loading
            </button>
            <button
              onClick={() => setViewState("empty")}
              className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                viewState === "empty"
                  ? "bg-brand text-text-on-mint font-semibold"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Empty
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-display font-medium text-text-primary tracking-tight">
            Settings &amp; Sanctuary
          </h1>
          <p className="text-xs text-text-secondary leading-relaxed">
            Configure real-time presence relay, haptic chimes, WebRTC streams, and shared space privacy.
          </p>
        </div>
      </header>

      {viewState === "loading" && (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <LoadingSpinner size="lg" label="Decrypting sanctuary configurations..." />
          <p className="text-[11px] font-mono text-text-muted">
            Reading encrypted preference store
          </p>
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
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          {/* 1. Partner Presence & Real-time Resonance */}
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-elevation-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary border-b border-border pb-3">
              <Radio className="w-4 h-4 text-brand" />
              <span>Resonance &amp; Telemetry</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5 max-w-[80%]">
                <span className="text-xs font-medium text-text-primary block">
                  Tactile Haptic Pulses
                </span>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Vibrate mobile device when Sam touches the resonance beacon or sends a nudge.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHaptics(!haptics)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer focus-visible:outline-2 focus-visible:outline-brand ${
                  haptics ? "bg-brand" : "bg-surface-raised border border-border"
                }`}
                aria-pressed={haptics}
                aria-label="Toggle Tactile Haptic Pulses"
              >
                <span
                  className={`block w-4 h-4 rounded-full transition-transform absolute top-1 ${
                    haptics ? "left-7 bg-text-on-mint shadow-sm" : "left-1 bg-text-muted"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
              <div className="space-y-0.5 max-w-[80%]">
                <span className="text-xs font-medium text-text-primary block">
                  Morning Wake Chimes
                </span>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Play subtle ambient chord when Sam comes online in Tokyo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWakeChimes(!wakeChimes)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer focus-visible:outline-2 focus-visible:outline-brand ${
                  wakeChimes ? "bg-brand" : "bg-surface-raised border border-border"
                }`}
                aria-pressed={wakeChimes}
                aria-label="Toggle Morning Wake Chimes"
              >
                <span
                  className={`block w-4 h-4 rounded-full transition-transform absolute top-1 ${
                    wakeChimes ? "left-7 bg-text-on-mint shadow-sm" : "left-1 bg-text-muted"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 2. Media, Stream & WebRTC Relay */}
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-elevation-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary border-b border-border pb-3">
              <Camera className="w-4 h-4 text-player-one-ember" />
              <span>Camera &amp; Audio Relay</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5 max-w-[80%]">
                <span className="text-xs font-medium text-text-primary block">
                  Dual Camera Scavenger Sync
                </span>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Hardware-accelerated peer-to-peer WebRTC video feed for games like Find It First.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDualCameraSync(!dualCameraSync)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer focus-visible:outline-2 focus-visible:outline-brand ${
                  dualCameraSync ? "bg-brand" : "bg-surface-raised border border-border"
                }`}
                aria-pressed={dualCameraSync}
                aria-label="Toggle Dual Camera Scavenger Sync"
              >
                <span
                  className={`block w-4 h-4 rounded-full transition-transform absolute top-1 ${
                    dualCameraSync ? "left-7 bg-text-on-mint shadow-sm" : "left-1 bg-text-muted"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
              <div className="space-y-0.5 max-w-[80%]">
                <span className="text-xs font-medium text-text-primary block">
                  Low-Latency Spatial Audio
                </span>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Opus 48kHz audio codec with echo suppression for simultaneous whisper notes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLowLatencyAudio(!lowLatencyAudio)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer focus-visible:outline-2 focus-visible:outline-brand ${
                  lowLatencyAudio ? "bg-brand" : "bg-surface-raised border border-border"
                }`}
                aria-pressed={lowLatencyAudio}
                aria-label="Toggle Low-Latency Spatial Audio"
              >
                <span
                  className={`block w-4 h-4 rounded-full transition-transform absolute top-1 ${
                    lowLatencyAudio ? "left-7 bg-text-on-mint shadow-sm" : "left-1 bg-text-muted"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 3. Notification Settings (Game Activity, Challenges, Daily Moments) */}
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-elevation-sm">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Bell className="w-4 h-4 text-brand" />
                <span>Partner Notification Channels</span>
              </div>
              <Badge variant="brand" size="sm">
                Real-time Sync
              </Badge>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Tailor the gentle alerts you receive when your partner interacts with your sanctuary across distances.
            </p>

            {/* A. Game Activity */}
            <div className="flex items-center justify-between pt-1">
              <div className="space-y-0.5 max-w-[80%]">
                <div className="flex items-center gap-1.5">
                  <Gamepad2 className="w-3.5 h-3.5 text-brand" />
                  <span className="text-xs font-medium text-text-primary">
                    Game Activity
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
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
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer focus-visible:outline-2 focus-visible:outline-brand ${
                  notifSettings.gameActivity ? "bg-brand" : "bg-surface-raised border border-border"
                }`}
                aria-pressed={notifSettings.gameActivity}
                aria-label="Toggle Game Activity Notifications"
              >
                <span
                  className={`block w-4 h-4 rounded-full transition-transform absolute top-1 ${
                    notifSettings.gameActivity ? "left-7 bg-text-on-mint shadow-sm" : "left-1 bg-text-muted"
                  }`}
                />
              </button>
            </div>

            {/* B. Challenges */}
            <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
              <div className="space-y-0.5 max-w-[80%]">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-player-one-ember" />
                  <span className="text-xs font-medium text-text-primary">
                    Challenges
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
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
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer focus-visible:outline-2 focus-visible:outline-brand ${
                  notifSettings.challenges ? "bg-brand" : "bg-surface-raised border border-border"
                }`}
                aria-pressed={notifSettings.challenges}
                aria-label="Toggle Challenge Notifications"
              >
                <span
                  className={`block w-4 h-4 rounded-full transition-transform absolute top-1 ${
                    notifSettings.challenges ? "left-7 bg-text-on-mint shadow-sm" : "left-1 bg-text-muted"
                  }`}
                />
              </button>
            </div>

            {/* C. Daily Moments */}
            <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
              <div className="space-y-0.5 max-w-[80%]">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-player-two-sage" />
                  <span className="text-xs font-medium text-text-primary">
                    Daily Moments
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
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
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer focus-visible:outline-2 focus-visible:outline-brand ${
                  notifSettings.dailyMoments ? "bg-brand" : "bg-surface-raised border border-border"
                }`}
                aria-pressed={notifSettings.dailyMoments}
                aria-label="Toggle Daily Moments Notifications"
              >
                <span
                  className={`block w-4 h-4 rounded-full transition-transform absolute top-1 ${
                    notifSettings.dailyMoments ? "left-7 bg-text-on-mint shadow-sm" : "left-1 bg-text-muted"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 4. Sanctuary Encryption & Passkey */}
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-elevation-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary border-b border-border pb-3">
              <Lock className="w-4 h-4 text-brand" />
              <span>Private Room Security</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-text-primary">
                Shared Room Passkey
              </label>
              <div className="flex items-center gap-2">
                <Input
                  value={roomKey}
                  onChange={(e) => setRoomKey(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button variant="surface" size="sm" onClick={handleRegenerateKey} className="shrink-0">
                  <KeyRound className="w-3.5 h-3.5 mr-1 text-brand" />
                  Regen
                </Button>
              </div>
              <p className="text-[10px] text-text-muted leading-relaxed font-mono">
                Only devices with this private key can pair and decrypt the live couple feed.
              </p>
            </div>
          </div>

          {/* 5. Authenticated Account & Session */}
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-elevation-sm">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <User className="w-4 h-4 text-brand" />
                <span>Account &amp; Sanctuary Session</span>
              </div>
              <Badge variant="brand">Authenticated</Badge>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-text-primary block">
                  {user?.displayName || "Player One"}
                </span>
                <p className="text-[11px] text-text-secondary font-mono">
                  {user?.email || "Signed in with private credentials"}
                </p>
                <p className="text-[10px] text-text-muted font-mono font-tabular">
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
          </div>

          {/* Save Button */}
          <div className="pt-2 flex justify-end">
            <Button variant="brand" size="md" onClick={handleSave} className="w-full sm:w-auto font-semibold">
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Save Preferences
            </Button>
          </div>
        </motion.div>
      )}
    </Container>
  );
}

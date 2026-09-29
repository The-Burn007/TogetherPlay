"use client";

import React, { useState } from "react";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { motion, AnimatePresence } from "motion/react";
import {
  Camera,
  Mic,
  Sparkles,
  Send,
  Eye,
  Radio,
  Clock,
  MapPin,
  Volume2,
  CheckCircle2,
  Lock,
} from "lucide-react";

export default function MomentsPage() {
  const { showToast } = useToast();
  const [viewState, setViewState] = useState<"normal" | "loading" | "empty">("normal");
  const [isRecording, setIsRecording] = useState(false);
  const [photoSnapped, setPhotoSnapped] = useState(false);
  const [doodlePoints, setDoodlePoints] = useState<{ x: number; y: number }[]>([]);
  const [partnerSecretRevealed, setPartnerSecretRevealed] = useState(false);

  const handleSnap = () => {
    setPhotoSnapped(true);
    showToast({
      message: "Photo captured! Synced directly to Sam's moments.",
      variant: "success",
    });
  };

  const handleVoiceRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      showToast({
        message: "Voice whisper sealed & uploaded for Sam's morning wake chime.",
        variant: "success",
      });
    } else {
      setIsRecording(true);
      showToast({
        message: "Recording audio note for Sam...",
        variant: "info",
      });
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    setDoodlePoints((prev) => [...prev.slice(-20), { x, y }]);
    showToast({
      message: "Touch trace transmitted to Sam's screen in Tokyo",
      variant: "nudge",
    });
  };

  return (
    <Container size="sm" className="space-y-6 pb-20">
      {/* 1. Page Header & Atmospheric State Selector */}
      <header className="flex flex-col space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-[11px] font-mono">
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            <span className="uppercase tracking-widest text-text-muted font-semibold">
              Intimate Rituals
            </span>
            <span className="text-border">·</span>
            <span className="text-brand">Live Feed</span>
          </div>

          {/* Test State Selector */}
          <div className="flex items-center gap-1 bg-surface-raised border border-border rounded-full p-0.5 text-[10px] font-mono">
            <button
              onClick={() => setViewState("normal")}
              className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                viewState === "normal"
                  ? "bg-brand text-text-on-mint font-semibold"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Live
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
            Daily Moments
          </h1>
          <p className="text-xs text-text-secondary leading-relaxed">
            Quiet, spontaneous micro-rituals to feel each other&apos;s physical presence across continents.
          </p>
        </div>
      </header>

      {/* Loading State */}
      {viewState === "loading" && (
        <div className="space-y-4 py-6">
          <CardSkeleton />
          <div className="p-10 flex flex-col items-center justify-center space-y-3">
            <LoadingSpinner size="md" label="Buffering London ⇄ Tokyo real-time stream..." />
            <p className="text-[11px] font-mono text-text-muted">
              Synchronizing private couple frequencies
            </p>
          </div>
          <CardSkeleton />
        </div>
      )}

      {/* Empty State */}
      {viewState === "empty" && (
        <EmptyState
          title="No Moments Shared Today"
          description="You and your partner haven't exchanged any camera snaps, voice capsules, or glass touches yet today. Start with today's scavenger prompt."
          actionLabel="Take First Snap"
          onAction={() => setViewState("normal")}
        />
      )}

      {/* Normal Active State */}
      {viewState === "normal" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-5"
        >
          {/* 1. Daily Scavenger Quest (Visual Prompt & Dual Camera) */}
          <div className="rounded-2xl bg-surface border border-border p-5 space-y-4 shadow-elevation-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-surface-raised border border-border flex items-center justify-center text-brand">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-text-primary block">
                    Daily Scavenger Quest
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">
                    Synchronized view
                  </span>
                </div>
              </div>
              <Badge variant="brand" size="sm">
                Expires in 3h
              </Badge>
            </div>

            {/* Prompt Statement */}
            <div className="p-3.5 bg-background-canvas border border-border-subtle rounded-xl text-center">
              <p className="text-sm font-display italic text-text-primary">
                &ldquo;Snap what is sitting next to your coffee or water glass right now.&rdquo;
              </p>
            </div>

            {/* Dual Camera Previews */}
            <div className="grid grid-cols-2 gap-3">
              {/* Alex (You) */}
              <div className="relative aspect-square rounded-xl overflow-hidden bg-[#111A14] border border-player-one-ember/40 flex flex-col items-center justify-center p-3 group">
                {photoSnapped ? (
                  <div className="w-full h-full rounded-lg bg-surface flex flex-col items-center justify-center relative p-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-player-one-ember/20 border border-player-one-ember/40 flex items-center justify-center text-player-one-ember mb-1 shadow-sm">
                      <Camera className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold text-text-primary">Porcelain Mug</span>
                    <span className="text-[10px] font-mono text-text-muted">London Studio · Morning Roast</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-10 h-10 rounded-full bg-surface border border-player-one-ember/30 flex items-center justify-center text-player-one-ember">
                      <Camera className="w-5 h-5 animate-pulse" />
                    </div>
                    <span className="text-[11px] font-mono text-text-muted">
                      Your lens ready
                    </span>
                    <Button variant="brand" size="sm" onClick={handleSnap}>
                      Take Snap
                    </Button>
                  </div>
                )}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-background/90 backdrop-blur-md font-mono text-[9px] uppercase tracking-wider text-player-one-ember font-bold border border-player-one-ember/30">
                  Alex · London
                </div>
                {photoSnapped && (
                  <div className="absolute bottom-2 inset-x-2 bg-background/90 backdrop-blur-md px-2 py-1 rounded-md text-[9px] font-mono text-brand flex items-center justify-center gap-1 border border-border">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Shared with Sam</span>
                  </div>
                )}
              </div>

              {/* Sam */}
              <div className="relative aspect-square rounded-xl overflow-hidden bg-[#111A14] border border-player-two-sage/40 group flex flex-col items-center justify-center p-3">
                <div className="w-full h-full rounded-lg bg-surface flex flex-col items-center justify-center relative p-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-brand/20 border border-brand/40 flex items-center justify-center text-brand mb-1 shadow-sm">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-text-primary">Ceramic Matcha Bowl</span>
                  <span className="text-[10px] font-mono text-text-muted">Tokyo Dusk · Bamboo Whisk</span>
                </div>
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-background/90 backdrop-blur-md font-mono text-[9px] uppercase tracking-wider text-player-two-sage font-bold border border-player-two-sage/30">
                  Sam · Tokyo
                </div>
                <div className="absolute bottom-2 inset-x-2 bg-background/90 backdrop-blur-md px-2 py-1 rounded-md text-[9px] font-mono text-text-secondary truncate border border-border text-center">
                  Matcha bowl &amp; wooden spoon (12m ago)
                </div>
              </div>
            </div>
          </div>

          {/* 2. Interactive Reveal Moment: Unspoken Thought */}
          <div className="rounded-2xl bg-surface border border-border p-5 space-y-3 shadow-elevation-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-surface-raised border border-border flex items-center justify-center text-brand">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-text-primary">
                  Today&apos;s Reveal Moment
                </span>
              </div>
              <span className="text-[10px] font-mono text-text-muted">
                Unspoken thought
              </span>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Sam answered a private prompt before falling asleep in Tokyo. Tap to lift the veil and reveal their note.
            </p>

            <div
              onClick={() => {
                if (!partnerSecretRevealed) {
                  setPartnerSecretRevealed(true);
                  showToast({
                    message: "Revealed Sam's midnight reflection.",
                    variant: "success",
                  });
                }
              }}
              className="relative p-4 rounded-xl bg-background-canvas border border-border-subtle hover:border-brand/40 transition-all cursor-pointer overflow-hidden group select-none"
            >
              <AnimatePresence mode="wait">
                {!partnerSecretRevealed ? (
                  <motion.div
                    key="hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-surface-raised border border-border flex items-center justify-center text-brand group-hover:scale-105 transition-transform">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-xs font-medium text-text-primary block">
                          A quiet thought sealed at 23:42 JST
                        </span>
                        <span className="text-[10px] font-mono text-text-muted">
                          Tap to lift the veil and reveal
                        </span>
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-text-muted group-hover:text-brand transition-colors" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="revealed"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-player-two-sage">
                      <span>Sam · Tokyo Midnight</span>
                      <span>Read just now</span>
                    </div>
                    <p className="text-xs sm:text-sm font-display italic text-text-primary leading-relaxed">
                      &ldquo;Looking out over the rainy Meguro river tonight and counting down the weeks until our reunion. Made sure your morning tea mug is right where you like it.&rdquo;
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 3. Audio Whisper Capsule */}
          <div className="rounded-2xl bg-surface border border-border p-5 space-y-3.5 shadow-elevation-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-surface-raised border border-border flex items-center justify-center text-player-two-sage">
                  <Mic className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-text-primary">
                  Audio Whisper Capsule
                </span>
              </div>
              <span className="text-[10px] font-mono text-text-muted">
                Max 30 seconds
              </span>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Record a fleeting voice snippet. Sam will hear it as their gentle wake chime at 8:00 AM Tokyo time.
            </p>

            <div className="p-4 bg-background-canvas border border-border-subtle rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleVoiceRecord}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    isRecording
                      ? "bg-player-one-ember text-text-primary animate-pulse"
                      : "bg-surface-raised border border-border text-brand hover:scale-105"
                  }`}
                  aria-label="Record Voice Capsule"
                >
                  <Mic className="w-5 h-5" />
                </button>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-text-primary">
                    {isRecording ? "Listening to your voice..." : "Tap mic to speak"}
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">
                    {isRecording ? "00:14 / 00:30" : "Encrypted London-Tokyo relay"}
                  </span>
                </div>
              </div>

              <Button
                variant={isRecording ? "ember" : "brand"}
                size="sm"
                onClick={handleVoiceRecord}
                className="text-xs font-mono"
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                {isRecording ? "Stop & Send" : "Record"}
              </Button>
            </div>
          </div>

          {/* 4. Shared Glass Touch Canvas */}
          <div className="rounded-2xl bg-surface border border-border p-5 space-y-3.5 shadow-elevation-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-surface-raised border border-border flex items-center justify-center text-brand">
                  <Radio className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-text-primary">
                  Shared Glass: Live Touch Trace
                </span>
              </div>
              <span className="text-[10px] font-mono text-brand flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                Both Connected
              </span>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Tap or drag your finger on the glass below. Your warmth radiates on Sam&apos;s display in Tokyo in real time.
            </p>

            <div
              onClick={handleCanvasClick}
              className="w-full h-44 rounded-xl bg-background-canvas border border-dashed border-border flex flex-col items-center justify-center relative overflow-hidden cursor-crosshair select-none"
            >
              {/* Grid texture */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(183,255,114,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(183,255,114,0.05)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

              {/* Rendered touch points */}
              {doodlePoints.map((pt, index) => (
                <div
                  key={index}
                  className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-brand/60 border border-brand animate-ping pointer-events-none"
                  style={{ left: pt.x, top: pt.y }}
                />
              ))}

              <div className="flex flex-col items-center gap-1.5 text-center pointer-events-none z-10">
                <Sparkles className="w-6 h-6 text-brand/70" />
                <span className="text-xs font-mono text-text-primary">
                  Touch the glass
                </span>
                <span className="text-[10px] font-mono text-text-muted">
                  {doodlePoints.length > 0
                    ? `${doodlePoints.length} touch traces shared`
                    : "Waiting for first touch"}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Shared Today Ribbon */}
          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] font-mono text-text-muted">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Today: 3 moments shared</span>
            </span>
            <span className="flex items-center gap-1 text-brand">
              <MapPin className="w-3.5 h-3.5" />
              <span>London ⇄ Tokyo</span>
            </span>
          </div>
        </motion.div>
      )}
    </Container>
  );
}

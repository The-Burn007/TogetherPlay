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
import { Camera, Mic, Sparkles, Send, Lock, PenTool } from "lucide-react";

export default function MomentsPage() {
  const { showToast } = useToast();
  const [viewState, setViewState] = useState<"normal" | "loading" | "empty">("normal");
  const [isRecording, setIsRecording] = useState(false);
  const [photoSnapped, setPhotoSnapped] = useState(false);
  const [doodlePoints, setDoodlePoints] = useState<{ x: number; y: number }[]>([]);

  const handleSnap = () => {
    setPhotoSnapped(true);
    showToast({
      message: "Photo captured! Syncing directly to Sam's moments...",
      variant: "success",
    });
  };

  const handleVoiceRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      showToast({
        message: "Voice capsule sealed & uploaded to London-Tokyo cloud relay!",
        variant: "success",
      });
    } else {
      setIsRecording(true);
      showToast({
        message: "Recording 30-second audio note for Sam's morning...",
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
      message: "Finger trace transmitted to Sam's screen in Tokyo",
      variant: "nudge",
    });
  };

  return (
    <Container size="sm" className="space-y-6">
      {/* 1. Page Header */}
      <header className="flex flex-col space-y-1">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="uppercase tracking-widest text-shared-amber font-semibold">
            Synchronous Intimacy
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
              Live
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
          Real-Time Moments
        </h1>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Spontaneous micro-rituals to feel each other&apos;s physical presence across continents.
        </p>
      </header>

      {/* Loading State */}
      {viewState === "loading" && (
        <div className="space-y-4 py-4">
          <CardSkeleton />
          <div className="p-8 flex flex-col items-center justify-center">
            <LoadingSpinner size="md" label="Buffering London ⇄ Tokyo real-time stream..." />
          </div>
          <CardSkeleton />
        </div>
      )}

      {/* Empty State */}
      {viewState === "empty" && (
        <EmptyState
          title="No Moments Shared Today"
          description="You and Sam haven't exchanged any camera snaps, voice capsules, or glass touches yet today. Start by snapping what's next to you."
          actionLabel="Take Your First Snap"
          onAction={() => setViewState("normal")}
        />
      )}

      {/* Normal State */}
      {viewState === "normal" && (
        <>
          {/* 2. Today's Camera Prompt */}
          <Card variant="raised" className="p-5 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-player-one-ember" />
                <span className="text-xs font-semibold text-on-surface">
                  Daily Scavenger Quest
                </span>
              </div>
              <Badge variant="amber" size="sm">
                Expires in 3h
              </Badge>
            </div>

            <div className="p-3 bg-surface-deep border border-subtle-border rounded-lg text-center">
              <p className="text-sm font-semibold text-canvas-cream">
                &ldquo;Snap what is sitting next to your coffee or water glass right now.&rdquo;
              </p>
            </div>

            {/* Dual Camera Previews */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Alex (You) */}
              <div className="relative aspect-square rounded-lg overflow-hidden bg-surface-deep border border-player-one-ember/40 flex flex-col items-center justify-center p-3">
                {photoSnapped ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="https://picsum.photos/seed/alex-mug-snap/300/300"
                    alt="Alex mug"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Camera className="w-8 h-8 text-player-one-ember animate-pulse" />
                    <span className="text-[11px] font-mono text-on-surface-variant">
                      Your lens ready
                    </span>
                    <Button variant="ember" size="sm" onClick={handleSnap}>
                      Take Snap
                    </Button>
                  </div>
                )}
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-surface-deep/80 font-mono text-[8px] uppercase tracking-wider text-player-one-ember font-bold">
                  Alex · London
                </div>
              </div>

              {/* Sam */}
              <div className="relative aspect-square rounded-lg overflow-hidden bg-surface-deep border border-player-two-sage/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://picsum.photos/seed/sam-mug-snap/300/300"
                  alt="Sam mug in Tokyo"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-surface-deep/80 font-mono text-[8px] uppercase tracking-wider text-player-two-sage font-bold">
                  Sam · Tokyo
                </div>
                <div className="absolute bottom-2 inset-x-2 bg-surface-deep/85 backdrop-blur px-2 py-1 rounded text-[9px] font-mono text-player-two-sage truncate">
                  Matcha bowl &amp; wooden spoon (12m ago)
                </div>
              </div>
            </div>
          </Card>

          {/* 3. Audio Whisper Capsule */}
          <Card variant="raised" className="p-5 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-player-two-sage" />
                <span className="text-xs font-semibold text-on-surface">
                  Audio Whisper Capsule
                </span>
              </div>
              <span className="text-[10px] font-mono text-on-surface-variant">
                Max 30 seconds
              </span>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Record a fleeting voice snippet. Sam will hear it as their gentle wake-up chime at 8:00 AM Tokyo time.
            </p>

            <div className="p-4 bg-surface-deep border border-subtle-border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleVoiceRecord}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    isRecording
                      ? "bg-player-one-ember text-canvas-cream animate-ping"
                      : "bg-surface-raised border border-subtle-border text-shared-amber hover:scale-105"
                  }`}
                  aria-label="Record Voice Capsule"
                >
                  <Mic className="w-5 h-5" />
                </button>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-on-surface">
                    {isRecording ? "Listening to your voice..." : "Tap mic to speak"}
                  </span>
                  <span className="text-[10px] font-mono text-on-surface-variant">
                    {isRecording ? "00:14 / 00:30" : "Encrypted London-Tokyo relay"}
                  </span>
                </div>
              </div>

              <Button
                variant="amber"
                size="sm"
                onClick={handleVoiceRecord}
                className="text-xs font-mono"
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                {isRecording ? "Stop & Send" : "Record"}
              </Button>
            </div>
          </Card>

          {/* 4. Shared Glass Touch Canvas */}
          <Card variant="raised" className="p-5 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-shared-amber" />
                <span className="text-xs font-semibold text-on-surface">
                  Shared Glass: Live Touch Trace
                </span>
              </div>
              <span className="text-[10px] font-mono text-player-two-sage">
                Both Connected
              </span>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Tap or drag your finger on the glass below. Your warmth radiates on Sam&apos;s display in Tokyo in real-time.
            </p>

            <div
              onClick={handleCanvasClick}
              className="w-full h-44 rounded-lg bg-surface-deep border border-dashed border-subtle-border flex flex-col items-center justify-center relative overflow-hidden cursor-crosshair select-none"
            >
              {/* Grid lines */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2824_1px,transparent_1px),linear-gradient(to_bottom,#1f2824_1px,transparent_1px)] bg-[size:24px_24px] opacity-40 pointer-events-none" />

              {/* Rendered touch points */}
              {doodlePoints.map((pt, index) => (
                <div
                  key={index}
                  className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-shared-amber/60 border border-shared-amber animate-ping pointer-events-none"
                  style={{ left: pt.x, top: pt.y }}
                />
              ))}

              <div className="flex flex-col items-center gap-1 text-center pointer-events-none z-10">
                <Sparkles className="w-6 h-6 text-shared-amber/70" />
                <span className="text-xs font-mono text-canvas-sand">
                  Touch the glass
                </span>
                <span className="text-[10px] font-mono text-on-surface-variant">
                  {doodlePoints.length > 0
                    ? `${doodlePoints.length} touch traces shared`
                    : "Waiting for first touch"}
                </span>
              </div>
            </div>
          </Card>
        </>
      )}
    </Container>
  );
}

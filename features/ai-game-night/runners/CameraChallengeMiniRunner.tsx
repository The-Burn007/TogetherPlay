"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Video, Camera, CheckCircle2, Clock, MapPin, Heart, Sparkles } from "lucide-react";
import type { GameNightActivity, GameNightActivityResult } from "@/lib/ai/gameNightTypes";
import { gameNightAudio } from "@/lib/ai/gameNightAudio";

interface CameraChallengeMiniRunnerProps {
  activity: GameNightActivity;
  partnerNames: { p1: string; p2: string };
  partnerCities: { p1: string; p2: string };
  onRoundComplete: (result: GameNightActivityResult) => void;
}

export const CameraChallengeMiniRunner: React.FC<CameraChallengeMiniRunnerProps> = ({
  activity,
  partnerNames,
  partnerCities,
  onRoundComplete,
}) => {
  const p1Name = partnerNames.p1 || "Alex";
  const p2Name = partnerNames.p2 || "Sam";
  const p1City = partnerCities.p1 || "London";
  const p2City = partnerCities.p2 || "Tokyo";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [p1Verified, setP1Verified] = useState(false);
  const [p2Verified, setP2Verified] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);
  const [isCompleted, setIsCompleted] = useState(false);

  // Start client local camera preview if permitted
  useEffect(() => {
    let stream: MediaStream | null = null;
    async function startCam() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setCameraActive(true);
          }
        }
      } catch {
        // Camera permission denied or not available - graceful preview fallback
        setCameraActive(false);
      }
    }
    startCam();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Timer loop
  useEffect(() => {
    if (isCompleted) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleMutualVerification();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isCompleted]);

  const handleMutualVerification = () => {
    if (isCompleted) return;
    setIsCompleted(true);
    setP1Verified(true);
    setP2Verified(true);
    gameNightAudio.playSynchronyLock();

    setTimeout(() => {
      onRoundComplete({
        completedAt: new Date().toISOString(),
        winnerId: null,
        winnerName: null,
        scores: { p1: 100, p2: 100 },
        summary: `Reciprocal camera toast captured across London & Tokyo!`,
        funMoment: `Shared screen toast held for 3 seconds across 9,560 km.`,
      });
    }, 2000);
  };

  const handleP1Check = () => {
    setP1Verified(true);
    gameNightAudio.playTap();
    // Simulate partner confirming shortly after
    setTimeout(() => {
      setP2Verified(true);
      handleMutualVerification();
    }, 800);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Prompt Card */}
      <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-center space-y-2">
        <span className="text-[10px] uppercase font-mono tracking-widest text-amber-500">
          Dual Camera Reciprocal Event
        </span>

        <h3 className="text-lg sm:text-xl font-serif text-neutral-100 max-w-xl mx-auto leading-snug">
          &ldquo;{activity.promptData.prompt}&rdquo;
        </h3>

        <div className="flex items-center justify-center gap-2 pt-1 text-xs font-mono text-neutral-400">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>Portal Window: {timeLeft}s</span>
        </div>
      </div>

      {/* Dual Video Frames */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Partner 1 Portal (Local / London) */}
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 flex flex-col justify-between p-3">
          {cameraActive ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover -scale-x-100"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 space-y-2 bg-gradient-to-b from-neutral-900 to-neutral-950">
              <Camera className="w-8 h-8 text-neutral-600" />
              <span className="text-xs font-mono">Local Live Feed</span>
            </div>
          )}

          {/* Overlay Tag */}
          <div className="relative z-10 flex items-center justify-between text-xs font-mono">
            <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-neutral-200 border border-white/10 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-amber-400" />
              {p1Name} ({p1City})
            </span>
            {p1Verified && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/90 text-neutral-950 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Captured
              </span>
            )}
          </div>
        </div>

        {/* Partner 2 Portal (Remote / Tokyo) */}
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 flex flex-col justify-between p-3">
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 space-y-2 bg-gradient-to-b from-neutral-900 to-neutral-950">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl font-serif text-amber-300">
              {p2Name[0]}
            </div>
            <span className="text-xs font-mono text-neutral-400">
              {p2Name}&apos;s Live Camera Portal
            </span>
          </div>

          {/* Overlay Tag */}
          <div className="relative z-10 flex items-center justify-between text-xs font-mono">
            <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-neutral-200 border border-white/10 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-rose-400" />
              {p2Name} ({p2City})
            </span>
            {p2Verified && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/90 text-neutral-950 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Captured
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action / Confirmation Button */}
      <div className="text-center pt-2">
        <button
          onClick={handleP1Check}
          disabled={isCompleted}
          className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] disabled:opacity-75"
        >
          {isCompleted
            ? "Toast Verified across Timezones ✨"
            : p1Verified
            ? `Waiting for ${p2Name} to confirm...`
            : "Toast Frame Ready — Lock Moment"}
        </button>
      </div>
    </div>
  );
};

"use client";

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, Sparkles, ArrowRight, ShieldCheck, Camera } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface EventSubmitOverlayProps {
  playerNames: { p1: string; p2: string };
  isP1Locked: boolean;
  isP2Locked: boolean;
  onProceedToResult: () => void;
  autoAdvanceSeconds?: number;
}

export const EventSubmitOverlay: React.FC<EventSubmitOverlayProps> = ({
  playerNames,
  isP1Locked,
  isP2Locked,
  onProceedToResult,
  autoAdvanceSeconds = 2.2,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(autoAdvanceSeconds);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, autoAdvanceSeconds - elapsed);
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onProceedToResult();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [autoAdvanceSeconds, onProceedToResult]);

  const progressPercent = Math.min(
    100,
    Math.max(0, ((autoAdvanceSeconds - secondsLeft) / autoAdvanceSeconds) * 100)
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 bg-black/60 backdrop-blur-md select-none"
    >
      <motion.div
        initial={{ scale: 0.9, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: -12, opacity: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative max-w-md w-full bg-neutral-900/95 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.2)] text-center overflow-hidden"
      >
        {/* Shutter Flare Pulse */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/20 blur-3xl rounded-full pointer-events-none" />

        {/* Header Stage Badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-amber-500/10 border border-amber-500/30 text-amber-300 mb-3">
          <Camera className="w-3.5 h-3.5 text-amber-400" />
          <span>STAGE: SUBMISSION</span>
        </div>

        {/* Large Stage Typography */}
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-100 tracking-tight">
          Captures Locked In
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-neutral-300 font-light">
          Synchronizing camera perspectives across London &amp; Tokyo
        </p>

        {/* Dual Player Verification Grid */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          {/* Player 1 Card */}
          <div
            className={`p-3 rounded-2xl border transition-all ${
              isP1Locked
                ? "bg-amber-950/40 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                : "bg-neutral-950/60 border-neutral-800"
            }`}
          >
            <div className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              {playerNames.p1}
            </div>
            <div className="mt-1 flex items-center justify-center space-x-1.5 text-xs font-semibold text-amber-300">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{isP1Locked ? "Captured" : "Submitting..."}</span>
            </div>
          </div>

          {/* Player 2 Card */}
          <div
            className={`p-3 rounded-2xl border transition-all ${
              isP2Locked
                ? "bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                : "bg-neutral-950/60 border-neutral-800"
            }`}
          >
            <div className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              {playerNames.p2}
            </div>
            <div className="mt-1 flex items-center justify-center space-x-1.5 text-xs font-semibold text-emerald-300">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{isP2Locked ? "Captured" : "Submitting..."}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar for Automatic Result Transition */}
        <div className="mt-5 w-full bg-neutral-950 rounded-full h-1.5 overflow-hidden border border-neutral-800">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-400">
          <span className="flex items-center space-x-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Zero storage · Peer stream</span>
          </span>
          <span className="font-mono text-amber-300/80">
            Revealing in {secondsLeft.toFixed(1)}s
          </span>
        </div>

        {/* Instant Advance Action */}
        <div className="mt-4 pt-2 border-t border-neutral-800/80">
          <Button
            id="proceed-to-result-instant-btn"
            variant="amber"
            size="md"
            onClick={onProceedToResult}
            className="w-full shadow-lg shadow-amber-950/30 text-xs font-semibold"
          >
            <span>Reveal Result Now</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

"use client";

import React, { useEffect } from "react";
import { motion } from "motion/react";
import { Sparkles, Trophy, ArrowRight, RotateCcw, ShieldCheck, Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cameraChallengeAudio } from "./cameraChallengeAudio";
import type { CameraChallengePrompt } from "@/types/domain";

interface ChallengeResultModalProps {
  prompt: CameraChallengePrompt;
  currentRound: number;
  maxRounds: number;
  isGameEnd: boolean;
  playerScores: Record<string, number>;
  playerNames: { p1: string; p2: string };
  onNextChallenge: () => void;
  onRematch: () => void;
}

export const ChallengeResultModal: React.FC<ChallengeResultModalProps> = ({
  prompt,
  currentRound,
  maxRounds,
  isGameEnd,
  playerScores,
  playerNames,
  onNextChallenge,
  onRematch,
}) => {
  useEffect(() => {
    cameraChallengeAudio.playCelebration();
  }, []);

  const totalSynergy = Object.values(playerScores).reduce((acc, score) => acc + score, 0);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-lg bg-neutral-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] text-center relative overflow-hidden"
      >
        {/* Subtle Ambient Golden Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-48 bg-amber-500/15 blur-3xl rounded-full pointer-events-none" />

        {/* Header Badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-amber-500/10 border border-amber-500/30 text-amber-300 mb-4">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>{isGameEnd ? "EVENT FINALE REACHED" : `CHALLENGE ${currentRound} COMPLETE`}</span>
        </div>

        {/* Completion Title */}
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-100 tracking-tight">
          {isGameEnd ? "Grand Couple Synergy!" : "Moment Captured in Sync"}
        </h2>

        <p className="mt-2 text-sm text-neutral-300 max-w-md mx-auto leading-relaxed">
          &ldquo;{prompt.title}&rdquo; fulfilled across the screens.
        </p>

        {/* Synergy Score Card */}
        <div className="mt-6 p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-around">
          <div className="flex flex-col items-center">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              {playerNames.p1}
            </span>
            <span className="text-2xl font-serif font-bold text-amber-400 mt-0.5">
              +{playerScores[Object.keys(playerScores)[0]] || 100}
            </span>
          </div>

          <div className="h-8 w-px bg-neutral-800" />

          <div className="flex flex-col items-center">
            <div className="flex items-center space-x-1 text-emerald-400 text-xs font-medium uppercase tracking-wider">
              <Heart className="w-3 h-3 fill-current" />
              <span>Synergy Pool</span>
            </div>
            <span className="text-2xl font-serif font-bold text-emerald-300 mt-0.5">
              {totalSynergy > 0 ? totalSynergy : 200} PTS
            </span>
          </div>

          <div className="h-8 w-px bg-neutral-800" />

          <div className="flex flex-col items-center">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              {playerNames.p2}
            </span>
            <span className="text-2xl font-serif font-bold text-emerald-400 mt-0.5">
              +{playerScores[Object.keys(playerScores)[1]] || 100}
            </span>
          </div>
        </div>

        {/* Zero-Storage Privacy Confirmation */}
        <div className="mt-4 flex items-center justify-center space-x-2 text-[11px] text-neutral-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Privacy Assured: Live peer-to-peer only. Zero video recorded or stored.</span>
        </div>

        {/* Action Controls */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          {isGameEnd ? (
            <Button
              id="rematch-button"
              variant="amber"
              size="lg"
              onClick={onRematch}
              className="w-full sm:w-auto shadow-lg shadow-amber-950/40"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Play Rematch
            </Button>
          ) : (
            <>
              <Button
                id="next-challenge-button"
                variant="amber"
                size="lg"
                onClick={onNextChallenge}
                className="w-full sm:w-auto shadow-lg shadow-amber-950/40"
              >
                <span>Next Challenge</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <Button
                id="modal-rematch-button"
                variant="outline"
                size="lg"
                onClick={onRematch}
                className="w-full sm:w-auto"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                <span>Restart</span>
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

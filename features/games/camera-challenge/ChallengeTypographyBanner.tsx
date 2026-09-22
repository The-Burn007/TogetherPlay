"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Eye, Compass, Heart, Smile, PackageSearch } from "lucide-react";
import type { CameraChallengePrompt } from "@/types/domain";

interface ChallengeTypographyBannerProps {
  prompt: CameraChallengePrompt;
  currentRound: number;
  maxRounds: number;
  stage: "challenge" | "countdown" | "perform" | "submit" | "partner_review" | "result";
}

const CATEGORY_META = {
  scavenger: {
    label: "SCAVENGER HUNT",
    icon: PackageSearch,
    color: "text-amber-400 bg-amber-950/60 border-amber-500/30",
  },
  pose: {
    label: "POSE MIRRORING",
    icon: Eye,
    color: "text-purple-300 bg-purple-950/60 border-purple-500/30",
  },
  expression: {
    label: "EXPRESSION DUEL",
    icon: Smile,
    color: "text-rose-300 bg-rose-950/60 border-rose-500/30",
  },
  memory: {
    label: "MEMORY KEEPSAKE",
    icon: Heart,
    color: "text-pink-300 bg-pink-950/60 border-pink-500/30",
  },
  synchrony: {
    label: "COUPLE SYNCHRONY",
    icon: Compass,
    color: "text-emerald-300 bg-emerald-950/60 border-emerald-500/30",
  },
};

export const ChallengeTypographyBanner: React.FC<ChallengeTypographyBannerProps> = ({
  prompt,
  currentRound,
  maxRounds,
  stage,
}) => {
  const meta = CATEGORY_META[prompt.category] || {
    label: "EVENT PROMPT",
    icon: Sparkles,
    color: "text-amber-400 bg-amber-950/60 border-amber-500/30",
  };
  const CategoryIcon = meta.icon;

  const flowSteps: { key: ChallengeTypographyBannerProps["stage"]; label: string }[] = [
    { key: "challenge", label: "Challenge" },
    { key: "countdown", label: "Countdown" },
    { key: "perform", label: "Perform" },
    { key: "submit", label: "Submit" },
    { key: "partner_review", label: "Review" },
    { key: "result", label: "Result" },
  ];

  return (
    <div className="w-full text-center py-2 px-4 select-none">
      {/* 5-Step Event Flow Tracker */}
      <div className="flex items-center justify-center space-x-1 sm:space-x-2 mb-3">
        {flowSteps.map((step, idx) => {
          const isActive = stage === step.key;
          const isPassed =
            flowSteps.findIndex((s) => s.key === stage) > idx;

          return (
            <React.Fragment key={step.key}>
              <div
                className={`flex items-center space-x-1 px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium tracking-wide uppercase transition-all duration-300 ${
                  isActive
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.25)] font-semibold"
                    : isPassed
                    ? "bg-neutral-900 text-neutral-400 border border-neutral-800"
                    : "text-neutral-600 border border-transparent"
                }`}
              >
                <span className="opacity-60">{idx + 1}.</span>
                <span>{step.label}</span>
              </div>
              {idx < flowSteps.length - 1 && (
                <span className="text-neutral-700 text-xs select-none">→</span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Category & Round Badge */}
      <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full text-xs font-semibold tracking-wider uppercase backdrop-blur-md border border-neutral-800 bg-neutral-950/60 mb-2 shadow-sm">
        <span className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full border text-[11px] ${meta.color}`}>
          <CategoryIcon className="w-3.5 h-3.5" />
          <span>{meta.label}</span>
        </span>
        <span className="text-neutral-400 text-[11px]">
          CHALLENGE {currentRound} OF {maxRounds}
        </span>
      </div>

      {/* Hero Large Challenge Typography */}
      <AnimatePresence mode="wait">
        <motion.div
          key={prompt.id + stage}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="max-w-3xl mx-auto"
        >
          <h1
            id="current-challenge-headline"
            className="text-2xl sm:text-3xl md:text-5xl font-serif font-medium tracking-tight text-neutral-100 drop-shadow-md leading-tight"
          >
            &ldquo;{prompt.title}&rdquo;
          </h1>

          {/* Description & Hint */}
          <p className="mt-2 text-xs sm:text-sm md:text-base text-neutral-300 max-w-xl mx-auto font-light leading-relaxed">
            {prompt.description}
          </p>

          {prompt.hint && (stage === "challenge" || stage === "perform") && (
            <p className="mt-1 text-xs text-amber-300/80 italic font-normal">
              Tip: {prompt.hint}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

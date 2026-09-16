"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  RefreshCw,
  Clock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Video,
  Play,
  Pause,
  RotateCcw,
  Flame,
  Heart,
  HelpCircle,
  MessageSquare,
  Camera,
  Gamepad2,
  Sliders,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/layout/Container";
import { fetchAIChallenge } from "@/lib/ai/aiChallengeClient";
import { getCuratedChallenge } from "@/lib/ai/curatedChallenges";
import type {
  AIChallenge,
  AIChallengeCategory,
  AIChallengeDifficulty,
} from "@/types/domain";

interface TogetherPlayAIChallengeViewProps {
  initialCategory?: AIChallengeCategory;
  partnerNames?: { p1: string; p2: string };
  partnerCities?: { p1: string; p2: string };
}

const CATEGORY_ITEMS: {
  id: AIChallengeCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  {
    id: "relationship_question",
    label: "Questions",
    icon: Heart,
    description: "Insightful prompts into your shared history and subconscious bond.",
  },
  {
    id: "camera_challenge",
    label: "Camera",
    icon: Camera,
    description: "Reciprocal live video scavenger hunts, mimicry, and window skylines.",
  },
  {
    id: "quick_game",
    label: "Quick Games",
    icon: Gamepad2,
    description: "Fast-reaction telepathy and 30-second intuition duels.",
  },
  {
    id: "fun_challenge",
    label: "Fun Challenges",
    icon: Sparkles,
    description: "Playful physical dares, blind sketches, and silent movie drama.",
  },
  {
    id: "conversation_prompt",
    label: "Conversations",
    icon: MessageSquare,
    description: "Grounding topics for quiet evenings across distance.",
  },
];

const DIFFICULTY_LEVELS: {
  id: AIChallengeDifficulty;
  label: string;
  description: string;
}[] = [
  { id: "gentle", label: "Gentle", description: "Warm, low pressure, restorative" },
  { id: "playful", label: "Playful", description: "High energy, laughter, spontaneous" },
  { id: "deep", label: "Deep", description: "Vulnerable, nostalgic, contemplative" },
  { id: "spicy", label: "Spicy", description: "Flirty, daring, adventurous" },
];

export const TogetherPlayAIChallengeView: React.FC<TogetherPlayAIChallengeViewProps> = ({
  initialCategory = "relationship_question",
  partnerNames = { p1: "Alex", p2: "Sam" },
  partnerCities = { p1: "London", p2: "Tokyo" },
}) => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [selectedCategory, setSelectedCategory] =
    useState<AIChallengeCategory>(initialCategory);
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<AIChallengeDifficulty>("playful");
  const [topicHint, setTopicHint] = useState("");

  const [currentChallenge, setCurrentChallenge] = useState<AIChallenge>(() =>
    getCuratedChallenge(initialCategory, "playful")
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Active Challenge Timer State
  const [timerSecondsRemaining, setTimerSecondsRemaining] = useState(
    currentChallenge.durationSeconds
  );
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [completedBy, setCompletedBy] = useState<{ p1: boolean; p2: boolean }>({
    p1: false,
    p2: false,
  });

  // Sync timer when new challenge is set
  useEffect(() => {
    setTimerSecondsRemaining(currentChallenge.durationSeconds);
    setIsTimerRunning(false);
    setCompletedBy({ p1: false, p2: false });
  }, [currentChallenge]);

  // Timer Tick
  useEffect(() => {
    if (!isTimerRunning) return;

    const interval = setInterval(() => {
      setTimerSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleGenerateAI = async () => {
    setIsLoading(true);
    setIsTimedOut(false);
    setErrorMessage(null);

    // Client-side UI timeout notice after 6 seconds
    const timeoutWarningId = setTimeout(() => {
      setIsTimedOut(true);
    }, 6000);

    try {
      const result = await fetchAIChallenge({
        category: selectedCategory,
        difficulty: selectedDifficulty,
        partnerNames,
        partnerCities,
        topicHint: topicHint.trim().slice(0, 80),
      });

      clearTimeout(timeoutWarningId);
      setCurrentChallenge(result.challenge);
      setIsFallbackMode(result.isFallback);

      if (result.isFallback && result.fallbackReason) {
        if (result.fallbackReason.includes("rate limit")) {
          setErrorMessage("Rate limit reached. Delivered our top curated challenge.");
        } else if (result.fallbackReason.includes("timed out")) {
          setErrorMessage("AI connection took longer than expected. Using curated challenge.");
        } else {
          setErrorMessage(null);
        }
      }
    } catch {
      clearTimeout(timeoutWarningId);
      const fallback = getCuratedChallenge(selectedCategory, selectedDifficulty);
      setCurrentChallenge(fallback);
      setIsFallbackMode(true);
      setErrorMessage("Could not reach AI service. Standard challenge loaded.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseCuratedStandard = () => {
    setErrorMessage(null);
    setIsTimedOut(false);
    const standard = getCuratedChallenge(selectedCategory, selectedDifficulty);
    setCurrentChallenge(standard);
    setIsFallbackMode(true);
  };

  const handleToggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setTimerSecondsRemaining(currentChallenge.durationSeconds);
  };

  const togglePartnerComplete = (partner: "p1" | "p2") => {
    setCompletedBy((prev) => ({ ...prev, [partner]: !prev[partner] }));
  };

  const isBothCompleted = completedBy.p1 && completedBy.p2;

  return (
    <Container size="md" className="space-y-6 pb-20 pt-4">
      {/* --------------------------------------------------------------------- */}
      {/* 1. Header Navigation & Architecture Badges                           */}
      {/* --------------------------------------------------------------------- */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-neutral-900 pb-4">
        <Link
          id="back-to-vault-link"
          href="/play"
          className="inline-flex items-center gap-1 text-xs font-mono text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Game Vault</span>
        </Link>

        <div className="flex items-center space-x-2">
          <Badge
            variant={isFallbackMode ? "neutral" : "amber"}
            size="sm"
            className="font-mono text-[10px]"
          >
            {isFallbackMode ? "Curated Standard Bank" : "Gemini 3.8 Flash"}
          </Badge>
          <div className="flex items-center space-x-1.5 text-[11px] text-neutral-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Zero Game State Authority</span>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------------- */}
      {/* 2. Status & Error Notifications (Graceful Degradation)               */}
      {/* --------------------------------------------------------------------- */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={handleUseCuratedStandard}
              className="text-[11px] font-medium underline text-amber-300 hover:text-amber-100 shrink-0"
            >
              Standard Bank
            </button>
          </motion.div>
        )}

        {isTimedOut && isLoading && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs flex items-center justify-between"
          >
            <span>AI request taking longer than normal across the network...</span>
            <button
              onClick={handleUseCuratedStandard}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-[11px] font-medium"
            >
              Load Curated Now
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --------------------------------------------------------------------- */}
      {/* 3. Category Bar                                                       */}
      {/* --------------------------------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
          <span className="uppercase font-mono tracking-wider text-[11px]">
            Challenge Discipline
          </span>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="inline-flex items-center space-x-1 hover:text-neutral-200 text-neutral-400 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showConfig ? "Hide Tone & Prompt" : "Adjust Tone & Prompt"}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {CATEGORY_ITEMS.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                id={`cat-button-${cat.id}`}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  // Automatically generate or switch
                }}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                  isSelected
                    ? "bg-neutral-900/90 border-amber-500/50 text-neutral-100 shadow-md shadow-black/40"
                    : "bg-neutral-950/50 border-neutral-900 text-neutral-400 hover:border-neutral-800 hover:text-neutral-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon
                    className={`w-4 h-4 ${
                      isSelected ? "text-amber-400" : "text-neutral-500"
                    }`}
                  />
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold">{cat.label}</div>
                  <div className="text-[10px] text-neutral-400 line-clamp-1">
                    {cat.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 4. Collapsible Tone & Topic Config Drawer                            */}
      {/* --------------------------------------------------------------------- */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="p-4 bg-neutral-950/80 border-neutral-800/80 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                  Target Tone & Depth
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DIFFICULTY_LEVELS.map((diff) => (
                    <button
                      key={diff.id}
                      onClick={() => setSelectedDifficulty(diff.id)}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                        selectedDifficulty === diff.id
                          ? "bg-neutral-900 border-amber-500/40 text-amber-200"
                          : "bg-neutral-950/40 border-neutral-900 text-neutral-400 hover:border-neutral-800"
                      }`}
                    >
                      <div className="font-semibold">{diff.label}</div>
                      <div className="text-[10px] text-neutral-400">
                        {diff.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                  <span className="uppercase tracking-wider">
                    Optional Topic or Memory Hint
                  </span>
                  <span>{topicHint.length}/80 chars</span>
                </div>
                <input
                  type="text"
                  maxLength={80}
                  value={topicHint}
                  onChange={(e) => setTopicHint(e.target.value)}
                  placeholder="e.g. cooking together, our trip to Kyoto, morning coffee"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-100 text-xs placeholder:text-neutral-600 focus:outline-none focus:border-amber-500/50"
                />
                <p className="text-[10px] text-neutral-400">
                  Topic hints are sanitized and isolated against prompt injection.
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --------------------------------------------------------------------- */}
      {/* 5. Main Theatrical Challenge Presentation Card                       */}
      {/* --------------------------------------------------------------------- */}
      <Card
        id="togetherplay-ai-challenge-card"
        className="relative overflow-hidden p-6 sm:p-8 bg-[#121110] border-neutral-800/80 shadow-2xl flex flex-col justify-between space-y-6 min-h-[340px]"
      >
        {/* Top Challenge Metadata Bar */}
        <div className="flex items-center justify-between border-b border-neutral-800/60 pb-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-xs uppercase font-mono tracking-widest text-neutral-300">
              {currentChallenge.category.replace(/_/g, " ")}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant="neutral" size="sm" className="capitalize text-[11px]">
              {currentChallenge.difficulty}
            </Badge>
            <span className="text-xs font-mono text-neutral-400">
              {currentChallenge.durationSeconds}s
            </span>
          </div>
        </div>

        {/* Central Display Typography & Instructions */}
        <div className="space-y-4 my-2">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
              <div className="text-sm font-serif text-neutral-200">
                Crafting prompt for {partnerNames.p1} &amp; {partnerNames.p2}...
              </div>
              <div className="text-xs text-neutral-400 font-mono">
                Respecting privacy &amp; server authority
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Pure text rendering - Never dangerouslySetInnerHTML */}
              <h2
                id="challenge-title"
                className="text-xl sm:text-2xl font-serif text-neutral-100 tracking-tight leading-snug"
              >
                {currentChallenge.title}
              </h2>

              <p
                id="challenge-instructions"
                className="text-sm sm:text-base text-neutral-300 leading-relaxed max-w-2xl font-sans"
              >
                {currentChallenge.instructions}
              </p>
            </div>
          )}
        </div>

        {/* Timer Bar & Partner Completion Badges */}
        <div className="pt-4 border-t border-neutral-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Left: Interactive Timer */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs font-mono text-amber-300">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span className="font-semibold text-sm">
                {Math.floor(timerSecondsRemaining / 60)}:
                {(timerSecondsRemaining % 60).toString().padStart(2, "0")}
              </span>
            </div>

            <button
              onClick={handleToggleTimer}
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 transition-colors"
              title={isTimerRunning ? "Pause Timer" : "Start Timer"}
            >
              {isTimerRunning ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={handleResetTimer}
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
              title="Reset Timer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right: Partner Mutual Completion Check-ins */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => togglePartnerComplete("p1")}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center space-x-1.5 ${
                completedBy.p1
                  ? "bg-amber-950/60 border-amber-500/50 text-amber-200"
                  : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  completedBy.p1 ? "text-amber-400" : "text-neutral-600"
                }`}
              />
              <span>{partnerNames.p1}</span>
            </button>

            <button
              onClick={() => togglePartnerComplete("p2")}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center space-x-1.5 ${
                completedBy.p2
                  ? "bg-sage-950/60 border-emerald-500/50 text-emerald-200"
                  : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  completedBy.p2 ? "text-emerald-400" : "text-neutral-600"
                }`}
              />
              <span>{partnerNames.p2}</span>
            </button>
          </div>
        </div>

        {/* Mutual Completion Banner */}
        {isBothCompleted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Challenge completed by both {partnerNames.p1} and {partnerNames.p2}!</span>
            </div>
            <span className="font-semibold text-emerald-300 font-mono">+100 Synergy</span>
          </motion.div>
        )}
      </Card>

      {/* --------------------------------------------------------------------- */}
      {/* 6. Bottom Action Deck & Routing Options                              */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Button
            id="generate-new-ai-button"
            variant="amber"
            size="md"
            onClick={handleGenerateAI}
            isLoading={isLoading}
            className="flex-1 sm:flex-none shadow-md shadow-amber-950/30 font-semibold"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            <span>Generate Next Prompt</span>
          </Button>

          <Button
            id="use-curated-button"
            variant="outline"
            size="md"
            onClick={handleUseCuratedStandard}
            disabled={isLoading}
            className="flex-1 sm:flex-none text-neutral-300"
          >
            <span>Standard Bank</span>
          </Button>
        </div>

        {/* Conditional Launch to Live Camera Challenge Arena if applicable */}
        {currentChallenge.category === "camera_challenge" && (
          <Link
            href="/play/camera-challenge"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-amber-300 hover:bg-neutral-800 transition-colors text-xs font-semibold"
          >
            <Video className="w-4 h-4 text-amber-400" />
            <span>Launch Live Camera Event</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        )}
      </div>
    </Container>
  );
};

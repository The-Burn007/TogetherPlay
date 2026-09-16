"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Clock,
  MapPin,
  CheckCircle2,
  Circle,
  Coffee,
  Play,
  Sliders,
  ChevronRight,
  Shield,
  Heart,
  Volume2,
} from "lucide-react";
import type { GameNightLineup, GameNightVibe } from "@/lib/ai/gameNightTypes";

interface AnticipationCurtainProps {
  lineup: GameNightLineup;
  onCommence: () => void;
  onChangeVibe: (vibe: GameNightVibe) => void;
  currentVibe: GameNightVibe;
  isGeneratingNew: boolean;
}

export const AnticipationCurtain: React.FC<AnticipationCurtainProps> = ({
  lineup,
  onCommence,
  onChangeVibe,
  currentVibe,
  isGeneratingNew,
}) => {
  const [p1Ready, setP1Ready] = useState(true);
  const [p2Ready, setP2Ready] = useState(true);
  const [hasDrink, setHasDrink] = useState(true);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const p1Name = lineup.partnerNames.p1 || "Alex";
  const p2Name = lineup.partnerNames.p2 || "Sam";
  const p1City = lineup.partnerCities.p1 || "London";
  const p2City = lineup.partnerCities.p2 || "Tokyo";

  const handleStart = () => {
    setIsCountingDown(true);
    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        onCommence();
      }
    }, 1000);
  };

  const vibes: { id: GameNightVibe; label: string; desc: string }[] = [
    { id: "balanced", label: "Balanced", desc: "Sensory duels + deep questions" },
    { id: "cozy", label: "Cozy & Intimate", desc: "Gentle laughter & memories" },
    { id: "competitive", label: "Playful Rivalry", desc: "Speed & reflex contests" },
    { id: "deep_connection", label: "Deep Lore", desc: "Double-blind honesty" },
  ];

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-8 max-w-4xl mx-auto">
      {/* Countdown overlay if active */}
      <AnimatePresence>
        {isCountingDown && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0c0b0a]/95 backdrop-blur-md flex flex-col items-center justify-center"
          >
            <motion.div
              key={countdown}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              className="text-center space-y-4"
            >
              <span className="text-xs uppercase font-mono tracking-widest text-amber-500">
                TogetherPlay Private Evening
              </span>
              <div className="text-7xl sm:text-8xl font-serif font-light text-amber-100">
                {countdown > 0 ? countdown : "Begin"}
              </div>
              <p className="text-sm text-neutral-400">
                Curtain rising for {p1Name} &amp; {p2Name}...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Anticipation Content */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full space-y-8"
      >
        {/* Host Welcome & Banner */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            TogetherPlay Evening Sanctuary
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-light text-neutral-100 tracking-tight">
            {lineup.theme}
          </h1>

          <p className="text-sm sm:text-base text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            {lineup.themeDescription}
          </p>

          <div className="flex items-center justify-center gap-4 text-xs text-neutral-400 pt-1 font-mono">
            <span>
              {p1Name} • {p1City}
            </span>
            <span className="text-amber-500/60 font-serif text-sm">⇄</span>
            <span>
              {p2Name} • {p2City}
            </span>
            <span className="text-neutral-600">|</span>
            <span className="text-neutral-400">9,560 km meridian</span>
          </div>
        </div>

        {/* Host Letter Note */}
        <div className="p-5 rounded-2xl bg-[#141312] border border-neutral-800/90 text-center relative overflow-hidden">
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-24 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500">
            Host Welcome
          </span>
          <blockquote className="mt-2 text-sm sm:text-base font-serif italic text-neutral-200 leading-relaxed max-w-xl mx-auto">
            &ldquo;{lineup.hostWelcome}&rdquo;
          </blockquote>
        </div>

        {/* Tonight's Lineup Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs uppercase font-mono tracking-wider text-neutral-400">
              Tonight&apos;s 5-Round Lineup
            </h2>
            <span className="text-xs font-mono text-neutral-500">
              ~14 mins total
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
            {lineup.activities.map((act, idx) => (
              <div
                key={act.id}
                className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 hover:border-amber-500/40 transition-colors flex flex-col justify-between space-y-2 group"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-amber-500/80 mb-1">
                    <span>Round {idx + 1}</span>
                    <span className="text-neutral-500">~{act.estimatedMinutes}m</span>
                  </div>
                  <h3 className="text-xs font-semibold text-neutral-200 group-hover:text-amber-300 transition-colors">
                    {act.title.split(":")[0]}
                  </h3>
                  <p className="text-[10px] text-neutral-400 mt-1 line-clamp-2 leading-normal">
                    {act.subtitle}
                  </p>
                </div>

                <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[9px] uppercase font-mono text-neutral-500">
                  <span>{act.type.replace(/_/g, " ")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Evening Vibe Selector */}
        <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-500" />
              Evening Atmosphere Vibe
            </span>
            {isGeneratingNew && (
              <span className="text-[10px] font-mono text-amber-400 animate-pulse">
                Curating new lineup...
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {vibes.map((v) => (
              <button
                key={v.id}
                onClick={() => onChangeVibe(v.id)}
                disabled={isGeneratingNew}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  currentVibe === v.id
                    ? "bg-amber-500/10 border-amber-500/50 text-amber-300"
                    : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                }`}
              >
                <div className="text-xs font-semibold">{v.label}</div>
                <div className="text-[10px] text-neutral-500 mt-0.5">{v.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Check-ins & Commence CTA */}
        <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Partner readiness indicators */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <button
              onClick={() => setP1Ready(!p1Ready)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800/80 border border-neutral-700 hover:border-neutral-600 transition-colors"
            >
              {p1Ready ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-neutral-500" />
              )}
              <span className="text-neutral-200">{p1Name}: Ready</span>
            </button>

            <button
              onClick={() => setP2Ready(!p2Ready)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800/80 border border-neutral-700 hover:border-neutral-600 transition-colors"
            >
              {p2Ready ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-neutral-500" />
              )}
              <span className="text-neutral-200">{p2Name}: Ready</span>
            </button>

            <button
              onClick={() => setHasDrink(!hasDrink)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800/80 border border-neutral-700 hover:border-neutral-600 transition-colors text-neutral-300"
            >
              <Coffee className="w-3.5 h-3.5 text-amber-400" />
              <span>{hasDrink ? "Warm drinks ready" : "Grabbing tea..."}</span>
            </button>
          </div>

          {/* Commence Button */}
          <button
            onClick={handleStart}
            disabled={!p1Ready || !p2Ready}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm transition-all shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Commence Tonight&apos;s Lineup</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

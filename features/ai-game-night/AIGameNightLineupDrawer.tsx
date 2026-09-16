"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  ListOrdered,
  Clock,
  CheckCircle2,
  Play,
  Sparkles,
  MapPin,
  Heart,
} from "lucide-react";
import type { GameNightLineup } from "@/lib/ai/gameNightTypes";

interface AIGameNightLineupDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lineup: GameNightLineup;
  currentRoundIndex: number;
}

export const AIGameNightLineupDrawer: React.FC<AIGameNightLineupDrawerProps> = ({
  isOpen,
  onClose,
  lineup,
  currentRoundIndex,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Slide-over panel */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          className="relative w-full max-w-md h-full bg-[#11100f] border-l border-neutral-800 p-6 flex flex-col justify-between overflow-y-auto z-10"
        >
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800/80">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-5 h-5 text-amber-500" />
                <h3 className="font-serif text-lg font-medium text-neutral-100">
                  Tonight&apos;s Lineup
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Theme & Partner Lore Card */}
            <div className="mt-4 p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-serif italic text-amber-400">
                  {lineup.theme}
                </span>
                <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  5 Rounds
                </span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {lineup.themeDescription}
              </p>
              <div className="flex items-center gap-3 pt-1 text-[11px] text-neutral-400">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-neutral-500" />
                  {lineup.partnerNames.p1} ({lineup.partnerCities.p1})
                </span>
                <span className="text-neutral-600">⇄</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-neutral-500" />
                  {lineup.partnerNames.p2} ({lineup.partnerCities.p2})
                </span>
              </div>
            </div>

            {/* Activities List */}
            <div className="mt-6 space-y-3">
              <h4 className="text-[11px] uppercase tracking-wider font-mono text-neutral-400">
                Itinerary Schedule
              </h4>

              {lineup.activities.map((act, idx) => {
                const isCompleted = idx < currentRoundIndex;
                const isCurrent = idx === currentRoundIndex;

                return (
                  <div
                    key={act.id}
                    className={`p-3 rounded-xl border transition-all ${
                      isCurrent
                        ? "bg-amber-950/20 border-amber-500/40 shadow-[0_0_12px_rgba(251,191,36,0.1)]"
                        : isCompleted
                        ? "bg-neutral-900/40 border-neutral-800 opacity-80"
                        : "bg-neutral-900/20 border-neutral-800/60 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono shrink-0 mt-0.5 ${
                            isCompleted
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : isCurrent
                              ? "bg-amber-500 text-neutral-950 font-bold"
                              : "bg-neutral-800 text-neutral-400"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            idx + 1
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-neutral-200">
                              {act.title}
                            </span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-amber-500/20 text-amber-400">
                                Now
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-400 mt-0.5">
                            {act.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] font-mono text-neutral-400 shrink-0">
                        <Clock className="w-3 h-3 text-neutral-400" />
                        ~{act.estimatedMinutes}m
                      </div>
                    </div>

                    {/* Result tag if completed */}
                    {act.result && (
                      <div className="mt-2 pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-400 flex items-center justify-between">
                        <span className="text-emerald-400 font-mono">
                          {act.result.summary}
                        </span>
                        <span className="font-mono text-[10px]">
                          {lineup.partnerNames.p1}: {act.result.scores.p1} • {lineup.partnerNames.p2}: {act.result.scores.p2}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Host Note */}
          <div className="mt-6 pt-4 border-t border-neutral-800/80">
            <p className="text-[11px] italic text-neutral-400 leading-relaxed">
              &ldquo;{lineup.hostWelcome}&rdquo;
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

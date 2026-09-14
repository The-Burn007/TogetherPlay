"use client";

import React, { useState } from "react";
import { Zap, Lock, Unlock, Sparkles, Send } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { HomeChallengeData } from "@/lib/firebase/services/home";

export interface TodayOpportunityCardProps {
  challenge: HomeChallengeData;
  partnerName?: string;
  isNewCouple?: boolean;
}

export const TodayOpportunityCard: React.FC<TodayOpportunityCardProps> = ({
  challenge,
  partnerName = "Sam",
  isNewCouple = false,
}) => {
  const { showToast } = useToast();
  const [answer, setAnswer] = useState(challenge.userAnswer || "");
  const [revealed, setRevealed] = useState(challenge.revealed);

  const handleReveal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    setRevealed(true);
    showToast({
      message: `Dual spark unlocked with ${partnerName}! Synchrony recorded.`,
      variant: "success",
    });
  };

  return (
    <section className="flex flex-col w-full rounded-2xl bg-surface-raised border border-subtle-border p-5 sm:p-6 shadow-md space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-player-one-ember/15 flex items-center justify-center text-player-one-ember">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-on-surface">
              Today&apos;s Opportunity to Connect
            </h3>
            <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">
              Daily Connection Spark
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono text-shared-amber bg-shared-amber/10 border border-shared-amber/30 px-2.5 py-0.5 rounded-full font-medium">
          Daily Ritual
        </span>
      </div>

      {/* Main Question & Interaction Box */}
      <div className="p-4 sm:p-5 rounded-xl bg-surface-deep border border-subtle-border space-y-3.5">
        <p className="text-sm sm:text-base text-canvas-cream font-medium leading-relaxed">
          &ldquo;{challenge.question}&rdquo;
        </p>

        {/* Partner Sealed / Locked Status */}
        {isNewCouple ? (
          <div className="p-3 rounded-lg bg-surface-container border border-subtle-border flex items-center gap-2.5 text-xs text-on-surface-variant">
            <Sparkles className="w-4 h-4 text-shared-amber" />
            <span>Once your partner enters, your daily sparks will reveal reciprocally.</span>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-surface-container border border-subtle-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  revealed
                    ? "bg-player-two-sage/20 text-player-two-sage"
                    : "bg-surface-raised text-on-surface-variant"
                }`}
              >
                {revealed ? (
                  <Unlock className="w-3.5 h-3.5" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
              </div>

              {revealed ? (
                <div className="flex flex-col">
                  <span className="text-xs text-player-two-sage font-medium">
                    {partnerName}: &ldquo;{challenge.partnerAnswer || "Bon Iver — Holocene on that foggy highway exit"}&rdquo;
                  </span>
                </div>
              ) : (
                <div className="flex flex-col">
                  <span className="text-xs text-on-surface-variant italic">
                    {challenge.partnerAnswered
                      ? `${partnerName} sealed an answer ${challenge.partnerAnsweredAgo || "recently"}`
                      : `${partnerName} hasn't answered yet today`}
                  </span>
                </div>
              )}
            </div>

            <span
              className={`text-[10px] font-mono uppercase tracking-wider ${
                revealed
                  ? "text-player-two-sage font-bold"
                  : "text-on-surface-variant"
              }`}
            >
              {revealed ? "Unlocked" : "Locked"}
            </span>
          </div>
        )}

        {/* User Answer Interactive Form */}
        {revealed ? (
          <div className="p-3 rounded-lg bg-surface-raised border border-player-one-ember/40 text-xs text-player-one-ember">
            <span className="font-semibold block text-[10px] uppercase font-mono tracking-wider opacity-80 mb-0.5">
              Your Answer:
            </span>
            <span className="font-medium">&ldquo;{answer}&rdquo;</span>
          </div>
        ) : !isNewCouple ? (
          <form onSubmit={handleReveal} className="relative flex items-center pt-1">
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={`Type your answer to reveal ${partnerName}'s...`}
              className="w-full py-3 pl-3.5 pr-26 rounded-lg bg-surface-container-low border border-subtle-border text-on-surface placeholder:text-on-surface-variant/50 text-xs focus:outline-none focus:border-player-one-ember transition-colors"
            />
            <button
              type="submit"
              disabled={!answer.trim()}
              className="absolute right-1.5 px-3.5 py-1.5 rounded-md bg-player-one-ember text-canvas-cream text-[11px] font-mono uppercase font-bold tracking-wider hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Reveal</span>
              <Send className="w-3 h-3" />
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
};

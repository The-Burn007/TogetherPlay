"use client";

import React, { useState } from "react";
import { Sparkles, Lock, Unlock, Send } from "lucide-react";
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
      message: `Answer sealed and revealed with ${partnerName}! Synchrony recorded.`,
      variant: "success",
    });
  };

  return (
    <section className="relative w-full rounded-3xl bg-surface border border-border/80 p-6 sm:p-7 shadow-elevation-md space-y-4">
      {/* Header: Quiet invitation label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-soft-stone" />
          <h3 className="text-sm font-semibold text-warm-cream tracking-tight">
            Today&apos;s Small Invitation
          </h3>
        </div>

        <span className="text-[11px] font-mono text-soft-sage font-medium">
          Daily Spark
        </span>
      </div>

      {/* The Question Prompt: Editorial Fraunces Display with Warm Charcoal Surface */}
      <div className="p-5 rounded-2xl bg-surface-charcoal border border-border/80 space-y-4">
        <blockquote className="font-display text-base sm:text-lg text-warm-cream leading-relaxed italic">
          &ldquo;{challenge.question}&rdquo;
        </blockquote>

        {/* Partner Sealed / Reciprocal Status */}
        {isNewCouple ? (
          <div className="p-3 rounded-xl bg-surface border border-border flex items-center gap-2 text-xs text-soft-sage">
            <Sparkles className="w-3.5 h-3.5 text-soft-stone shrink-0" />
            <span>Once your partner joins, your daily sparks will reveal reciprocally.</span>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  revealed
                    ? "bg-brand/15 text-brand border border-brand/30"
                    : "bg-surface-secondary text-soft-sage border border-border"
                }`}
              >
                {revealed ? (
                  <Unlock className="w-3.5 h-3.5" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
              </div>

              {revealed ? (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-warm-cream font-medium truncate">
                    {partnerName}: &ldquo;{challenge.partnerAnswer || "Bon Iver — Holocene on that foggy highway exit"}&rdquo;
                  </span>
                </div>
              ) : (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-soft-stone truncate">
                    {challenge.partnerAnswered
                      ? `${partnerName} sealed an answer ${challenge.partnerAnsweredAgo || "earlier today"}`
                      : `${partnerName} hasn't answered yet today`}
                  </span>
                </div>
              )}
            </div>

            <span
              className={`text-[10px] font-mono uppercase tracking-wider shrink-0 font-medium ${
                revealed ? "text-brand" : "text-soft-sage"
              }`}
            >
              {revealed ? "Revealed" : "Sealed"}
            </span>
          </div>
        )}

        {/* User Answer Interactive Form */}
        {revealed ? (
          <div className="p-3.5 rounded-xl bg-surface-secondary border border-border text-xs">
            <span className="text-[10px] uppercase font-mono tracking-wider text-soft-sage block mb-0.5">
              Your Truth:
            </span>
            <span className="text-warm-cream font-medium">&ldquo;{answer}&rdquo;</span>
          </div>
        ) : !isNewCouple ? (
          <form onSubmit={handleReveal} className="relative flex items-center pt-1">
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={`Write your truth to reveal ${partnerName}'s...`}
              className="w-full py-2.5 pl-3.5 pr-28 rounded-xl bg-surface border border-border text-warm-cream placeholder:text-soft-sage text-xs focus-visible:outline-2 focus-visible:outline-brand transition-colors"
            />
            <button
              type="submit"
              disabled={!answer.trim()}
              className="absolute right-1 px-3 py-1.5 rounded-lg bg-brand text-text-on-mint text-[11px] font-semibold tracking-tight hover:bg-brand-hover active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand"
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

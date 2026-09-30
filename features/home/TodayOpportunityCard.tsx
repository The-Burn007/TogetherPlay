"use client";

import React, { useState } from "react";
import { Sparkles, Lock, Unlock, Send } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { HomeChallengeData } from "@/lib/firebase/services/home";

export interface TodayOpportunityCardProps {
  challenge?: HomeChallengeData | null;
  partnerName?: string;
  isNewCouple?: boolean;
}

export const TodayOpportunityCard: React.FC<TodayOpportunityCardProps> = ({
  challenge,
  partnerName = "Partner",
  isNewCouple = false,
}) => {
  const { showToast } = useToast();
  const [answer, setAnswer] = useState(challenge?.userAnswer || "");
  const [revealed, setRevealed] = useState(challenge?.revealed || false);

  if (!challenge) {
    return (
      <section className="relative w-full rounded-3xl bg-surface border border-border/80 p-6 sm:p-7 shadow-elevation-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-soft-sage" />
            <h3 className="text-sm font-semibold text-warm-cream tracking-tight">
              Today&apos;s Small Invitation
            </h3>
          </div>

          <span className="text-[11px] font-mono text-soft-stone font-medium">
            Daily Spark
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-surface-charcoal border border-border/60 text-center py-6 space-y-2">
          <p className="text-sm text-soft-stone">
            No active prompt today. Check back tomorrow for your next shared reflection, or start a quick duel together.
          </p>
        </div>
      </section>
    );
  }

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
          <Sparkles className="w-4 h-4 text-soft-sage" />
          <h3 className="text-sm font-semibold text-warm-cream tracking-tight">
            Today&apos;s Small Invitation
          </h3>
        </div>

        <span className="text-[11px] font-mono text-soft-stone font-medium">
          Daily Spark
        </span>
      </div>

      {/* The Question Prompt: Editorial Fraunces Display */}
      <div className="p-5 rounded-2xl bg-surface-charcoal border border-border/60 space-y-4">
        <blockquote className="font-display text-base sm:text-lg text-warm-cream leading-relaxed italic">
          &ldquo;{challenge.question}&rdquo;
        </blockquote>

        {/* Partner Sealed / Reciprocal Status */}
        {isNewCouple ? (
          <div className="p-3 rounded-lg bg-surface border border-border flex items-center gap-2 text-xs text-text-muted">
            <Sparkles className="w-3.5 h-3.5 text-brand shrink-0" />
            <span>Once your partner joins, your daily sparks will reveal reciprocally.</span>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-surface border border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  revealed
                    ? "bg-brand/15 text-brand border border-border-strong"
                    : "bg-surface-raised text-text-muted border border-border"
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
                  <span className="text-xs text-brand font-medium truncate">
                    {partnerName}: &ldquo;{challenge.partnerAnswer || "Answer revealed"}&rdquo;
                  </span>
                </div>
              ) : (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-text-secondary truncate">
                    {challenge.partnerAnswered
                      ? `${partnerName} sealed an answer ${challenge.partnerAnsweredAgo || "earlier today"}`
                      : `${partnerName} hasn't answered yet today`}
                  </span>
                </div>
              )}
            </div>

            <span
              className={`text-[10px] font-mono uppercase tracking-wider shrink-0 font-medium ${
                revealed ? "text-brand" : "text-text-muted"
              }`}
            >
              {revealed ? "Revealed" : "Sealed"}
            </span>
          </div>
        )}

        {/* User Answer Interactive Form */}
        {revealed ? (
          <div className="p-3 rounded-lg bg-surface-raised border border-border text-xs">
            <span className="text-[10px] uppercase font-mono tracking-wider text-text-muted block mb-0.5">
              Your Truth:
            </span>
            <span className="text-text-primary font-medium">&ldquo;{answer}&rdquo;</span>
          </div>
        ) : !isNewCouple ? (
          <form onSubmit={handleReveal} className="relative flex items-center pt-1">
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={`Write your truth to reveal ${partnerName}'s...`}
              className="w-full py-2.5 pl-3.5 pr-28 rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted text-xs focus-visible:outline-2 focus-visible:outline-brand transition-colors"
            />
            <button
              type="submit"
              disabled={!answer.trim()}
              className="absolute right-1 px-3 py-1.5 rounded-md bg-brand text-text-on-mint text-[11px] font-semibold tracking-tight hover:bg-brand-hover active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand"
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

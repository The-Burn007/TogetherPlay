"use client";

import React, { useState } from "react";
import { Zap, Lock, Unlock } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export const QuickSparkPrompt: React.FC = () => {
  const { showToast } = useToast();
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);

  const handleReveal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    setRevealed(true);
    showToast("Dual answers unlocked! Synchrony scored.");
  };

  return (
    <section className="flex flex-col w-full rounded-xl bg-surface-raised border border-subtle-border p-4 sm:p-5 shadow-md space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-player-one-ember" />
          <h3 className="text-sm font-semibold text-on-surface">
            Evening Quick Spark
          </h3>
        </div>
        <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">
          Daily Question
        </span>
      </div>

      <div className="p-4 rounded-lg bg-surface-deep border border-subtle-border space-y-3">
        <p className="text-sm text-canvas-cream font-medium leading-snug">
          &ldquo;What song instantly takes you back to our rainy road trip through Devon?&rdquo;
        </p>

        {/* Sam's Answer Lock Capsule */}
        <div className="p-2.5 rounded bg-surface-container border border-subtle-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-player-two-sage/20 flex items-center justify-center text-player-two-sage">
              {revealed ? (
                <Unlock className="w-3.5 h-3.5" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
            </div>
            {revealed ? (
              <span className="text-xs text-player-two-sage font-medium">
                Sam: &ldquo;Bon Iver — Holocene on that foggy highway exit&rdquo;
              </span>
            ) : (
              <span className="text-xs text-on-surface-variant italic">
                Sam sealed an answer 40m ago
              </span>
            )}
          </div>
          <span
            className={`text-[10px] font-mono uppercase tracking-wider ${
              revealed ? "text-player-two-sage font-bold" : "text-player-two-sage/80"
            }`}
          >
            {revealed ? "Unlocked" : "Locked"}
          </span>
        </div>

        {/* Alex Interactive Response Bar */}
        {revealed ? (
          <div className="p-2.5 rounded bg-surface-raised border border-player-one-ember/30 text-xs text-player-one-ember">
            <span className="font-semibold">Your Answer:</span> &ldquo;{answer}&rdquo;
          </div>
        ) : (
          <form onSubmit={handleReveal} className="relative flex items-center mt-2">
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer to reveal Sam's..."
              className="w-full py-2.5 pl-3 pr-24 rounded bg-surface-container-low border border-subtle-border text-on-surface placeholder:text-on-surface-variant/50 text-xs focus:outline-none focus:border-player-one-ember transition-colors"
            />
            <button
              type="submit"
              disabled={!answer.trim()}
              className="absolute right-1.5 px-3 py-1.5 rounded bg-player-one-ember text-canvas-cream text-[10px] font-mono uppercase font-bold tracking-wider hover:brightness-110 active:scale-95 transition-all disabled:opacity-40"
            >
              Reveal
            </button>
          </form>
        )}
      </div>
    </section>
  );
};

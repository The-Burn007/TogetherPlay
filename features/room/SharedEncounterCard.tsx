"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Flame, Timer, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export const SharedEncounterCard: React.FC = () => {
  const [secondsLeft, setSecondsLeft] = useState(114);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 120));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeFormatted = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  return (
    <section className="flex flex-col w-full rounded-xl bg-surface-raised border border-subtle-border overflow-hidden shadow-xl relative">
      {/* Editorial Header Banner */}
      <div className="relative w-full h-44 overflow-hidden bg-[#111A14] flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(24,37,29,0.9)_0%,rgba(17,26,20,1)_100%)]" />
        <div className="absolute -left-10 top-0 w-48 h-full bg-player-one-ember/20 blur-2xl" />
        <div className="absolute -right-10 bottom-0 w-48 h-full bg-brand/20 blur-2xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-raised via-surface-raised/40 to-transparent" />

        {/* Live Streak Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-deep/80 backdrop-blur-md border border-subtle-border">
          <Flame className="w-3.5 h-3.5 text-shared-amber fill-shared-amber" />
          <span className="text-[10px] font-mono text-canvas-cream uppercase tracking-wider font-semibold">
            Day 42 Streak · +3 Bonus
          </span>
        </div>

        <div className="absolute top-3 right-3">
          <Badge variant="sage" size="sm">
            Sam is In Lobby
          </Badge>
        </div>

        <div className="absolute bottom-2 inset-x-4">
          <span className="text-[10px] font-mono text-shared-amber uppercase tracking-widest font-semibold">
            Tonight&apos;s Shared Moment
          </span>
          <h3 className="text-xl font-semibold text-on-surface leading-tight mt-0.5">
            Find It First: Tokyo vs London
          </h3>
        </div>
      </div>

      <div className="p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between text-xs text-on-surface-variant font-mono">
          <div className="flex items-center gap-1.5">
            <Timer className="w-4 h-4 text-shared-amber" />
            <span>5-min tactile photo duel</span>
          </div>
          <span className="text-canvas-sand">
            Cooperative boost: <strong className="text-player-two-sage font-semibold">+150 Affinity</strong>
          </span>
        </div>

        {/* Tactile Interactive Play CTA */}
        <Link
          href="/play/find-it-first"
          className="w-full py-3.5 px-4 rounded-lg bg-shared-amber hover:bg-[#e6a847] text-surface-deep font-semibold tracking-tight shadow-lg transition-all flex items-center justify-between group active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-surface-deep animate-ping" />
            <span className="text-sm">Enter Shared Room With Sam</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono uppercase bg-surface-deep/15 px-2.5 py-1 rounded font-bold">
            <span>{timeFormatted}</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        <p className="text-[11px] font-mono text-center text-on-surface-variant">
          Alex holds Ember cards · Sam holds Sage clues
        </p>
      </div>
    </section>
  );
};

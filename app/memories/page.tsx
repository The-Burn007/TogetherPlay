"use client";

import React, { useState } from "react";
import { Container } from "@/components/layout/Container";
import { MemoryCard } from "@/features/memories/MemoryCard";
import { TimeCapsuleCard } from "@/features/memories/TimeCapsuleCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Flame, Compass, Heart } from "lucide-react";

export type MemoryFilter = "all" | "duels" | "snaps" | "voice" | "milestones";

export default function MemoriesPage() {
  const [activeFilter, setActiveFilter] = useState<MemoryFilter>("all");
  const [viewState, setViewState] = useState<"normal" | "loading" | "empty">("normal");

  const filterTabs: { id: MemoryFilter; label: string }[] = [
    { id: "all", label: "All (148)" },
    { id: "duels", label: "Photo Duels" },
    { id: "snaps", label: "Camera Snaps" },
    { id: "voice", label: "Voice Notes" },
    { id: "milestones", label: "Milestones" },
  ];

  return (
    <Container size="sm" className="space-y-6">
      {/* 1. Header & Relationship Stats Banner */}
      <header className="flex flex-col space-y-4">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="uppercase tracking-widest text-shared-amber font-semibold">
              Artifact Archive
            </span>
            <div className="flex items-center gap-1 bg-surface-raised border border-subtle-border rounded-full p-0.5 text-[10px] font-mono">
              <button
                onClick={() => setViewState("normal")}
                className={`px-2 py-0.5 rounded-full transition-all ${
                  viewState === "normal"
                    ? "bg-surface-overlay text-shared-amber font-semibold"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Archive
              </button>
              <button
                onClick={() => setViewState("loading")}
                className={`px-2 py-0.5 rounded-full transition-all ${
                  viewState === "loading"
                    ? "bg-surface-overlay text-shared-amber font-semibold"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Loading
              </button>
              <button
                onClick={() => setViewState("empty")}
                className={`px-2 py-0.5 rounded-full transition-all ${
                  viewState === "empty"
                    ? "bg-surface-overlay text-shared-amber font-semibold"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Empty
              </button>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-on-surface tracking-tight">
            Timeline &amp; Memories
          </h1>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Every photo finish, spoken reflection, and shared discovery preserved forever.
          </p>
        </div>

        {/* Milestone Stats Banner */}
        <div className="grid grid-cols-3 gap-2 bg-surface-raised border border-subtle-border rounded-xl p-3.5 shadow-md">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-1 text-shared-amber mb-0.5">
              <Heart className="w-3.5 h-3.5 fill-current" />
              <span className="text-base font-bold font-mono">148</span>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant">
              Shared Rituals
            </span>
          </div>

          <div className="flex flex-col items-center text-center border-x border-subtle-border">
            <div className="flex items-center gap-1 text-player-one-ember mb-0.5">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span className="text-base font-bold font-mono">42 Days</span>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant">
              Active Streak
            </span>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-1 text-player-two-sage mb-0.5">
              <Compass className="w-3.5 h-3.5" />
              <span className="text-base font-bold font-mono">6,700 mi</span>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant">
              Distance Bridged
            </span>
          </div>
        </div>
      </header>

      {/* Loading State */}
      {viewState === "loading" && (
        <div className="space-y-4 py-4">
          <CardSkeleton />
          <div className="p-8 flex flex-col items-center justify-center">
            <LoadingSpinner size="md" label="Decrypting couple timeline memories..." />
          </div>
          <CardSkeleton />
        </div>
      )}

      {/* Empty State */}
      {viewState === "empty" && (
        <EmptyState
          title="No Memories in this Filter"
          description="You haven't recorded any artifacts in this category yet. Complete a game session or seal a time capsule to populate this timeline."
          actionLabel="View All Memories"
          onAction={() => {
            setActiveFilter("all");
            setViewState("normal");
          }}
        />
      )}

      {/* Normal State */}
      {viewState === "normal" && (
        <>
          {/* 2. Today's Time Capsule Seal Widget */}
          <TimeCapsuleCard />

          {/* 3. Filter Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-mono tracking-wider uppercase whitespace-nowrap transition-all border ${
                  activeFilter === tab.id
                    ? "bg-shared-amber text-surface-deep border-shared-amber font-semibold"
                    : "bg-surface-raised text-on-surface-variant border-subtle-border hover:text-on-surface"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 4. Timeline Spine Container */}
          <div className="relative flex flex-col space-y-6 pt-2">
            {/* Visual Continuous Timeline Spine */}
            <div className="absolute left-3 top-4 bottom-4 w-[1px] bg-subtle-border -z-0" />

            {/* Memory Item 1: Yesterday's Duel */}
            <MemoryCard
              dateLabel="Yesterday · 23:18 GMT"
              tag="Speed Duel"
              tagVariant="amber"
              title="Speed Duel: Pocket Watch Discovery"
              description="A tense 4-minute sensory duel where Sam spotted the reflection off your desk lamp in 0.12 seconds."
              playerOnePhotoUrl="https://picsum.photos/seed/alex-duel-reaction/300/200"
              playerOneTimeLabel="2.42s reaction"
              playerOneCity="London"
              playerTwoPhotoUrl="https://picsum.photos/seed/sam-duel-reaction/300/200"
              playerTwoTimeLabel="2.30s (Winner)"
              playerTwoCity="Tokyo"
              highlightStat="Tokyo Lead: 0.12 seconds"
              pts="+120 Affinity"
              audioNote={{
                title: "Post-Match Laughs",
                author: "Sam",
                duration: "0:42",
              }}
            />

            {/* Memory Item 2: Camera Scavenger Quest */}
            <MemoryCard
              dateLabel="3 Days Ago · 19:40 GMT"
              tag="Camera Quest"
              tagVariant="sage"
              title="Quest: 'Something Yellow on Your Shelf'"
              description="Both tasked to locate and photograph an identical warm hue in your respective apartments."
              playerOnePhotoUrl="https://picsum.photos/seed/alex-yellow-tea/300/200"
              playerOneTimeLabel="Twinings Earl Grey Tin"
              playerOneCity="London"
              playerTwoPhotoUrl="https://picsum.photos/seed/sam-yellow-pass/300/200"
              playerTwoTimeLabel="Tokyo Subway Pass"
              playerTwoCity="Tokyo"
              quote={{
                text: "Even 6,000 miles away, we both chose yellow tea canisters from 2023.",
                author: "Sam in Tokyo",
              }}
            />

            {/* Memory Item 3: Milestone Reached */}
            <MemoryCard
              dateLabel="Oct 12 · 40-Day Milestone"
              tag="Milestone"
              tagVariant="ember"
              title="Crossed the 100km Meridian in Couple Race"
              description="Cooperated through 14 severe storm checkpoints to unlock the 'Celestial Sanctuary' theme."
              highlightStat="Perfect Cooperation: 98% Synchrony"
              pts="Unlocked Gold Badge"
            />
          </div>
        </>
      )}
    </Container>
  );
}

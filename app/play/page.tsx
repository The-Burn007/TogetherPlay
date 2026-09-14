"use client";

import React, { useState, useMemo } from "react";
import { Container } from "@/components/layout/Container";
import { PartnerPresenceStrip } from "@/features/presence/PartnerPresenceStrip";
import { GameFilterBar, type FilterCategory } from "@/features/games/GameFilterBar";
import { GameExperienceCard } from "@/features/games/GameExperienceCard";
import { LobbyBar } from "@/features/games/LobbyBar";
import { TOGETHERPLAY_GAMES, getFilterCounts } from "@/features/games/gameCatalog";
import { useToast } from "@/components/ui/Toast";
import { Sparkles, Compass } from "lucide-react";

export default function PlayPage() {
  const { showToast } = useToast();
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
  const [selectedGameForLobby, setSelectedGameForLobby] = useState<string>("Find It First");

  const filterCounts = useMemo(() => getFilterCounts(), []);

  const filteredGames = useMemo(() => {
    if (activeFilter === "all") return TOGETHERPLAY_GAMES;
    return TOGETHERPLAY_GAMES.filter((g) => g.filterTags.includes(activeFilter));
  }, [activeFilter]);

  const handlePlayTogether = (gameId: string) => {
    const targetGame = TOGETHERPLAY_GAMES.find((g) => g.id === gameId);
    if (targetGame) {
      setSelectedGameForLobby(targetGame.title);
      showToast({
        message: `Synchronizing ${targetGame.title} room with Sam in Tokyo...`,
        variant: "info",
      });
    }
  };

  return (
    <Container size="md" className="space-y-7 pb-16">
      {/* 1. Live Partner Presence Across Distance */}
      <PartnerPresenceStrip
        partnerName="Sam"
        partnerCity="Tokyo"
        partnerTime="23:42"
        statusText="Browsing the collection with you right now"
      />

      {/* 2. Atmosphere & Library Collection Header */}
      <header className="flex flex-col space-y-3 pt-1">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-1.5 text-shared-amber font-semibold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>The Collection</span>
          </div>
          <span className="text-on-surface-variant font-mono">
            {TOGETHERPLAY_GAMES.length} Experiences · London ⇄ Tokyo
          </span>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold text-on-surface tracking-tight">
            TogetherPlay Library
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-2xl leading-relaxed">
            An intimate anthology of shared rituals across distance. Each experience is crafted for two
            connected partners—balancing real-world touch, tactile competition, and shared synchrony.
          </p>
        </div>

        {/* 3. Lightweight Filter Bar */}
        <div className="pt-1">
          <GameFilterBar
            activeFilter={activeFilter}
            onSelectFilter={setActiveFilter}
            counts={filterCounts}
          />
        </div>
      </header>

      {/* 4. The Collection of Experiences (Distinctive Cards) */}
      <section id="game-experiences-collection" className="space-y-4">
        <div className="flex items-center justify-between text-xs font-mono text-on-surface-variant px-0.5">
          <span>
            Showing {filteredGames.length} {filteredGames.length === 1 ? "experience" : "experiences"}
            {activeFilter !== "all" ? ` filtered by &ldquo;${activeFilter}&rdquo;` : ""}
          </span>
          {activeFilter !== "all" && (
            <button
              onClick={() => setActiveFilter("all")}
              className="text-shared-amber hover:underline text-[11px]"
            >
              Reset to all
            </button>
          )}
        </div>

        {filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {filteredGames.map((game) => (
              <GameExperienceCard
                key={game.id}
                game={game}
                onPlayTogether={handlePlayTogether}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-surface-raised border border-subtle-border p-10 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center mx-auto text-on-surface-variant">
              <Compass className="w-5 h-5 text-shared-amber" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-on-surface">
                No experiences match this filter
              </h3>
              <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                Try selecting another filter or return to the full anthology to explore all 8 games.
              </p>
            </div>
            <button
              onClick={() => setActiveFilter("all")}
              className="text-xs font-mono text-shared-amber hover:underline font-medium"
            >
              View all 8 experiences
            </button>
          </div>
        )}
      </section>

      {/* 5. Sticky Mini Lobby Bar */}
      <LobbyBar
        selectedGameTitle={selectedGameForLobby}
        partnerStatus="Connected in Tokyo · Ready to sync"
      />
    </Container>
  );
}


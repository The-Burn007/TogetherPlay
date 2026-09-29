"use client";

import React, { useState, useMemo } from "react";
import { Container } from "@/components/layout/Container";
import { PartnerPresenceStrip } from "@/features/presence/PartnerPresenceStrip";
import { GameFilterBar, type FilterCategory } from "@/features/games/GameFilterBar";
import { GameExperienceCard } from "@/features/games/GameExperienceCard";
import { LobbyBar } from "@/features/games/LobbyBar";
import { TOGETHERPLAY_GAMES, getFilterCounts } from "@/features/games/gameCatalog";
import { useToast } from "@/components/ui/Toast";
import { useNotifications } from "@/lib/presence/useNotifications";
import { Sparkles, Compass, Play, Layers } from "lucide-react";
import Link from "next/link";

export default function PlayPage() {
  const { showToast } = useToast();
  const { invitePartner } = useNotifications();
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
  const [selectedGameForLobby, setSelectedGameForLobby] = useState<string>("Find It First");

  const filterCounts = useMemo(() => getFilterCounts(), []);

  const filteredGames = useMemo(() => {
    if (activeFilter === "all") return TOGETHERPLAY_GAMES;
    return TOGETHERPLAY_GAMES.filter((g) => g.filterTags.includes(activeFilter));
  }, [activeFilter]);

  const handlePlayTogether = async (gameId: string) => {
    const targetGame = TOGETHERPLAY_GAMES.find((g) => g.id === gameId);
    if (targetGame) {
      setSelectedGameForLobby(targetGame.title);
      await invitePartner(targetGame.id, targetGame.title);
      showToast({
        message: `Invited Sam in Tokyo to play ${targetGame.title}!`,
        variant: "info",
      });
    }
  };

  const featuredGame = TOGETHERPLAY_GAMES.find((g) => g.id === "ai_game_night") || TOGETHERPLAY_GAMES[0];
  const catalogGames = filteredGames.filter((g) => g.id !== featuredGame.id);

  return (
    <Container size="lg" className="space-y-8 pb-24">
      {/* 1. Live Partner Presence Across Distance */}
      <PartnerPresenceStrip
        partnerName="Sam"
        partnerCity="Tokyo"
        partnerTime="23:42"
        statusText="Browsing the collection with you right now"
      />

      {/* 2. Atmosphere & Library Collection Header */}
      <header className="flex flex-col space-y-3 pt-2 border-b border-border pb-6">
        <div className="flex items-center justify-between text-xs font-mono text-text-muted">
          <div className="flex items-center gap-1.5 text-brand font-semibold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Anthology of Play</span>
          </div>
          <span className="font-tabular">
            {TOGETHERPLAY_GAMES.length} Experiences · London ⇄ Tokyo
          </span>
        </div>

        <div className="space-y-1.5">
          <h1 className="font-display text-3xl sm:text-4xl text-text-primary tracking-tight font-medium">
            Shared Rituals for Two
          </h1>
          <p className="text-sm text-text-secondary max-w-2xl leading-relaxed">
            Every experience is purpose-built for two connected partners across distance.
            From visual observation to reflex duels and cooperative journeys, designed to cultivate presence.
          </p>
        </div>

        {/* 3. Filter Navigation */}
        <div className="pt-2">
          <GameFilterBar
            activeFilter={activeFilter}
            onSelectFilter={setActiveFilter}
            counts={filterCounts}
          />
        </div>
      </header>

      {/* 4. Asymmetric Featured Experience Banner (When filter is all) */}
      {activeFilter === "all" && featuredGame && (
        <section aria-label="Featured Experience" className="w-full">
          <div className="relative rounded-3xl bg-gradient-to-r from-surface via-surface to-background border border-brand/30 p-6 sm:p-8 overflow-hidden shadow-elevation-md">
            <div className="absolute top-0 right-0 w-96 h-96 bg-brand/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-xl">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-brand font-semibold uppercase tracking-wider">
                    Anthology Centerpiece
                  </span>
                  <span className="text-text-muted">·</span>
                  <span className="text-text-secondary">Curated 5-Round Date Night</span>
                </div>

                <h2 className="font-display text-2xl sm:text-3xl text-text-primary tracking-tight">
                  {featuredGame.title}
                </h2>

                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                  {featuredGame.description}
                </p>

                {/* 5-Round Sequence Preview */}
                <div className="grid grid-cols-5 gap-1.5 pt-1 text-center text-[10px] font-mono max-w-md">
                  <div className="p-2 rounded-xl bg-background border border-border">
                    <div className="text-brand font-bold">R1</div>
                    <div className="text-text-muted truncate">Find It</div>
                  </div>
                  <div className="p-2 rounded-xl bg-background border border-border">
                    <div className="text-brand font-bold">R2</div>
                    <div className="text-text-muted truncate">Question</div>
                  </div>
                  <div className="p-2 rounded-xl bg-background border border-border">
                    <div className="text-warm-cream font-bold">R3</div>
                    <div className="text-soft-sage truncate">Camera</div>
                  </div>
                  <div className="p-2 rounded-xl bg-surface-secondary border border-border">
                    <div className="text-warm-cream font-bold">R4</div>
                    <div className="text-soft-sage truncate">Speed</div>
                  </div>
                  <div className="p-2 rounded-xl bg-surface-secondary border border-border-strong">
                    <div className="text-warm-cream font-bold">R5</div>
                    <div className="text-soft-stone truncate font-semibold">Finale</div>
                  </div>
                </div>
              </div>

              {/* Action Box */}
              <div className="shrink-0 flex flex-col gap-3 lg:border-l lg:border-border lg:pl-8">
                <div className="text-xs font-mono text-soft-sage space-y-1">
                  <div>Duration: <strong className="text-warm-cream font-tabular">15–20 min</strong></div>
                  <div>Experience: <strong className="text-warm-cream">Two-player shared</strong></div>
                </div>

                <Link
                  id={`play-together-btn-${featuredGame.id}`}
                  href={featuredGame.href}
                  onClick={() => handlePlayTogether(featuredGame.id)}
                  className="py-3 px-6 rounded-xl bg-brand text-text-on-mint hover:bg-brand-hover font-semibold text-xs tracking-tight shadow-mint-glow transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Begin Full Experience</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 5. The Collection of Experiences (Varied Asymmetric Cards) */}
      <section id="game-experiences-collection" className="space-y-4">
        <div className="flex items-center justify-between text-xs font-mono text-text-muted px-0.5">
          <span>
            Anthology Experiences (<strong className="text-text-primary font-tabular">{filteredGames.length}</strong>)
            {activeFilter !== "all" ? ` filtered by &ldquo;${activeFilter}&rdquo;` : ""}
          </span>
          {activeFilter !== "all" && (
            <button
              onClick={() => setActiveFilter("all")}
              className="text-brand hover:underline cursor-pointer"
            >
              Reset to all
            </button>
          )}
        </div>

        {filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {(activeFilter === "all" ? catalogGames : filteredGames).map((game) => (
              <GameExperienceCard
                key={game.id}
                game={game}
                onPlayTogether={handlePlayTogether}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-surface border border-border p-12 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center mx-auto text-text-muted">
              <Compass className="w-5 h-5 text-brand" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-sm font-semibold text-text-primary">
                No experiences match this filter
              </h3>
              <p className="text-xs text-text-secondary max-w-sm mx-auto leading-relaxed">
                Try selecting another filter or return to the full anthology to explore all 6 experiences.
              </p>
            </div>
            <button
              onClick={() => setActiveFilter("all")}
              className="text-xs font-mono text-brand hover:underline font-medium cursor-pointer"
            >
              View all experiences
            </button>
          </div>
        )}
      </section>

      {/* 6. Sticky Mini Lobby Bar */}
      <LobbyBar
        selectedGameTitle={selectedGameForLobby}
        partnerStatus="Connected in Tokyo · Ready to sync"
      />
    </Container>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Clock,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Radio,
  Wifi,
  WifiOff,
  ChevronLeft,
  Sparkles,
  Send,
  RefreshCw,
  Play,
  CheckCircle2,
  Layers,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { TOGETHERPLAY_GAMES } from "@/features/games/gameCatalog";
import { usePresence } from "@/lib/presence/usePresence";
import { useNotifications } from "@/lib/presence/useNotifications";
import { PartnerPresenceBadge } from "@/components/ui/PartnerPresenceBadge";
import type { GameType } from "@/types/domain";
import { useMultiplayerLobby } from "./useMultiplayerLobby";

interface MultiplayerGameLobbyProps {
  initialGameId?: GameType;
}

export const MultiplayerGameLobby: React.FC<MultiplayerGameLobbyProps> = ({
  initialGameId = "find_it_first",
}) => {
  const { showToast } = useToast();
  const { partnerState, partnerConnection, partnerDisplayName, partnerCity } = usePresence();
  const { invitePartner } = useNotifications();
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  const {
    lobbyState,
    sessionId,
    selectedGame,
    playerA,
    playerB,
    countdown,
    connectionStats,
    partnerJoins,
    togglePlayerAReady,
    togglePlayerBReady,
    triggerDisconnect,
    triggerReconnect,
    switchGame,
    togglePlayerAVideo,
    togglePlayerAAudio,
    setExplicitState,
    sendPartnerWhisper,
    returnToLobby,
  } = useMultiplayerLobby(initialGameId);

  const handleSendNudge = async () => {
    sendPartnerWhisper("Alex is waiting in the game lobby for you!");
    await invitePartner(selectedGame.id, selectedGame.title);
    showToast({
      message: `Whisper & invitation to play ${selectedGame.title} delivered to Sam in Tokyo`,
      variant: "nudge",
    });
  };

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast({
        message: "Private room link copied to clipboard",
        variant: "info",
      });
    }
  };

  const bothReady = playerA.isReady && playerB.isReady;

  return (
    <Container size="md" className="space-y-6 pb-20">
      {/* 1. Header Navigation & State Stepper */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4">
        <Link
          href="/play"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-text-muted hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-brand"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Anthology</span>
        </Link>

        {/* Discreet Simulation State Stepper (Preserved for full testability across all 5 states) */}
        <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1 text-[11px] font-mono overflow-x-auto max-w-full">
          <span className="text-text-muted px-2 py-0.5 text-[10px] uppercase font-semibold hidden md:inline">
            State:
          </span>
          {(
            [
              { key: "waiting", label: "Waiting" },
              { key: "partner_joined", label: "Joined" },
              { key: "ready", label: "Ready" },
              { key: "starting", label: "Starting" },
              { key: "disconnected", label: "Offline" },
            ] as const
          ).map((st) => (
            <button
              key={st.key}
              onClick={() => setExplicitState(st.key)}
              className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                lobbyState === st.key
                  ? "bg-brand text-text-on-mint font-semibold shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </header>

      {/* 2. Atmospheric Ready Banner: "We're About to Play" */}
      <section className="text-center space-y-2 py-1">
        <div className="inline-flex items-center gap-2 text-xs font-mono text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
          <span className="font-semibold text-text-primary">Shared Match Chamber</span>
          <span className="text-text-muted" aria-hidden="true">·</span>
          <span>Room #{sessionId.slice(-5)}</span>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl text-text-primary tracking-tight">
          Tonight&apos;s Match Space
        </h1>

        <p className="text-xs sm:text-sm text-text-secondary max-w-lg mx-auto">
          London ({playerA.localTime}) ⇄ Tokyo ({playerB.localTime}) · <span className="font-tabular">9,560 km</span> bridged
        </p>
      </section>

      {/* 3. Disconnect Alert Banner (When connection drops) */}
      {lobbyState === "disconnected" && (
        <Card
          variant="raised"
          className="p-5 border-danger/40 bg-danger/10 space-y-3 animate-in fade-in"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-danger/20 text-danger flex items-center justify-center shrink-0 mt-0.5">
              <WifiOff className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">
                  Transcontinental Link Paused
                </h3>
                <span className="text-[10px] font-mono text-danger">
                  Heartbeat lost
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Unable to reach Tokyo peer over WebRTC. Reconnecting automatically...
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="brand"
              size="sm"
              onClick={triggerReconnect}
              className="text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Reconnect Now
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSendNudge}
              className="text-xs"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Send Ping to Sam
            </Button>
          </div>
        </Card>
      )}

      {/* 4. The Chosen Game Showcase (Game Identity) */}
      <Card variant="raised" className="p-5 sm:p-6 space-y-4 border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-brand font-semibold uppercase tracking-wider">
              Chosen Experience
            </span>
            <span className="text-text-muted" aria-hidden="true">·</span>
            <span className="text-text-secondary">{selectedGame.badgeLabel}</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCatalogOpen(true)}
            className="text-xs font-mono text-text-secondary hover:text-text-primary self-start sm:self-auto"
          >
            <Layers className="w-3.5 h-3.5 mr-1.5 text-brand" />
            Change Game
          </Button>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h2 className="font-display text-xl sm:text-2xl text-text-primary tracking-tight">
              {selectedGame.title}
            </h2>
            <span className="text-xs font-mono text-text-muted">
              {selectedGame.subtitle}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            {selectedGame.description}
          </p>
        </div>

        {/* Game Metadata Strip (Unboxed metadata) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-background border border-border space-y-0.5">
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
              <Clock className="w-3 h-3 text-brand" />
              <span>Duration</span>
            </div>
            <div className="font-semibold text-text-primary font-tabular">{selectedGame.duration}</div>
          </div>

          <div className="p-2.5 rounded-xl bg-background border border-border space-y-0.5">
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
              <Video className="w-3 h-3 text-brand" />
              <span>Video Link</span>
            </div>
            <div className="font-semibold text-text-primary truncate">
              {selectedGame.videoSupport}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-surface-secondary border border-border space-y-0.5">
            <div className="flex items-center gap-1.5 text-[10px] text-soft-sage">
              <Sparkles className="w-3 h-3 text-soft-stone" />
              <span>Playstyle</span>
            </div>
            <div className="font-semibold text-warm-cream truncate">
              {selectedGame.playStyle}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-surface-secondary border border-border space-y-0.5">
            <div className="flex items-center gap-1.5 text-[10px] text-soft-sage">
              <ShieldCheck className="w-3 h-3 text-soft-stone" />
              <span>Connection</span>
            </div>
            <div className="font-semibold text-warm-cream truncate">
              Real-Time Synced
            </div>
          </div>
        </div>
      </Card>

      {/* 5. Dual Player Chambers (Prioritizing Both Players & Readiness) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
        {/* PLAYER A (You / Alex - London) */}
        <Card
          variant="raised"
          className={`p-5 flex flex-col justify-between space-y-4 border transition-all ${
            playerA.isReady
              ? "border-brand shadow-mint-glow bg-surface-raised"
              : "border-border"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar
                name={playerA.name}
                colorRole={playerA.colorRole}
                size="lg"
                isOnline={playerA.isOnline}
                imageUrl={playerA.avatarUrl}
              />
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-text-primary">
                    {playerA.name} (You)
                  </span>
                </div>
                <div className="text-xs font-mono text-text-muted">
                  {playerA.city} · <span className="font-tabular">{playerA.localTime}</span>
                </div>
              </div>
            </div>

            {/* Latency Readout */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-secondary border border-border text-xs font-mono text-soft-sage">
              <Wifi className="w-3 h-3 text-soft-stone" />
              <span className="font-tabular text-warm-cream">{connectionStats.latencyMs}ms</span>
            </div>
          </div>

          {/* Discreet Camera & Audio Preview */}
          <div className="rounded-xl bg-surface-charcoal border border-border p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-soft-sage">
              <span className="flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-soft-stone" />
                <span>Camera & Mic Check</span>
              </span>
              <span className="text-brand font-medium">
                {playerA.videoEnabled ? "Camera Active" : "Camera Off"}
              </span>
            </div>

            <div className="relative h-28 rounded-lg bg-surface border border-border overflow-hidden flex items-center justify-center">
              {playerA.videoEnabled ? (
                <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center p-3 text-center">
                  <div className="w-9 h-9 rounded-full bg-brand/15 text-brand flex items-center justify-center mb-1">
                    <Video className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-medium text-text-primary">
                    Alex&apos;s Feed
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">
                    720p HD · London Studio
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-text-muted space-y-1">
                  <VideoOff className="w-5 h-5" />
                  <span className="text-[10px] font-mono">Camera Paused</span>
                </div>
              )}

              {/* In-viewport Controls */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5 z-10">
                <button
                  onClick={togglePlayerAVideo}
                  title="Toggle Camera"
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                    playerA.videoEnabled
                      ? "bg-surface-raised text-text-primary hover:bg-surface-overlay border border-border"
                      : "bg-danger text-text-on-mint font-bold"
                  }`}
                >
                  {playerA.videoEnabled ? (
                    <Video className="w-3.5 h-3.5" />
                  ) : (
                    <VideoOff className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={togglePlayerAAudio}
                  title="Toggle Microphone"
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                    playerA.audioEnabled
                      ? "bg-surface-raised text-text-primary hover:bg-surface-overlay border border-border"
                      : "bg-danger text-text-on-mint font-bold"
                  }`}
                >
                  {playerA.audioEnabled ? (
                    <Mic className="w-3.5 h-3.5" />
                  ) : (
                    <MicOff className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Player A Ready Toggle */}
          <div className="pt-1 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  playerA.isReady ? "bg-brand animate-pulse" : "bg-text-muted/40"
                }`}
              />
              <span className={playerA.isReady ? "text-brand font-semibold" : "text-text-muted"}>
                {playerA.isReady ? "Ready to Play" : "Preparing..."}
              </span>
            </div>

            <Button
              variant={playerA.isReady ? "outline" : "brand"}
              size="sm"
              onClick={togglePlayerAReady}
              disabled={lobbyState === "starting" || lobbyState === "disconnected"}
              className="text-xs font-mono"
            >
              {playerA.isReady ? "Change Mind" : "I'm Ready"}
            </Button>
          </div>
        </Card>

        {/* PLAYER B (Partner / Sam - Tokyo) */}
        <Card
          variant="raised"
          className={`p-5 flex flex-col justify-between space-y-4 border transition-all ${
            playerB.isReady
              ? "border-brand shadow-mint-glow bg-surface-raised"
              : lobbyState === "waiting"
              ? "border-dashed border-border"
              : "border-border"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar
                  name={playerB.name}
                  colorRole={playerB.colorRole}
                  size="lg"
                  isOnline={playerB.isOnline && playerB.isInLobby}
                  imageUrl={playerB.avatarUrl}
                />
                {!playerB.isInLobby && (
                  <div className="absolute inset-0 rounded-full bg-background/60 backdrop-blur-[1px] flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-brand animate-ping" />
                  </div>
                )}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-text-primary">
                    {playerB.name}
                  </span>
                </div>
                <div className="text-xs font-mono text-text-muted">
                  {playerB.city} · <span className="font-tabular">{playerB.localTime}</span>
                </div>
              </div>
            </div>

            {/* Realtime Presence & Latency */}
            <div className="flex items-center gap-2">
              <PartnerPresenceBadge
                partnerName={partnerDisplayName || playerB.name}
                partnerCity={partnerCity || playerB.city}
                state={partnerState}
                connectionStatus={partnerConnection}
                variant="compact"
              />
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-secondary border border-border text-xs font-mono text-soft-sage">
                {playerB.isInLobby && lobbyState !== "disconnected" ? (
                  <>
                    <Wifi className="w-3 h-3 text-soft-stone" />
                    <span className="font-tabular text-warm-cream">{playerB.latencyMs}ms</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-soft-sage" />
                    <span>Offline</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sam's Chamber Content */}
          {lobbyState === "waiting" || !playerB.isInLobby ? (
            <div className="rounded-xl bg-surface-charcoal border border-border p-4 flex flex-col items-center justify-center text-center space-y-3 h-36">
              <div className="w-10 h-10 rounded-full bg-surface-secondary border border-border text-soft-stone flex items-center justify-center">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-text-primary">
                  Waiting for Sam to step into lobby...
                </div>
                <div className="text-[11px] text-text-muted max-w-xs">
                  Sam will connect automatically upon opening TogetherPlay in Tokyo.
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="brand"
                  size="sm"
                  onClick={handleSendNudge}
                  className="text-xs"
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Send Whisper Ping
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={partnerJoins}
                  className="text-xs font-mono text-text-muted hover:text-text-primary"
                  title="Simulate Sam joining the lobby"
                >
                  Simulate Join
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-background border border-border p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-text-muted">
                <span className="flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-brand" />
                  <span>Partner Video Feed</span>
                </span>
                <span className="text-brand font-medium">
                  Connected &amp; Ready
                </span>
              </div>

              {/* Partner Camera Viewport */}
              <div className="relative h-28 rounded-lg bg-surface border border-border overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center p-3 text-center">
                  <div className="w-9 h-9 rounded-full bg-brand/15 text-brand flex items-center justify-center mb-1">
                    <Video className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-medium text-text-primary">
                    Sam&apos;s Feed
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">
                    720p HD · Tokyo Studio
                  </span>
                </div>

                <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-background/80 text-[10px] font-mono text-brand">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                  <span>Live Feed</span>
                </div>
              </div>
            </div>
          )}

          {/* Player B Ready Status */}
          <div className="pt-1 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  playerB.isReady ? "bg-brand animate-pulse" : "bg-text-muted/40"
                }`}
              />
              <span className={playerB.isReady ? "text-brand font-semibold" : "text-text-muted"}>
                {playerB.isReady ? "Sam is Ready!" : playerB.isInLobby ? "Sam is deciding..." : "Not in lobby yet"}
              </span>
            </div>

            {playerB.isInLobby && (
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePlayerBReady}
                disabled={lobbyState === "starting" || lobbyState === "disconnected"}
                className="text-xs font-mono text-text-muted hover:text-text-primary"
                title="Toggle Sam's ready state"
              >
                {playerB.isReady ? "Simulate Unready" : "Simulate Ready"}
              </Button>
            )}
          </div>
        </Card>
      </section>

      {/* 6. Active Launch Flow & Countdown */}
      {lobbyState === "starting" && (
        <Card
          variant="raised"
          className="p-8 text-center space-y-4 border-brand/60 bg-brand/5 animate-in fade-in"
        >
          <div className="w-16 h-16 rounded-full bg-brand/20 text-brand flex items-center justify-center mx-auto text-3xl font-mono font-bold font-tabular animate-pulse">
            {countdown}
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-xl text-text-primary">
              Synchronizing with Tokyo...
            </h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Both partners confirmed. Commencing {selectedGame.title}.
            </p>
          </div>
        </Card>
      )}

      {lobbyState === "game" && (
        <Card
          variant="raised"
          className="p-6 text-center space-y-4 border-brand/60 bg-brand/5 animate-in fade-in"
        >
          <div className="w-12 h-12 rounded-full bg-brand/20 text-brand flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-xl text-text-primary">
              Session Synchronized!
            </h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              You and Sam are primed for {selectedGame.title}.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {selectedGame.id === "find_it_first" ? (
              <Link href="/play/find-it-first">
                <Button variant="brand" size="md">
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  Enter Active Arena
                </Button>
              </Link>
            ) : selectedGame.id === "speed_duel" ? (
              <Link href="/play/speed-duel">
                <Button variant="brand" size="md">
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  Enter Speed Duel Arena
                </Button>
              </Link>
            ) : selectedGame.id === "couple_race" ? (
              <Link href="/play/couple-race">
                <Button variant="brand" size="md">
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  Enter Meridian Tabletop
                </Button>
              </Link>
            ) : (
              <Button
                variant="brand"
                size="md"
                onClick={() =>
                  showToast({
                    message: `Game arena for ${selectedGame.title} is ready.`,
                    variant: "success",
                  })
                }
              >
                <Play className="w-4 h-4 mr-2 fill-current" />
                Launch {selectedGame.title}
              </Button>
            )}

            <Button variant="ghost" size="md" onClick={returnToLobby}>
              Return to Lobby
            </Button>
          </div>
        </Card>
      )}

      {lobbyState !== "starting" && lobbyState !== "game" && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Sparkles className="w-4 h-4 text-brand shrink-0" />
            <span>
              {bothReady
                ? "Both partners confirmed! Initiating synchrony countdown..."
                : playerA.isReady
                ? "You're marked ready. Waiting for Sam to confirm..."
                : playerB.isReady
                ? "Sam is ready in Tokyo! Tap 'I'm Ready' to begin."
                : "Both partners tap 'I'm Ready' to start the duel."}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="flex-1 sm:flex-initial text-xs"
            >
              Copy Room Link
            </Button>
            {lobbyState !== "disconnected" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={triggerDisconnect}
                className="text-xs text-text-muted hover:text-danger"
                title="Test disconnect state"
              >
                Simulate Disconnect
              </Button>
            ) : (
              <Button
                variant="brand"
                size="sm"
                onClick={triggerReconnect}
                className="text-xs"
              >
                Restore Connection
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 7. Game Switcher Modal (Intimate Modal Selector) */}
      {isCatalogOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4">
          <Card
            variant="raised"
            className="w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto border border-border"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-base text-text-primary">
                Choose Tonight&apos;s Experience
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCatalogOpen(false)}
              >
                Close
              </Button>
            </div>

            <div className="space-y-2">
              {TOGETHERPLAY_GAMES.map((game) => (
                <button
                  key={game.id}
                  onClick={() => {
                    switchGame(game.id);
                    setIsCatalogOpen(false);
                    showToast({
                      message: `Switched selected experience to ${game.title}`,
                      variant: "info",
                    });
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                    selectedGame.id === game.id
                      ? "bg-surface-raised border-brand shadow-sm"
                      : "bg-surface border-border hover:border-brand/40"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-primary">
                        {game.title}
                      </span>
                      <span className="text-[10px] font-mono text-brand font-tabular">
                        {game.duration}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary line-clamp-2">
                      {game.description}
                    </p>
                  </div>
                  {selectedGame.id === game.id && (
                    <CheckCircle2 className="w-4 h-4 text-brand shrink-0 mt-1" />
                  )}
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}
    </Container>
  );
};

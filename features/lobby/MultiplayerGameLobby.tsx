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
  Heart,
  Send,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { TOGETHERPLAY_GAMES } from "@/features/games/gameCatalog";
import type { GameType } from "@/types/domain";
import type { LobbyFlowState } from "./types";
import { useMultiplayerLobby } from "./useMultiplayerLobby";

interface MultiplayerGameLobbyProps {
  initialGameId?: GameType;
}

export const MultiplayerGameLobby: React.FC<MultiplayerGameLobbyProps> = ({
  initialGameId = "find_it_first",
}) => {
  const { showToast } = useToast();
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

  const handleSendNudge = () => {
    sendPartnerWhisper("Alex is waiting in the game lobby for you!");
    showToast({
      message: "Gentle whisper delivered to Sam's phone in Tokyo",
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

  return (
    <Container size="md" className="space-y-6 pb-16">
      {/* 1. Header Navigation & State Preview Pill */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-subtle-border pb-4">
        <Link
          href="/play"
          className="inline-flex items-center gap-1 text-xs font-mono text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Game Vault</span>
        </Link>

        {/* State Preview Stepper (For verifying all 5 required states) */}
        <div className="flex items-center gap-1 bg-surface-deep border border-subtle-border rounded-full p-1 text-[11px] font-mono overflow-x-auto max-w-full">
          <span className="text-on-surface-variant/60 px-2 py-0.5 text-[10px] uppercase font-semibold hidden md:inline">
            Lobby State:
          </span>
          {(
            [
              { key: "waiting", label: "1. Waiting" },
              { key: "partner_joined", label: "2. Partner Joined" },
              { key: "ready", label: "3. Ready" },
              { key: "starting", label: "4. Starting" },
              { key: "disconnected", label: "5. Disconnected" },
            ] as const
          ).map((st) => (
            <button
              key={st.key}
              onClick={() => setExplicitState(st.key)}
              className={`px-2.5 py-1 rounded-full transition-all whitespace-nowrap ${
                lobbyState === st.key
                  ? "bg-surface-raised text-shared-amber font-semibold shadow-sm border border-subtle-border"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </header>

      {/* 2. Atmospheric Couple Sanctuary Header */}
      <section className="text-center space-y-2 py-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-raised border border-subtle-border text-[11px] font-mono text-on-surface-variant">
          <span className="w-2 h-2 rounded-full bg-shared-amber animate-pulse" />
          <span>Private Sanctuary</span>
          <span className="text-subtle-border">·</span>
          <span>Room #{sessionId.slice(-5)}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-semibold text-on-surface tracking-tight">
          Tonight&apos;s Shared Space
        </h1>

        <p className="text-xs sm:text-sm text-on-surface-variant max-w-lg mx-auto">
          London ({playerA.localTime}) ⇄ Tokyo ({playerB.localTime}) · 9,560 km apart
        </p>
      </section>

      {/* 3. Disconnect Alert Banner (When in disconnected state) */}
      {lobbyState === "disconnected" && (
        <Card
          variant="raised"
          className="p-5 border-player-one-ember/40 bg-player-one-ember/10 space-y-3 animate-in fade-in"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-player-one-ember/20 text-player-one-ember flex items-center justify-center shrink-0 mt-0.5">
              <WifiOff className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-on-surface">
                  Transatlantic Connection Paused
                </h3>
                <span className="text-[10px] font-mono text-player-one-ember">
                  Last active 14s ago
                </span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Unable to reach Tokyo WebRTC mesh peer. Reconnecting to restore heartbeat...
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="amber"
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

      {/* 4. Dual Player Chamber (Private to Two Partners) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
        {/* PLAYER A (Alex / You - London) */}
        <Card
          variant="raised"
          className={`p-5 flex flex-col justify-between space-y-4 border transition-colors ${
            playerA.isReady ? "border-player-one-ember/60" : "border-subtle-border"
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
                  <span className="text-sm font-semibold text-on-surface">
                    {playerA.name} (You)
                  </span>
                  <Badge variant="ember" size="sm">
                    Ember
                  </Badge>
                </div>
                <div className="text-[11px] font-mono text-on-surface-variant">
                  {playerA.city} · {playerA.localTime}
                </div>
                <div className="text-[10px] text-on-surface-variant/70">
                  {playerA.weather}
                </div>
              </div>
            </div>

            {/* Connection / Latency */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-deep border border-subtle-border text-[10px] font-mono text-on-surface-variant">
              <Wifi className="w-3 h-3 text-player-two-sage" />
              <span>{connectionStats.latencyMs}ms</span>
            </div>
          </div>

          {/* Video & Audio Preview Frame */}
          <div className="rounded-xl bg-surface-deep border border-subtle-border p-3 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-shared-amber" />
                <span>Camera & Audio Check</span>
              </span>
              <span className="text-[10px] text-player-two-sage">
                {playerA.videoEnabled ? "Camera Active" : "Camera Off"}
              </span>
            </div>

            {/* Soft Camera Simulation Viewport */}
            <div className="relative h-28 sm:h-32 rounded-lg bg-surface-base border border-subtle-border/70 overflow-hidden flex items-center justify-center">
              {playerA.videoEnabled ? (
                <div className="absolute inset-0 bg-neutral-900/80 flex flex-col items-center justify-center p-3 text-center">
                  <div className="w-10 h-10 rounded-full bg-player-one-ember/20 text-player-one-ember flex items-center justify-center mb-1">
                    <Video className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium text-on-surface">
                    Alex&apos;s Camera Stream
                  </span>
                  <span className="text-[9px] font-mono text-on-surface-variant">
                    720p HD · 30 FPS · London Room
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-on-surface-variant space-y-1">
                  <VideoOff className="w-5 h-5" />
                  <span className="text-[10px] font-mono">Camera Paused</span>
                </div>
              )}

              {/* In-viewport Controls */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5 z-10">
                <button
                  onClick={togglePlayerAVideo}
                  title="Toggle Camera"
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                    playerA.videoEnabled
                      ? "bg-surface-raised text-on-surface hover:bg-surface-overlay"
                      : "bg-player-one-ember text-surface-deep font-bold"
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
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                    playerA.audioEnabled
                      ? "bg-surface-raised text-on-surface hover:bg-surface-overlay"
                      : "bg-player-one-ember text-surface-deep font-bold"
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

          {/* Player A Ready Status & Action */}
          <div className="pt-1 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  playerA.isReady ? "bg-shared-amber" : "bg-on-surface-variant/40"
                }`}
              />
              <span className="text-xs font-mono">
                {playerA.isReady ? "Marked Ready" : "Preparing..."}
              </span>
            </div>

            <Button
              variant={playerA.isReady ? "ghost" : "amber"}
              size="sm"
              onClick={togglePlayerAReady}
              disabled={lobbyState === "starting" || lobbyState === "disconnected"}
              className="text-xs font-mono"
            >
              {playerA.isReady ? "Change Mind" : "I'm Ready"}
            </Button>
          </div>
        </Card>

        {/* PLAYER B (Sam / Partner - Tokyo) */}
        <Card
          variant="raised"
          className={`p-5 flex flex-col justify-between space-y-4 border transition-colors ${
            playerB.isReady
              ? "border-player-two-sage/60"
              : lobbyState === "waiting"
              ? "border-dashed border-subtle-border"
              : "border-subtle-border"
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
                  <div className="absolute inset-0 rounded-full bg-surface-base/60 backdrop-blur-[1px] flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-shared-amber animate-ping" />
                  </div>
                )}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-on-surface">
                    {playerB.name}
                  </span>
                  <Badge variant="sage" size="sm">
                    Sage
                  </Badge>
                </div>
                <div className="text-[11px] font-mono text-on-surface-variant">
                  {playerB.city} · {playerB.localTime}
                </div>
                <div className="text-[10px] text-on-surface-variant/70">
                  {playerB.weather}
                </div>
              </div>
            </div>

            {/* Connection / Latency */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-deep border border-subtle-border text-[10px] font-mono text-on-surface-variant">
              {playerB.isInLobby && lobbyState !== "disconnected" ? (
                <>
                  <Wifi className="w-3 h-3 text-player-two-sage" />
                  <span>{playerB.latencyMs}ms</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-on-surface-variant/50" />
                  <span>Offline</span>
                </>
              )}
            </div>
          </div>

          {/* Sam's Chamber Content depending on state */}
          {lobbyState === "waiting" || !playerB.isInLobby ? (
            <div className="rounded-xl bg-surface-deep border border-subtle-border p-4 flex flex-col items-center justify-center text-center space-y-3 h-36 sm:h-40">
              <div className="w-10 h-10 rounded-full bg-shared-amber/10 border border-shared-amber/30 text-shared-amber flex items-center justify-center">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-on-surface">
                  Waiting for Sam to step in...
                </div>
                <div className="text-[10px] text-on-surface-variant max-w-xs">
                  Sam will automatically connect when opening TogetherPlay in Tokyo.
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="amber"
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
                  className="text-xs font-mono"
                  title="Simulate Sam joining the lobby"
                >
                  Simulate Join
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-surface-deep border border-subtle-border p-3 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-player-two-sage" />
                  <span>Partner Video Feed</span>
                </span>
                <span className="text-[10px] text-player-two-sage">
                  Connected & Ready
                </span>
              </div>

              {/* Partner Camera Viewport */}
              <div className="relative h-28 sm:h-32 rounded-lg bg-surface-base border border-subtle-border/70 overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-neutral-900/80 flex flex-col items-center justify-center p-3 text-center">
                  <div className="w-10 h-10 rounded-full bg-player-two-sage/20 text-player-two-sage flex items-center justify-center mb-1">
                    <Video className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium text-on-surface">
                    Sam&apos;s Camera Stream
                  </span>
                  <span className="text-[9px] font-mono text-on-surface-variant">
                    720p HD · 30 FPS · Tokyo Studio
                  </span>
                </div>

                <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-deep/80 text-[10px] font-mono text-player-two-sage">
                  <span className="w-1.5 h-1.5 rounded-full bg-player-two-sage animate-pulse" />
                  <span>Live Feed</span>
                </div>
              </div>
            </div>
          )}

          {/* Player B Ready Status & Action */}
          <div className="pt-1 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  playerB.isReady ? "bg-player-two-sage" : "bg-on-surface-variant/40"
                }`}
              />
              <span className="text-xs font-mono">
                {playerB.isReady ? "Sam is Ready" : playerB.isInLobby ? "Sam is deciding..." : "Not in lobby"}
              </span>
            </div>

            {playerB.isInLobby && (
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePlayerBReady}
                disabled={lobbyState === "starting" || lobbyState === "disconnected"}
                className="text-[11px] font-mono text-on-surface-variant hover:text-on-surface"
                title="Toggle Sam's ready state for previewing"
              >
                {playerB.isReady ? "Simulate Unready" : "Simulate Ready"}
              </Button>
            )}
          </div>
        </Card>
      </section>

      {/* 5. Selected Game Showcase */}
      <Card variant="raised" className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-subtle-border pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-shared-amber font-semibold">
              Selected Experience
            </span>
            <Badge variant="amber">{selectedGame.badgeLabel}</Badge>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCatalogOpen(true)}
            className="text-xs font-mono text-on-surface-variant hover:text-on-surface self-start sm:self-auto"
          >
            <Layers className="w-3.5 h-3.5 mr-1.5" />
            Switch Game
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h2 className="text-xl sm:text-2xl font-semibold text-on-surface">
              {selectedGame.title}
            </h2>
            <span className="text-xs font-mono text-on-surface-variant">
              {selectedGame.subtitle}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
            {selectedGame.description}
          </p>
        </div>

        {/* Game Secondary Metadata (Duration, Video Availability, Playstyle) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
          <div className="p-2.5 rounded-lg bg-surface-deep border border-subtle-border space-y-0.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-on-surface-variant">
              <Clock className="w-3 h-3 text-shared-amber" />
              <span>Duration</span>
            </div>
            <div className="font-semibold text-on-surface">{selectedGame.duration}</div>
          </div>

          <div className="p-2.5 rounded-lg bg-surface-deep border border-subtle-border space-y-0.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-on-surface-variant">
              <Video className="w-3 h-3 text-player-two-sage" />
              <span>Video Support</span>
            </div>
            <div className="font-semibold text-on-surface truncate">
              {selectedGame.videoSupport}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-surface-deep border border-subtle-border space-y-0.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-on-surface-variant">
              <Heart className="w-3 h-3 text-player-one-ember" />
              <span>Playstyle</span>
            </div>
            <div className="font-semibold text-on-surface truncate">
              {selectedGame.playStyle}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-surface-deep border border-subtle-border space-y-0.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-on-surface-variant">
              <Sparkles className="w-3 h-3 text-shared-amber" />
              <span>Difficulty</span>
            </div>
            <div className="font-semibold text-on-surface truncate">
              {selectedGame.difficulty}
            </div>
          </div>
        </div>
      </Card>

      {/* 6. Flow Status & Active Launch Panel */}
      {lobbyState === "starting" && (
        <Card
          variant="raised"
          className="p-8 text-center space-y-4 border-shared-amber/60 bg-shared-amber/5 animate-in fade-in"
        >
          <div className="w-16 h-16 rounded-full bg-shared-amber/15 text-shared-amber flex items-center justify-center mx-auto text-2xl font-mono font-bold animate-pulse">
            {countdown}
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-on-surface">
              Synchronizing with Tokyo...
            </h3>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
              Both partners are ready. Commencing {selectedGame.title}.
            </p>
          </div>
        </Card>
      )}

      {lobbyState === "game" && (
        <Card
          variant="raised"
          className="p-6 text-center space-y-4 border-player-two-sage/60 bg-player-two-sage/5 animate-in fade-in"
        >
          <div className="w-12 h-12 rounded-full bg-player-two-sage/20 text-player-two-sage flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-on-surface">
              Session Synchronized!
            </h3>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
              You and Sam are primed for {selectedGame.title}.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {selectedGame.id === "find_it_first" ? (
              <Link href="/play/find-it-first">
                <Button variant="amber" size="md">
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  Enter Active Arena
                </Button>
              </Link>
            ) : (
              <Button
                variant="amber"
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
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <HelpCircle className="w-4 h-4 text-shared-amber shrink-0" />
            <span>
              {playerA.isReady && playerB.isReady
                ? "Both partners are ready! Launching countdown..."
                : playerA.isReady
                ? "You're marked ready. Waiting for Sam to confirm..."
                : playerB.isReady
                ? "Sam is ready in Tokyo! Tap 'I'm Ready' to begin."
                : "Both partners must tap Ready to initiate the countdown."}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="ghost"
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
                className="text-xs text-player-one-ember hover:bg-player-one-ember/10"
                title="Test disconnect state"
              >
                Simulate Disconnect
              </Button>
            ) : (
              <Button
                variant="amber"
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

      {/* 7. Game Switcher Modal */}
      {isCatalogOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card
            variant="raised"
            className="w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-subtle-border pb-3">
              <h3 className="text-base font-semibold text-on-surface">
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
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                    selectedGame.id === game.id
                      ? "bg-surface-raised border-shared-amber"
                      : "bg-surface-deep border-subtle-border hover:border-on-surface-variant/40"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-on-surface">
                        {game.title}
                      </span>
                      <Badge variant="amber" size="sm">
                        {game.duration}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-on-surface-variant line-clamp-2">
                      {game.description}
                    </p>
                  </div>
                  {selectedGame.id === game.id && (
                    <CheckCircle2 className="w-4 h-4 text-shared-amber shrink-0 mt-1" />
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

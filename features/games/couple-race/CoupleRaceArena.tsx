"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Volume2,
  VolumeX,
  RefreshCw,
  Trophy,
  Video,
  VideoOff,
  Sparkles,
  HelpCircle,
  RotateCcw,
  Compass,
  Layers,
  ArrowRight,
  ShieldCheck,
  Pause,
  Play,
  WifiOff,
  Wifi,
  Info,
  X,
} from "lucide-react";
import { TabletopBoard } from "./TabletopBoard";
import { DiceCup } from "./DiceCup";
import { PowerCardDeck } from "./PowerCardDeck";
import { TabletopTurnBar } from "./TabletopTurnBar";
import { RaceResultsModal } from "./RaceResultsModal";
import { tabletopAudio } from "./coupleRaceAudio";
import { GameRoomVideoCompanion } from "@/features/video/GameRoomVideoCompanion";
import { authoritativeGameClient } from "@/lib/firebase/services/authoritativeGameClient";
import { COUPLE_RACE_TILES } from "@/lib/firebase/server/authoritativeGameEngine";
import { PLAYER_METAS, type TabletopCameraMode } from "./types";
import type {
  GameSession,
  GameState,
  CoupleRacePlayerState,
  CoupleRaceTile,
  CoupleRacePowerType,
  CoupleRaceRoundHistoryItem,
} from "@/types/domain";

interface CoupleRaceArenaProps {
  initialGameId?: string;
  defaultPlayerId?: string;
}

export const CoupleRaceArena: React.FC<CoupleRaceArenaProps> = ({
  initialGameId = "couple_race_circuit",
  defaultPlayerId = "user_alex",
}) => {
  const router = useRouter();
  const [gameId, setGameId] = useState(initialGameId);
  const [activePlayerId, setActivePlayerId] = useState(defaultPlayerId);

  // Authoritative session & state
  const [session, setSession] = useState<GameSession | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("Initializing Meridian Tabletop...");

  // Camera & presentation state
  const [cameraMode, setCameraMode] = useState<TabletopCameraMode>("perspective");
  const [zoom, setZoom] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [showVideoCompanion, setShowVideoCompanion] = useState(true);
  const [selectedInspectTile, setSelectedInspectTile] = useState<CoupleRaceTile | null>(null);
  const [showRulesGuide, setShowRulesGuide] = useState(false);

  // Extract server data
  const serverData = useMemo(() => {
    return (gameState?.data || {}) as Record<string, unknown>;
  }, [gameState?.data]);

  const players = useMemo(() => {
    return (serverData.players || {}) as Record<string, CoupleRacePlayerState>;
  }, [serverData.players]);

  const turnPlayerId = (gameState?.turnPlayerId as string) || (serverData.currentTurnPlayerId as string) || "user_alex";
  const turnNumber = Number(serverData.turnNumber) || 1;
  const hasRolledThisTurn = Boolean(serverData.hasRolledThisTurn);
  const hasMovedThisTurn = Boolean(serverData.hasMovedThisTurn);
  const currentDiceValue = typeof serverData.currentDiceValue === "number" ? serverData.currentDiceValue : null;
  const secondDiceValue = typeof serverData.secondDiceValue === "number" ? serverData.secondDiceValue : null;
  const effectiveDistance = typeof serverData.effectiveDistance === "number" ? serverData.effectiveDistance : currentDiceValue;
  const validMovePositions = Array.isArray(serverData.validMovePositions) ? (serverData.validMovePositions as number[]) : [];
  const activePowerThisTurn = (serverData.activePowerThisTurn as string) || null;
  const isPaused = Boolean(serverData.isPaused);
  const cooperativeHarmonyScore = Number(serverData.cooperativeHarmonyScore) || 0;
  const roundHistory = Array.isArray(serverData.roundHistory) ? (serverData.roundHistory as CoupleRaceRoundHistoryItem[]) : [];
  const scores = gameState?.scores || { user_alex: 0, user_sam: 0 };
  const winnerId = gameState?.winnerId || null;
  const isGameEnd = gameState?.status === "game_end" || Boolean(winnerId);

  const activeLocalPlayerState = players[activePlayerId] || {
    playerId: activePlayerId,
    position: 0,
    lapsCompleted: 0,
    powers: ["WIND_STRIDE"],
    shieldActive: false,
    activeEffects: [],
    totalRolls: 0,
    connectionStatus: "connected",
    disconnectedAt: null,
  };

  const partnerId = activePlayerId === "user_alex" ? "user_sam" : "user_alex";
  const isPartnerDisconnected = players[partnerId]?.connectionStatus === "disconnected";
  const isLocalDisconnected = activeLocalPlayerState.connectionStatus === "disconnected";

  // Toggle Mute
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    tabletopAudio.setMuted(next);
  };

  // Zoom handler with clamp [0.8 .. 1.25]
  const handleZoomChange = (delta: number) => {
    setZoom((prev) => Math.min(1.25, Math.max(0.8, Number((prev + delta).toFixed(2)))));
  };

  // 1. Initial Session Setup
  useEffect(() => {
    let isMounted = true;

    async function initGame() {
      try {
        setIsInitializing(true);
        const { session: sess, state } = await authoritativeGameClient.ensureGameSession(
          gameId,
          ["user_alex", "user_sam"],
          false,
          "couple_race"
        );

        if (!isMounted) return;
        setSession(sess);
        setGameState(state);

        // If game is in ready state, start it authoritatively
        if (state.status === "ready") {
          const res = await authoritativeGameClient.submitAction(
            gameId,
            "START_GAME",
            {},
            activePlayerId
          );
          if (res.gameState) {
            setGameState(res.gameState);
          }
        }
        setStatusMessage("Meridian Tabletop active. Awaiting first dice roll.");
      } catch (err) {
        console.error("[CoupleRaceArena] Init error:", err);
        setStatusMessage("Connected with local authoritative fallback.");
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    }

    initGame();

    // 2. Real-time Subscriptions with recovery on reconnect/wake
    let unsubEphemeral = authoritativeGameClient.subscribeToEphemeralState(
      gameId,
      (updatedState) => {
        if (!isMounted || !updatedState) return;
        setGameState(updatedState);
        authoritativeGameClient.reconcileInFlightActions(gameId, updatedState);

        if (updatedState.status === "game_end") {
          tabletopAudio.playVictory();
        }
      }
    );

    let unsubDurable = authoritativeGameClient.subscribeToDurableSession(
      gameId,
      (updatedSession) => {
        if (!isMounted || !updatedSession) return;
        setSession(updatedSession);
      }
    );

    const onReconnectOrWake = async () => {
      if (!isMounted) return;
      try {
        const agg = await authoritativeGameClient.fetchGameAggregate(gameId);
        if (agg && isMounted) {
          setSession(agg.session);
          setGameState(agg.state);
          authoritativeGameClient.reconcileInFlightActions(gameId, agg.state);
          if (agg.state.status === "game_end") {
            tabletopAudio.playVictory();
          }
        }
        // Re-establish fresh listeners
        unsubEphemeral();
        unsubDurable();
        unsubEphemeral = authoritativeGameClient.subscribeToEphemeralState(gameId, (st) => {
          if (!isMounted || !st) return;
          setGameState(st);
          authoritativeGameClient.reconcileInFlightActions(gameId, st);
          if (st.status === "game_end") tabletopAudio.playVictory();
        });
        unsubDurable = authoritativeGameClient.subscribeToDurableSession(gameId, (sess) => {
          if (!isMounted || !sess) return;
          setSession(sess);
        });
      } catch {
        // Fallback
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", onReconnectOrWake);
      window.addEventListener("focus", onReconnectOrWake);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") onReconnectOrWake();
      });
    }

    return () => {
      isMounted = false;
      unsubEphemeral();
      unsubDurable();
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onReconnectOrWake);
        window.removeEventListener("focus", onReconnectOrWake);
      }
    };
  }, [gameId, activePlayerId]);

  // ACTION 1: ROLL DICE
  const handleRollDice = async () => {
    if (isSubmitting || turnPlayerId !== activePlayerId || hasRolledThisTurn) return;
    try {
      setIsSubmitting(true);
      setStatusMessage("Consulting authoritative server dice tumbler...");
      const result = await authoritativeGameClient.submitAction(
        gameId,
        "ROLL_DICE",
        {},
        activePlayerId
      );

      if (result.gameState) {
        setGameState(result.gameState);
        const payload = (result.payload || {}) as Record<string, unknown>;
        const rolledDistance = payload.totalDistance || payload.diceValue;
        setStatusMessage(`Authoritative roll: ${rolledDistance} steps. Choose destination tile.`);
      }
    } catch (err) {
      console.error("[CoupleRaceArena] Roll error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ACTION 2: MOVE PIECE
  const handleMovePiece = async (targetPosition?: number) => {
    if (isSubmitting || turnPlayerId !== activePlayerId || !hasRolledThisTurn || hasMovedThisTurn) return;
    try {
      setIsSubmitting(true);
      tabletopAudio.playPieceMove();
      setStatusMessage("Moving piece across Meridian pavers...");

      const destination = typeof targetPosition === "number" ? targetPosition : validMovePositions[0];
      const result = await authoritativeGameClient.submitAction(
        gameId,
        "MOVE",
        { targetPosition: destination },
        activePlayerId
      );

      if (result.gameState) {
        setGameState(result.gameState);
        const payload = (result.payload || {}) as Record<string, unknown>;
        const tileName = (payload.tileName as string) || "pavers";
        const desc = (payload.tileEffectDescription as string) || "";
        const lapDone = Boolean(payload.completedLap);

        if (lapDone) {
          tabletopAudio.playMeridianChime();
          setStatusMessage(`Meridian Lap Complete! Landed on ${tileName}.`);
        } else {
          setStatusMessage(`Advanced to ${tileName}. ${desc}`);
        }
      }
    } catch (err) {
      console.error("[CoupleRaceArena] Move error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ACTION 3: USE POWER
  const handleUsePower = async (power: CoupleRacePowerType) => {
    if (isSubmitting || turnPlayerId !== activePlayerId) return;
    try {
      setIsSubmitting(true);
      const result = await authoritativeGameClient.submitAction(
        gameId,
        "USE_POWER",
        { power },
        activePlayerId
      );

      if (result.gameState) {
        setGameState(result.gameState);
        const payload = (result.payload || {}) as Record<string, unknown>;
        const msg = String(payload.effectMessage || "Tactical power activated.");
        setStatusMessage(msg);
      }
    } catch (err) {
      console.error("[CoupleRaceArena] Power error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ACTION 4: END TURN
  const handleEndTurn = async () => {
    if (isSubmitting || turnPlayerId !== activePlayerId) return;
    try {
      setIsSubmitting(true);
      const result = await authoritativeGameClient.submitAction(
        gameId,
        "END_TURN",
        {},
        activePlayerId
      );

      if (result.gameState) {
        setGameState(result.gameState);
        const payload = (result.payload || {}) as Record<string, unknown>;
        const nextId = String(payload.nextTurnPlayerId || partnerId);
        const nextName = PLAYER_METAS[nextId]?.name || nextId;
        setStatusMessage(`Turn passed to ${nextName}.`);
      }
    } catch (err) {
      console.error("[CoupleRaceArena] End turn error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ACTION 5: PAUSE / RESUME
  const handleTogglePause = async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      const actionType = isPaused ? "RESUME_GAME" : "PAUSE_GAME";
      const result = await authoritativeGameClient.submitAction(
        gameId,
        actionType,
        {},
        activePlayerId
      );

      if (result.gameState) {
        setGameState(result.gameState);
        setStatusMessage(isPaused ? "Expedition resumed." : "Expedition paused.");
      }
    } catch (err) {
      console.error("[CoupleRaceArena] Pause toggle error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ACTION 6: DISCONNECT / RECONNECT SIMULATION
  const handleToggleDisconnect = async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      const actionType = isLocalDisconnected ? "PLAYER_RECONNECT" : "PLAYER_DISCONNECT";
      const result = await authoritativeGameClient.submitAction(
        gameId,
        actionType,
        {},
        activePlayerId
      );

      if (result.gameState) {
        setGameState(result.gameState);
        setStatusMessage(
          isLocalDisconnected
            ? "Connection restored. Resynchronized with Meridian tabletop."
            : "Player disconnected. Tabletop paused for partner."
        );
      }
    } catch (err) {
      console.error("[CoupleRaceArena] Disconnect toggle error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ACTION 7: REMATCH
  const handleRematch = async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      setStatusMessage("Re-laying the 24 Meridian pavers for a fresh expedition...");
      const result = await authoritativeGameClient.submitAction(
        gameId,
        "REMATCH",
        {},
        activePlayerId
      );

      if (result.gameState) {
        setGameState(result.gameState);
        setStatusMessage("Rematch initialized. Alex takes the first turn.");
      }
    } catch (err) {
      console.error("[CoupleRaceArena] Rematch error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-[#0d0c0b] text-stone-100 flex flex-col justify-between">
      {/* 1. Header: Tabletop Metadata & Controls */}
      <header className="w-full border-b border-stone-800 bg-[#121110] px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-300">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-serif font-bold text-stone-100">
                Couple Race
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-500/40">
                Digital Tabletop
              </span>
            </div>
            <p className="text-[11px] text-stone-400 font-mono">
              London ⇄ Tokyo · Meridian Expedition
            </p>
          </div>
        </div>

        {/* Perspective Player Switcher (Alex / Sam for multi-tab testing) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-stone-900/90 rounded-full p-1 border border-stone-800 text-[11px] font-mono">
            <span className="text-stone-500 px-2 text-[10px] uppercase font-semibold hidden md:inline">
              Viewing As:
            </span>
            <button
              id="switch-player-alex-btn"
              onClick={() => setActivePlayerId("user_alex")}
              className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 ${
                activePlayerId === "user_alex"
                  ? "bg-amber-500 text-stone-950 font-bold shadow-sm"
                  : "text-stone-400 hover:text-stone-200"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-300" />
              <span>Alex (London)</span>
            </button>
            <button
              id="switch-player-sam-btn"
              onClick={() => setActivePlayerId("user_sam")}
              className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 ${
                activePlayerId === "user_sam"
                  ? "bg-emerald-600 text-white font-bold shadow-sm"
                  : "text-stone-400 hover:text-stone-200"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-300" />
              <span>Sam (Tokyo)</span>
            </button>
          </div>

          {/* Audio Mute & Rules & Video Companion Toggles */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowRulesGuide(true)}
              className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
              title="Tabletop Rules & Lore"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <button
              onClick={handleToggleMute}
              className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
              title={isMuted ? "Unmute Tabletop Audio" : "Mute Tabletop Audio"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
            </button>

            <button
              onClick={() => setShowVideoCompanion(!showVideoCompanion)}
              className={`p-2 rounded-xl border transition-colors ${
                showVideoCompanion
                  ? "bg-stone-900 border-amber-500/50 text-amber-300"
                  : "bg-stone-900 border-stone-800 text-stone-500"
              }`}
              title="Toggle Live Video Companion Overlay"
            >
              {showVideoCompanion ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Disconnect Alert Banner if either player is offline */}
      {(isLocalDisconnected || isPartnerDisconnected) && (
        <div className="w-full bg-rose-950/80 border-b border-rose-800/80 px-4 py-2 flex items-center justify-between text-xs text-rose-200 font-mono z-20">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-rose-400 animate-pulse" />
            <span>
              {isLocalDisconnected
                ? "You are currently disconnected from the authoritative room."
                : "Partner in Tokyo lost connection. Waiting for reconnect..."}
            </span>
          </div>

          {isLocalDisconnected && (
            <button
              onClick={handleToggleDisconnect}
              className="px-3 py-1 rounded-lg bg-rose-800 hover:bg-rose-700 text-white font-semibold transition-colors"
            >
              Reconnect Now
            </button>
          )}
        </div>
      )}

      {/* Main Tabletop Playing Surface */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 max-w-7xl mx-auto w-full space-y-4">
        {/* Status Prompt Line */}
        <div className="w-full max-w-4xl flex items-center justify-between text-[11px] font-mono text-stone-400 px-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-stone-300">{statusMessage}</span>
          </div>
          <div className="text-stone-500">
            Authoritative Engine v2.4 · Server Randomness
          </div>
        </div>

        {/* 1. The 24-Tile Circuit Tabletop */}
        <div className="w-full flex justify-center">
          <TabletopBoard
            players={players}
            turnPlayerId={turnPlayerId}
            validMovePositions={validMovePositions}
            hasRolledThisTurn={hasRolledThisTurn}
            hasMovedThisTurn={hasMovedThisTurn}
            onTileClick={handleMovePiece}
            onSelectInspectTile={setSelectedInspectTile}
            selectedInspectTile={selectedInspectTile}
            cameraMode={cameraMode}
            onChangeCameraMode={setCameraMode}
            zoom={zoom}
            onChangeZoom={handleZoomChange}
            cooperativeHarmonyScore={cooperativeHarmonyScore}
          />
        </div>

        {/* 2. Tactical Controls Lower Deck (Dice Tumbler & Card Hand) */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left: Authoritative Dice Tumbler */}
          <div className="md:col-span-1">
            <DiceCup
              isCurrentTurn={turnPlayerId === activePlayerId}
              hasRolled={hasRolledThisTurn}
              currentDiceValue={currentDiceValue}
              secondDiceValue={secondDiceValue}
              effectiveDistance={effectiveDistance}
              activePowerThisTurn={activePowerThisTurn}
              isRolling={isSubmitting}
              onRollDice={handleRollDice}
              disabled={isPaused || isLocalDisconnected}
            />
          </div>

          {/* Right: Tactical Cards Hand */}
          <div className="md:col-span-2">
            <PowerCardDeck
              powers={activeLocalPlayerState.powers || []}
              isCurrentTurn={turnPlayerId === activePlayerId}
              hasRolled={hasRolledThisTurn}
              hasMoved={hasMovedThisTurn}
              activePowerThisTurn={activePowerThisTurn}
              onUsePower={handleUsePower}
              disabled={isPaused || isLocalDisconnected}
            />
          </div>
        </div>

        {/* 3. Sticky Turn Bar */}
        <div className="w-full max-w-4xl pt-2">
          <TabletopTurnBar
            turnPlayerId={turnPlayerId}
            activeLocalPlayerId={activePlayerId}
            players={players}
            turnNumber={turnNumber}
            hasRolled={hasRolledThisTurn}
            hasMoved={hasMovedThisTurn}
            isPaused={isPaused}
            roundDeadlineServer={gameState?.roundDeadlineServer || Date.now() + 45000}
            onMovePiece={() => handleMovePiece()}
            onEndTurn={handleEndTurn}
            onTogglePause={handleTogglePause}
            onToggleDisconnect={handleToggleDisconnect}
            isSubmittingAction={isSubmitting}
          />
        </div>
      </main>

      {/* Floating Video Overlay Companion */}
      {showVideoCompanion && (
        <div className="fixed bottom-4 right-4 z-40 max-w-xs shadow-2xl">
          <GameRoomVideoCompanion
            roomId={gameId}
            myUserId={activePlayerId}
            partnerId={partnerId}
            myDisplayName={PLAYER_METAS[activePlayerId]?.name || "Alex"}
            myCity={PLAYER_METAS[activePlayerId]?.city || "London"}
            partnerDisplayName={PLAYER_METAS[partnerId]?.name || "Sam"}
            partnerCity={PLAYER_METAS[partnerId]?.city || "Tokyo"}
          />
        </div>
      )}

      {/* Rules & Lore Modal */}
      {showRulesGuide && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#171615] border border-stone-800 p-6 space-y-4 shadow-2xl text-stone-200">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2 text-amber-300 font-serif font-bold text-base">
                <Compass className="w-5 h-5" />
                <span>The Meridian Circuit Rules</span>
              </div>
              <button
                onClick={() => setShowRulesGuide(false)}
                className="text-stone-400 hover:text-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-300 leading-relaxed font-sans">
              <div className="p-3 rounded-xl bg-stone-900/80 border border-stone-800 space-y-1">
                <strong className="text-amber-300 font-serif text-sm block">Objective</strong>
                <p>
                  Be the first navigator to complete 2 authoritative laps (48 tiles) around the
                  hand-carved 24-node Meridian Circuit.
                </p>
              </div>

              <div className="space-y-2">
                <strong className="text-stone-100 font-mono text-[11px] uppercase tracking-wider block">
                  Authoritative Mechanics
                </strong>
                <ul className="space-y-1.5 list-disc list-inside text-stone-400">
                  <li>
                    <strong className="text-stone-200">Roll Dice:</strong> The server computes a
                    cryptographically unbiased roll (1–6).
                  </li>
                  <li>
                    <strong className="text-stone-200">Move:</strong> Advance your carved token to the
                    highlighted tile. Passing Meridian Arch scores a Lap completion.
                  </li>
                  <li>
                    <strong className="text-stone-200">Scriptorium Vaults:</strong> Unlock tactical cards
                    like Wind Stride (+2) and Harmony Leap.
                  </li>
                  <li>
                    <strong className="text-stone-200">Twin Fountains:</strong> Proximity within 3 tiles
                    awards both navigators a mutual Harmony synchrony bonus.
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowRulesGuide(false)}
              className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-mono text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              Return to Expedition
            </button>
          </div>
        </div>
      )}

      {/* Game End Results Modal */}
      {isGameEnd && (
        <RaceResultsModal
          winnerId={winnerId}
          players={players}
          scores={scores}
          cooperativeHarmonyScore={cooperativeHarmonyScore}
          history={roundHistory}
          onRematch={handleRematch}
          onExit={() => router.push("/play")}
          isRematching={isSubmitting}
        />
      )}
    </div>
  );
};

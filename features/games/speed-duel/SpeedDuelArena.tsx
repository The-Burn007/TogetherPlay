"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Volume2,
  VolumeX,
  RefreshCw,
  Trophy,
  Video,
  VideoOff,
  Keyboard,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { SpeedDuelCentralTarget } from "./SpeedDuelCentralTarget";
import { SpeedDuelTimer } from "./SpeedDuelTimer";
import { SpeedDuelPlayerStrip } from "./SpeedDuelPlayerStrip";
import { speedDuelAudio } from "./speedDuelAudio";
import { GameRoomVideoCompanion } from "@/features/video/GameRoomVideoCompanion";
import { authoritativeGameClient } from "@/lib/firebase/services/authoritativeGameClient";
import type {
  GameSession,
  GameState,
  SpeedDuelStage,
} from "@/types/domain";

interface SpeedDuelArenaProps {
  initialGameId?: string;
  defaultPlayerId?: string;
}

export const SpeedDuelArena: React.FC<SpeedDuelArenaProps> = ({
  initialGameId = "speed_duel_core",
  defaultPlayerId = "user_alex",
}) => {
  const [gameId, setGameId] = useState(initialGameId);
  const [activePlayerId, setActivePlayerId] = useState(defaultPlayerId);
  const [session, setSession] = useState<GameSession | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  // Audio & video companion toggles
  const [isMuted, setIsMuted] = useState(false);
  const [showVideoCompanion, setShowVideoCompanion] = useState(true);

  // Local client stage and countdown
  const [localStage, setLocalStage] = useState<SpeedDuelStage>("ready");
  const [countdownNum, setCountdownNum] = useState(3);
  const [hasReactedThisRound, setHasReactedThisRound] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("Ready for Speed Duel");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [competitiveMode, setCompetitiveMode] = useState<"first_to_3" | "standard_5">("first_to_3");

  // Ref tracking current trigger timer
  const triggerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Extract server data
  const serverData = (gameState?.data || {}) as Record<string, unknown>;
  const roundWinnerId = (serverData.roundWinnerId as string) || null;
  const roundWinnerReactionMs = (serverData.roundWinnerReactionMs as number) || null;
  const isFalseStart = Boolean(serverData.roundWinnerReason === "opponent_false_start" || serverData.isFalseStart);
  const falseStartPlayerId = (serverData.falseStartPlayerId as string) || null;
  const targetAppearedAtServer = Number(serverData.targetAppearedAtServer) || 0;
  const tensionDelayMs = Number(serverData.tensionDelayMs) || 2000;
  const roundHistory = Array.isArray(serverData.roundHistory) ? (serverData.roundHistory as Array<Record<string, unknown>>) : [];

  // Match scores and wins
  const alexWins = roundHistory.filter((r) => r.winnerId === "user_alex").length;
  const samWins = roundHistory.filter((r) => r.winnerId === "user_sam").length;
  const targetWins = competitiveMode === "first_to_3" ? 3 : 5;

  const isGameEnd = gameState?.status === "game_end" || localStage === "game_end";

  // Audio mute handler
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    speedDuelAudio.setMuted(next);
  };

  // Sync state and stages
  const handleGameStateUpdate = useCallback((state: GameState | null) => {
    if (!state) return;
    setGameState(state);

    const data = (state.data || {}) as Record<string, unknown>;
    const serverStage = (data.roundStage as SpeedDuelStage) || (state.status as SpeedDuelStage);

    if (state.status === "game_end" || serverStage === "game_end") {
      setLocalStage("game_end");
      speedDuelAudio.stopTensionDrone();
    } else if (state.status === "round_end" || serverStage === "round_result") {
      setLocalStage("round_result");
      speedDuelAudio.stopTensionDrone();
    } else if (state.status === "playing" && serverStage === "tension") {
      setLocalStage("tension");
      setHasReactedThisRound(false);
    }
  }, []);

  // Initialize or connect to authoritative game session
  useEffect(() => {
    let isSubscribed = true;

    async function initSession() {
      try {
        const { session: s, state: st } = await authoritativeGameClient.ensureGameSession(
          gameId,
          ["user_alex", "user_sam"],
          false,
          "speed_duel"
        );
        if (isSubscribed) {
          setSession(s);
          setGameState(st);
          handleGameStateUpdate(st);
        }
      } catch (err) {
        console.warn("[SpeedDuel] Failed to init session:", err);
      }
    }

    initSession();

    // Subscribe to realtime state updates
    const unsubState = authoritativeGameClient.subscribeToEphemeralState(gameId, (st) => {
      if (isSubscribed && st) {
        handleGameStateUpdate(st);
      }
    });

    const unsubSession = authoritativeGameClient.subscribeToDurableSession(gameId, (s) => {
      if (isSubscribed && s) {
        setSession(s);
      }
    });

    return () => {
      isSubscribed = false;
      unsubState();
      unsubSession();
    };
  }, [gameId, handleGameStateUpdate]);

  // Stage transition management (Tension -> Target Trigger)
  useEffect(() => {
    if (localStage === "tension" && targetAppearedAtServer > 0) {
      speedDuelAudio.startTensionDrone();
      setStatusMessage("Hold your nerve... waiting for signal");

      // Calculate when target should appear locally based on authoritative server plan
      const delayUntilTarget = Math.max(50, targetAppearedAtServer - Date.now());

      if (triggerTimeoutRef.current) clearTimeout(triggerTimeoutRef.current);

      triggerTimeoutRef.current = setTimeout(() => {
        setLocalStage("active");
        speedDuelAudio.playTargetTrigger();
        setStatusMessage("STRIKE NOW!");

        // Fire authoritative trigger confirmation
        authoritativeGameClient
          .submitAction(gameId, "TRIGGER_TARGET", {}, activePlayerId)
          .catch(() => {});
      }, delayUntilTarget);
    }

    return () => {
      if (triggerTimeoutRef.current) clearTimeout(triggerTimeoutRef.current);
    };
  }, [localStage, targetAppearedAtServer, gameId, activePlayerId]);

  // Stop tension audio when stage changes
  useEffect(() => {
    if (localStage !== "tension") {
      speedDuelAudio.stopTensionDrone();
    }
  }, [localStage]);

  // Handle Target Click / Strike
  const handleTargetClick = async () => {
    if (hasReactedThisRound && localStage !== "tension") return;
    if (isSubmitting) return;

    setHasReactedThisRound(true);
    setIsSubmitting(true);

    // Audio cue
    if (localStage === "tension") {
      speedDuelAudio.playFalseStart();
      setStatusMessage("Early strike registered! Verifying with server...");
    } else {
      speedDuelAudio.playRoundWinner();
      setStatusMessage("Reaction dispatched! Awaiting authoritative result...");
    }

    try {
      // SECURITY: Timestamp is recorded on the SERVER upon action arrival.
      // Client timestamp is never trusted for game outcome.
      const result = await authoritativeGameClient.submitAction(
        gameId,
        "SUBMIT_REACTION",
        { round: gameState?.currentRound || 1 },
        activePlayerId
      );

      if (result.accepted && result.gameState) {
        handleGameStateUpdate(result.gameState);

        const payload = (result.payload || {}) as Record<string, unknown>;
        if (payload.isFalseStart) {
          speedDuelAudio.playFalseStart();
          setStatusMessage("Server confirmed False Start! Round awarded to opponent.");
        } else if (payload.isWinner) {
          speedDuelAudio.playRoundWinner();
          setStatusMessage(
            `Round claimed! Server verified: ${payload.reactionTimeMs}ms (+${payload.pointsAwarded} pts)`
          );
        } else if (payload.alreadyResolved) {
          setStatusMessage(`Opponent struck first (+${payload.deltaMs}ms gap).`);
        }
      }
    } catch (err) {
      console.warn("[SpeedDuel] Action error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard Spacebar trigger
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && (localStage === "tension" || localStage === "active")) {
        e.preventDefault();
        handleTargetClick();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Start Countdown Flow
  const handleStartMatch = async () => {
    setLocalStage("countdown");
    setCountdownNum(3);
    speedDuelAudio.playCountdownTick(false);
    setStatusMessage("Match launching in 3...");

    let count = 3;
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(async () => {
      count -= 1;
      setCountdownNum(count);

      if (count > 0) {
        speedDuelAudio.playCountdownTick(false);
        setStatusMessage(`Match launching in ${count}...`);
      } else {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        speedDuelAudio.playCountdownTick(true);

        try {
          const res = await authoritativeGameClient.submitAction(
            gameId,
            "START_GAME",
            {},
            activePlayerId
          );
          if (res.accepted && res.gameState) {
            handleGameStateUpdate(res.gameState);
            setLocalStage("tension");
          }
        } catch (err) {
          console.warn("[SpeedDuel] Start error:", err);
          setLocalStage("ready");
        }
      }
    }, 900);
  };

  // Next Round Flow
  const handleNextRound = async () => {
    setIsSubmitting(true);
    speedDuelAudio.playTransition();
    setHasReactedThisRound(false);

    try {
      const res = await authoritativeGameClient.submitAction(
        gameId,
        "NEXT_ROUND",
        {},
        activePlayerId
      );
      if (res.accepted && res.gameState) {
        handleGameStateUpdate(res.gameState);
        setLocalStage("tension");
        setStatusMessage(`Round ${res.gameState.currentRound} armed`);
      }
    } catch (err) {
      console.warn("[SpeedDuel] Next round error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Rematch Flow
  const handleRematch = async () => {
    setIsSubmitting(true);
    speedDuelAudio.playTransition();
    setHasReactedThisRound(false);

    try {
      const res = await authoritativeGameClient.submitAction(
        gameId,
        "REMATCH",
        {},
        activePlayerId
      );
      if (res.accepted && res.gameState) {
        handleGameStateUpdate(res.gameState);
        setLocalStage("tension");
        setStatusMessage("Rematch underway! Prepare for tension.");
      }
    } catch (err) {
      console.warn("[SpeedDuel] Rematch error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick switch active player for seamless two-player testing in single or multi tabs
  const handleSwitchPlayer = (newPid: string) => {
    setActivePlayerId(newPid);
    setStatusMessage(`Switched active controller to ${newPid === "user_alex" ? "Alex (London)" : "Sam (Tokyo)"}`);
  };

  // False start player name
  const falseStartPlayerName = falseStartPlayerId === "user_alex" ? "Alex" : "Sam";
  const winnerPlayerName = roundWinnerId === "user_alex" ? "Alex" : "Sam";

  return (
    <div
      id="speed-duel-container"
      className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-between p-4 sm:p-6 max-w-5xl mx-auto overflow-hidden text-neutral-200"
    >
      {/* Background ambient gradient highlighting tension */}
      <div className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center opacity-30">
        <div
          className={`w-[600px] h-[600px] rounded-full blur-[120px] transition-colors duration-700 ${
            localStage === "active"
              ? "bg-amber-500/20"
              : isFalseStart
              ? "bg-rose-600/15"
              : localStage === "tension"
              ? "bg-amber-600/10"
              : "bg-neutral-800/10"
          }`}
        />
      </div>

      {/* Top Header: Title, Round Indicator, Controls */}
      <header id="speed-duel-header" className="w-full flex items-center justify-between border-b border-neutral-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-sm">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-neutral-100">
                Speed Duel
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-400 uppercase">
                {competitiveMode === "first_to_3" ? "Championship (First to 3)" : "Standard (5 Rounds)"}
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Authoritative real-time reaction game · Untrusted client timestamps
            </p>
          </div>
        </div>

        {/* Action Controls: Audio, Video Companion, Role Switch */}
        <div className="flex items-center gap-2">
          {/* Controller Switcher (Allows testing both players seamlessly) */}
          <div className="hidden sm:flex items-center rounded-lg bg-neutral-900 border border-neutral-800 p-0.5">
            <button
              id="switch-player-alex-btn"
              type="button"
              onClick={() => handleSwitchPlayer("user_alex")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                activePlayerId === "user_alex"
                  ? "bg-amber-500/20 text-amber-300 font-semibold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Alex (Ember)
            </button>
            <button
              id="switch-player-sam-btn"
              type="button"
              onClick={() => handleSwitchPlayer("user_sam")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                activePlayerId === "user_sam"
                  ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Sam (Sage)
            </button>
          </div>

          <button
            id="toggle-video-overlay-btn"
            type="button"
            onClick={() => setShowVideoCompanion(!showVideoCompanion)}
            title={showVideoCompanion ? "Hide video companion" : "Show video companion"}
            className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 transition-colors"
          >
            {showVideoCompanion ? <Video className="w-4 h-4 text-emerald-400" /> : <VideoOff className="w-4 h-4 text-neutral-400" />}
          </button>

          <button
            id="toggle-audio-btn"
            type="button"
            onClick={handleToggleMute}
            title={isMuted ? "Unmute sound" : "Mute sound"}
            className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-neutral-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>
        </div>
      </header>

      {/* Player Indicators Strip */}
      <section id="speed-duel-player-section" className="w-full mt-4">
        <SpeedDuelPlayerStrip
          player1Name="Alex Chen"
          player1City="London · GMT"
          player1Score={gameState?.scores?.user_alex || 0}
          player1Wins={alexWins}
          player1ReactionMs={
            roundWinnerId === "user_alex"
              ? roundWinnerReactionMs
              : (serverData.playerReactions as Record<string, number>)?.user_alex
          }
          player1Status={
            falseStartPlayerId === "user_alex"
              ? "false_start"
              : roundWinnerId === "user_alex"
              ? "winner"
              : localStage === "active"
              ? "reacted"
              : "holding"
          }
          player2Name="Sam Tanaka"
          player2City="Tokyo · JST"
          player2Score={gameState?.scores?.user_sam || 0}
          player2Wins={samWins}
          player2ReactionMs={
            roundWinnerId === "user_sam"
              ? roundWinnerReactionMs
              : (serverData.playerReactions as Record<string, number>)?.user_sam
          }
          player2Status={
            falseStartPlayerId === "user_sam"
              ? "false_start"
              : roundWinnerId === "user_sam"
              ? "winner"
              : localStage === "active"
              ? "reacted"
              : "holding"
          }
          activePlayerId={activePlayerId}
          targetWinsToMatch={targetWins}
          stage={localStage}
        />
      </section>

      {/* Main Duel Stage: Timer + Central Target */}
      <main id="speed-duel-core-stage" className="flex-1 flex flex-col items-center justify-center w-full py-4 space-y-4">
        {/* Large Chrono Timer */}
        <SpeedDuelTimer
          stage={localStage}
          targetAppearedAtServer={targetAppearedAtServer}
          lockedReactionMs={roundWinnerReactionMs}
          countdownNumber={countdownNum}
        />

        {/* Large Central Target */}
        <SpeedDuelCentralTarget
          stage={localStage}
          targetActive={localStage === "active"}
          roundWinnerId={roundWinnerId}
          roundWinnerReactionMs={roundWinnerReactionMs}
          winnerPlayerName={winnerPlayerName}
          isFalseStart={isFalseStart}
          falseStartPlayerName={falseStartPlayerName}
          activePlayerId={activePlayerId}
          hasReacted={hasReactedThisRound}
          onTargetClick={handleTargetClick}
          disabled={localStage === "ready" || isGameEnd}
        />

        {/* Reaction State Feedback Pill */}
        <div id="speed-duel-status-announcer" className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900/90 border border-neutral-800 text-xs font-mono text-neutral-300">
            {localStage === "tension" && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
            {localStage === "active" && <span className="w-2 h-2 rounded-full bg-amber-400" />}
            {isFalseStart && <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />}
            <span>{statusMessage}</span>
          </div>

          <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-400">
            <span className="flex items-center gap-1">
              <Keyboard className="w-3 h-3" />
              <span>Tap target or press <strong className="text-neutral-300 font-mono">Space</strong> to strike</span>
            </span>
          </div>
        </div>
      </main>

      {/* Match Actions / Navigation */}
      <footer id="speed-duel-footer-actions" className="w-full flex items-center justify-between border-t border-neutral-800/80 pt-4">
        <div className="text-xs font-mono text-neutral-400">
          Round <strong className="text-neutral-200">{gameState?.currentRound || 1}</strong> of {gameState?.maxRounds || 5}
        </div>

        <div className="flex items-center gap-3">
          {localStage === "ready" && (
            <button
              id="start-speed-duel-btn"
              type="button"
              onClick={handleStartMatch}
              className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-sm tracking-wide transition-all shadow-lg active:scale-95 flex items-center gap-2"
            >
              <span>Begin Duel</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {localStage === "round_result" && !isGameEnd && (
            <button
              id="next-round-btn"
              type="button"
              disabled={isSubmitting}
              onClick={handleNextRound}
              className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-sm tracking-wide transition-all shadow-lg active:scale-95 flex items-center gap-2"
            >
              <span>Next Round</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {isGameEnd && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs font-mono text-amber-300">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Match Winner: {alexWins > samWins ? "Alex Chen" : "Sam Tanaka"}</span>
              </div>
              <button
                id="rematch-btn"
                type="button"
                disabled={isSubmitting}
                onClick={handleRematch}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-sm transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Rematch</span>
              </button>
            </div>
          )}
        </div>
      </footer>

      {/* Video Overlay Companion */}
      {showVideoCompanion && (
        <GameRoomVideoCompanion
          roomId={`speed_duel_${gameId}`}
          myUserId={activePlayerId}
          partnerId={activePlayerId === "user_alex" ? "user_sam" : "user_alex"}
          myDisplayName={activePlayerId === "user_alex" ? "Alex Chen" : "Sam Tanaka"}
          myCity={activePlayerId === "user_alex" ? "London" : "Tokyo"}
          partnerDisplayName={activePlayerId === "user_alex" ? "Sam Tanaka" : "Alex Chen"}
          partnerCity={activePlayerId === "user_alex" ? "Tokyo" : "London"}
        />
      )}
    </div>
  );
};

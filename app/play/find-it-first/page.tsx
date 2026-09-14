"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { GameBoardGrid } from "@/features/games/GameBoardGrid";
import { useToast } from "@/components/ui/Toast";
import {
  ChevronLeft,
  Wifi,
  Users,
  Sparkles,
  SplitSquareVertical,
  Volume2,
  VolumeX,
} from "lucide-react";
import { authoritativeGameClient } from "@/lib/firebase/services/authoritativeGameClient";
import { tabletopAudio } from "@/features/games/find-it-first/soundEffects";
import {
  LobbyView,
  CountdownView,
  TargetRevealCard,
  RoundResultOverlay,
  FinalResultModal,
} from "@/features/games/find-it-first/FlowComponents";
import type { GameSession, GameState } from "@/types/domain";

export default function FindItFirstRoomPage() {
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  // Room & Identity setup
  const urlGameId = searchParams.get("gameId") || "fif_togetherplay_tabletop";
  const urlPlayer = searchParams.get("player");
  const [activePlayerId, setActivePlayerId] = useState<string>(
    urlPlayer === "sam" ? "user_sam" : "user_alex"
  );
  const [dualSessionMode, setDualSessionMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Authoritative State from Server
  const [session, setSession] = useState<GameSession | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Local feedback & timer animation states
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [countdownNumber, setCountdownNumber] = useState(3);
  const [remainingSeconds, setRemainingSeconds] = useState(15);
  const lastKnownRoundRef = useRef<number>(1);
  const lastKnownWinnerRef = useRef<string | null>(null);

  // Initialize or ensure authoritative game session on the server
  const initGame = useCallback(async () => {
    try {
      setIsLoading(true);
      const aggregate = await authoritativeGameClient.ensureGameSession(
        urlGameId,
        ["user_alex", "user_sam"],
        false
      );
      setSession(aggregate.session);
      setGameState(aggregate.state);
    } catch (err) {
      console.error("Failed to init game:", err);
      showToast("Connected in offline preview mode.");
    } finally {
      setIsLoading(false);
    }
  }, [urlGameId, showToast]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // Real-time server state sync (RTDB + high-frequency aggregate sync)
  useEffect(() => {
    if (!urlGameId) return;

    // 1. RTDB subscription if live backend active
    const unsubscribeRtdb = authoritativeGameClient.subscribeToEphemeralState(
      urlGameId,
      (state) => {
        if (state) setGameState(state);
      }
    );

    // 2. Continuous authoritative sync poll
    const pollInterval = setInterval(async () => {
      try {
        const agg = await authoritativeGameClient.fetchGameAggregate(urlGameId);
        if (agg) {
          setSession(agg.session);
          setGameState(agg.state);
        }
      } catch {
        // Fallback
      }
    }, 600);

    return () => {
      unsubscribeRtdb();
      clearInterval(pollInterval);
    };
  }, [urlGameId]);

  // Countdown effect when state is 'countdown'
  useEffect(() => {
    if (gameState?.status !== "countdown") return;

    setCountdownNumber(3);
    if (soundEnabled) tabletopAudio.playTick();

    const timer = setInterval(() => {
      setCountdownNumber((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Automatically trigger START_GAME authoritatively when countdown completes
          authoritativeGameClient
            .submitAction(urlGameId, "START_GAME", {}, activePlayerId)
            .catch(() => {});
          return 0;
        }
        if (soundEnabled) tabletopAudio.playTick();
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState?.status, urlGameId, activePlayerId, soundEnabled]);

  // Authoritative Round Timer
  useEffect(() => {
    if (gameState?.status !== "playing") return;

    const updateTimer = () => {
      const now = Date.now();
      const deadline = gameState.roundDeadlineServer || now + 15000;
      const left = Math.max(0, Math.ceil((deadline - now) / 1000));
      setRemainingSeconds(left);

      if (left <= 3 && left > 0 && soundEnabled) {
        tabletopAudio.playTick();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [gameState?.status, gameState?.roundDeadlineServer, soundEnabled]);

  // Detect state transitions and trigger tactile sound cues
  useEffect(() => {
    if (!gameState) return;

    // Round change sound
    if (gameState.currentRound !== lastKnownRoundRef.current) {
      lastKnownRoundRef.current = gameState.currentRound;
      if (soundEnabled) tabletopAudio.playRoundTransition();
    }

    // Round won sound
    const winnerId = (gameState.data?.roundWinnerId as string) || null;
    if (winnerId && winnerId !== lastKnownWinnerRef.current) {
      lastKnownWinnerRef.current = winnerId;
      if (soundEnabled) tabletopAudio.playCorrectChime();
    } else if (!winnerId) {
      lastKnownWinnerRef.current = null;
    }

    // Final game victory
    if (gameState.status === "game_end" || gameState.isFinished) {
      if (soundEnabled) tabletopAudio.playVictoryFanfare();
    }
  }, [gameState, soundEnabled]);

  // ==========================================
  // AUTHORITATIVE ACTION HANDLERS
  // ==========================================

  // 1. Declare Ready
  const handleToggleReady = async (overridePlayerId?: string) => {
    const actingUid = overridePlayerId || activePlayerId;
    try {
      setIsSubmitting(true);
      const res = await authoritativeGameClient.submitAction(
        urlGameId,
        "READY",
        {},
        actingUid
      );
      if (res.accepted) {
        if (soundEnabled) tabletopAudio.playSelectTile();
        showToast(`Player declared ready for the match.`);
      }
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Start Game
  const handleStartGame = async () => {
    try {
      setIsSubmitting(true);
      await authoritativeGameClient.submitAction(
        urlGameId,
        "START_GAME",
        {},
        activePlayerId
      );
      if (soundEnabled) tabletopAudio.playRoundTransition();
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Select Cell (THE ONLY CLIENT GAMEPLAY ACTION)
  const handleSelectCell = async (cellId: string, overridePlayerId?: string) => {
    const actingUid = overridePlayerId || activePlayerId;
    if (gameState?.status !== "playing") return;

    setSelectedCellId(cellId);
    if (soundEnabled) tabletopAudio.playSelectTile();

    try {
      // SECURITY MANDATE:
      // Client submits ONLY { cellId }.
      // The server determines whether the selection is correct.
      const result = await authoritativeGameClient.submitAction(
        urlGameId,
        "SELECT_CELL",
        { cellId },
        actingUid
      );

      const payload = result.payload as
        | { isCorrect?: boolean; pointsAwarded?: number; penalty?: number }
        | undefined;

      if (payload?.isCorrect) {
        if (soundEnabled) tabletopAudio.playCorrectChime();
        const playerName = actingUid === "user_alex" ? "Alex" : "Sam";
        showToast(`Correct! ${playerName} won the round (+${payload.pointsAwarded} pts)`);
      } else {
        if (soundEnabled) tabletopAudio.playIncorrectThud();
        showToast(`Incorrect artifact. -${payload?.penalty || 10} pts. Keep looking!`);
      }
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  // 4. Next Round
  const handleNextRound = async () => {
    try {
      setIsSubmitting(true);
      await authoritativeGameClient.submitAction(
        urlGameId,
        "NEXT_ROUND",
        {},
        activePlayerId
      );
      if (soundEnabled) tabletopAudio.playRoundTransition();
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Rematch
  const handleRematch = async () => {
    try {
      setIsSubmitting(true);
      await authoritativeGameClient.submitAction(
        urlGameId,
        "REMATCH",
        {},
        activePlayerId
      );
      if (soundEnabled) tabletopAudio.playRoundTransition();
      showToast("Match restarted! Taking seats for Round 1...");
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Derived state properties
  const currentStatus = gameState?.status || "ready";
  const currentRound = gameState?.currentRound || 1;
  const maxRounds = gameState?.maxRounds || 5;
  const targetId = String(gameState?.data?.targetId || "watch");
  const targetName = String(gameState?.data?.targetName || "Pocket Watch");
  const targetCode = String(gameState?.data?.targetCode || "#01");
  const targetClue = String(
    gameState?.data?.targetClue || "Precision horology with mechanical escapement"
  );
  const board = Array.isArray(gameState?.data?.board)
    ? (gameState?.data?.board as string[])
    : ["watch", "compass", "key", "seal", "pen", "hourglass", "prism", "book", "camera", "bell", "monocle", "mug"];

  const roundWinnerId = (gameState?.data?.roundWinnerId as string) || null;
  const winningCellId = (gameState?.data?.roundWinningCell as string) || null;
  const lastMistake = gameState?.data?.lastMistake as
    | { playerId: string; cellId: string; penalty: number }
    | undefined;

  const mistakeCellId = lastMistake?.cellId || null;
  const winnerPlayerName =
    roundWinnerId === "user_alex"
      ? "Alex"
      : roundWinnerId === "user_sam"
      ? "Sam"
      : null;

  const pointsAwarded = Number(gameState?.data?.pointsAwarded || 100);
  const speedBonus = Number(gameState?.data?.speedBonus || 0);

  const scores = gameState?.scores || { user_alex: 0, user_sam: 0 };
  const readyPlayerIds = session?.readyPlayerIds || [];

  return (
    <Container size="md" className="space-y-4 pt-14 pb-20 max-w-4xl">
      {/* 1. Antiquarian Tabletop Navigation Bar */}
      <div className="flex items-center justify-between bg-[#1e1916] border border-amber-900/50 rounded-2xl p-3 shadow-xl">
        <Link
          href="/play"
          className="flex items-center gap-1.5 text-xs font-mono text-stone-400 hover:text-amber-200 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Exit Saloon</span>
        </Link>

        {/* Live Authoritative Score Tracker */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 font-mono text-xs sm:text-sm font-semibold">
            <span
              className={`px-2 py-0.5 rounded ${
                activePlayerId === "user_alex"
                  ? "bg-amber-950 text-amber-400 border border-amber-800"
                  : "text-amber-300"
              }`}
            >
              Alex {scores["user_alex"] || 0}
            </span>
            <span className="text-stone-600">·</span>
            <span
              className={`px-2 py-0.5 rounded ${
                activePlayerId === "user_sam"
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                  : "text-emerald-300"
              }`}
            >
              Sam {scores["user_sam"] || 0}
            </span>
          </div>

          <span className="text-[10px] font-mono uppercase bg-black/60 px-2.5 py-1 rounded-md border border-amber-900/40 text-amber-400 font-bold">
            Round {currentRound} / {maxRounds}
          </span>
        </div>

        {/* Utility Controls (Sound, Dual Mode, Latency) */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            id="toggle-sound-btn"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg bg-black/40 text-stone-400 hover:text-amber-300 transition-colors"
            title={soundEnabled ? "Mute audio" : "Enable sound"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            id="dual-mode-header-btn"
            onClick={() => setDualSessionMode(!dualSessionMode)}
            className={`hidden sm:flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded border transition-colors ${
              dualSessionMode
                ? "bg-amber-950/80 border-amber-600 text-amber-300"
                : "bg-black/40 border-stone-800 text-stone-400"
            }`}
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span>Dual View</span>
          </button>

          <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
            <Wifi className="w-3 h-3" />
            <span>24ms</span>
          </div>
        </div>
      </div>

      {/* Main Tabletop Arena */}
      {currentStatus === "ready" || currentStatus === "waiting" ? (
        <LobbyView
          gameId={urlGameId}
          playerIds={session?.playerIds || ["user_alex", "user_sam"]}
          readyPlayerIds={readyPlayerIds}
          currentUserId={activePlayerId}
          onToggleReady={() => handleToggleReady(activePlayerId)}
          onStartGame={handleStartGame}
          dualSessionMode={dualSessionMode}
          onToggleDualSession={() => setDualSessionMode(!dualSessionMode)}
          isReadying={isSubmitting}
        />
      ) : currentStatus === "countdown" ? (
        <CountdownView countdownNumber={countdownNumber} />
      ) : currentStatus === "game_end" ? (
        <FinalResultModal
          scores={scores}
          onRematch={handleRematch}
          roundHistory={
            gameState?.data?.roundHistory as Array<{
              round: number;
              winnerId: string;
              targetName: string;
              pointsAwarded: number;
            }>
          }
        />
      ) : (
        /* Active Round View: Target + Board + Overlays */
        <div className="space-y-4">
          {/* Target Card with Entrance Animation & Clue */}
          <TargetRevealCard
            targetId={targetId}
            targetName={targetName}
            targetCode={targetCode}
            targetClue={targetClue}
            round={currentRound}
            maxRounds={maxRounds}
            remainingSeconds={remainingSeconds}
          />

          {/* Round Result Overlay if round completed */}
          {currentStatus === "round_end" ? (
            <RoundResultOverlay
              round={currentRound}
              winnerPlayerId={roundWinnerId}
              pointsAwarded={pointsAwarded}
              speedBonus={speedBonus}
              targetName={targetName}
              onNextRound={handleNextRound}
              isLastRound={currentRound >= maxRounds}
            />
          ) : null}

          {/* DUAL SESSION HARNESS: Alex (London) & Sam (Tokyo) Racing Authoritatively */}
          {dualSessionMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Session 1: Alex (London) */}
              <div className="space-y-2 rounded-2xl p-3 bg-[#171412] border border-amber-900/40 shadow-xl">
                <div className="flex items-center justify-between px-1 text-xs font-mono">
                  <span className="font-bold text-amber-400">Player 1: Alex (London)</span>
                  <span className="text-[10px] text-stone-500">
                    Score: {scores["user_alex"] || 0}
                  </span>
                </div>
                <GameBoardGrid
                  board={board}
                  onSelectCell={(cellId) => handleSelectCell(cellId, "user_alex")}
                  disabled={currentStatus !== "playing"}
                  selectedCellId={activePlayerId === "user_alex" ? selectedCellId : null}
                  winningCellId={winningCellId}
                  mistakeCellId={lastMistake?.playerId === "user_alex" ? mistakeCellId : null}
                  winnerPlayerName={winnerPlayerName}
                />
              </div>

              {/* Session 2: Sam (Tokyo) */}
              <div className="space-y-2 rounded-2xl p-3 bg-[#171412] border border-emerald-900/40 shadow-xl">
                <div className="flex items-center justify-between px-1 text-xs font-mono">
                  <span className="font-bold text-emerald-400">Player 2: Sam (Tokyo)</span>
                  <span className="text-[10px] text-stone-500">
                    Score: {scores["user_sam"] || 0}
                  </span>
                </div>
                <GameBoardGrid
                  board={board}
                  onSelectCell={(cellId) => handleSelectCell(cellId, "user_sam")}
                  disabled={currentStatus !== "playing"}
                  selectedCellId={activePlayerId === "user_sam" ? selectedCellId : null}
                  winningCellId={winningCellId}
                  mistakeCellId={lastMistake?.playerId === "user_sam" ? mistakeCellId : null}
                  winnerPlayerName={winnerPlayerName}
                />
              </div>
            </div>
          ) : (
            /* Single Session View */
            <div className="space-y-2">
              <div className="flex items-center justify-between px-2 text-xs font-mono text-stone-400">
                <span>
                  Playing as:{" "}
                  <strong className={activePlayerId === "user_alex" ? "text-amber-400" : "text-emerald-400"}>
                    {activePlayerId === "user_alex" ? "Alex (London)" : "Sam (Tokyo)"}
                  </strong>
                </span>
                <button
                  onClick={() =>
                    setActivePlayerId(activePlayerId === "user_alex" ? "user_sam" : "user_alex")
                  }
                  className="underline hover:text-stone-200"
                >
                  Switch Player
                </button>
              </div>
              <GameBoardGrid
                board={board}
                onSelectCell={(cellId) => handleSelectCell(cellId, activePlayerId)}
                disabled={currentStatus !== "playing"}
                selectedCellId={selectedCellId}
                winningCellId={winningCellId}
                mistakeCellId={mistakeCellId}
                winnerPlayerName={winnerPlayerName}
              />
            </div>
          )}
        </div>
      )}

      {/* Dual Browser Instructions Note */}
      <div className="rounded-xl p-3 bg-black/40 border border-stone-800/80 text-center text-xs font-mono text-stone-400 space-y-1">
        <p>
          <span className="text-amber-400 font-bold">Simultaneous Multi-Browser Testing:</span> Open this link in another tab with{" "}
          <code className="text-stone-300 bg-stone-900 px-1.5 py-0.5 rounded">?player=sam</code> to test live synchronization across independent browser tabs!
        </p>
      </div>
    </Container>
  );
}

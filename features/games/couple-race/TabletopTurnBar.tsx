"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  ArrowRight,
  CheckCircle,
  Pause,
  Play,
  WifiOff,
  Wifi,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { PLAYER_METAS } from "./types";
import { GamePieceToken } from "./GamePieceToken";
import type { CoupleRacePlayerState } from "@/types/domain";

interface TabletopTurnBarProps {
  turnPlayerId: string | null;
  activeLocalPlayerId: string;
  players: Record<string, CoupleRacePlayerState>;
  turnNumber: number;
  hasRolled: boolean;
  hasMoved: boolean;
  isPaused: boolean;
  roundDeadlineServer: number;
  onMovePiece: () => void;
  onEndTurn: () => void;
  onTogglePause: () => void;
  onToggleDisconnect: () => void;
  isSubmittingAction: boolean;
}

export const TabletopTurnBar: React.FC<TabletopTurnBarProps> = ({
  turnPlayerId,
  activeLocalPlayerId,
  players,
  turnNumber,
  hasRolled,
  hasMoved,
  isPaused,
  roundDeadlineServer,
  onMovePiece,
  onEndTurn,
  onTogglePause,
  onToggleDisconnect,
  isSubmittingAction,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(45);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((roundDeadlineServer - Date.now()) / 1000));
      setSecondsRemaining(remaining);
    }, 500);

    return () => clearInterval(interval);
  }, [roundDeadlineServer, isPaused]);

  const isMyTurn = turnPlayerId === activeLocalPlayerId;
  const turnMeta = turnPlayerId ? PLAYER_METAS[turnPlayerId] : null;
  const localPlayerState = players[activeLocalPlayerId];
  const isLocalDisconnected = localPlayerState?.connectionStatus === "disconnected";

  return (
    <div className="w-full rounded-2xl bg-[#141312] border border-stone-800 p-3 sm:p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
      {/* 1. Left: Active Turn Status & Player Avatar */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        {turnPlayerId && (
          <GamePieceToken
            playerId={turnPlayerId}
            playerState={players[turnPlayerId]}
            isCurrentTurn={true}
            size="md"
          />
        )}

        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-serif font-bold text-stone-100">
              {turnMeta ? `${turnMeta.name}'s Turn` : "Awaiting Turn"}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-800 border border-stone-700 text-amber-300">
              Turn #{turnNumber}
            </span>
            {isMyTurn && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                You
              </span>
            )}
          </div>

          <p className="text-[11px] text-stone-400 font-mono mt-0.5">
            {!hasRolled
              ? isMyTurn
                ? "Step 1: Roll the server dice to determine stride"
                : `Waiting for ${turnMeta?.name || "partner"} to roll dice...`
              : !hasMoved
              ? isMyTurn
                ? "Step 2: Advance piece to the highlighted destination tile"
                : `${turnMeta?.name || "Partner"} is choosing landing tile...`
              : isMyTurn
              ? "Step 3: Turn action complete. Hand off turn to partner."
              : `${turnMeta?.name || "Partner"} is completing turn...`}
          </p>
        </div>
      </div>

      {/* 2. Center: Clock & Pause Banner */}
      <div className="flex items-center gap-3">
        {isPaused ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-950/60 border border-amber-500/60 text-amber-300 text-xs font-mono">
            <Pause className="w-3.5 h-3.5 animate-pulse" />
            <span>Expedition Paused</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-stone-400" />
            <span>Turn Time:</span>
            <strong
              className={`font-semibold ${
                secondsRemaining <= 10 ? "text-rose-400 animate-pulse" : "text-amber-300"
              }`}
            >
              {secondsRemaining}s
            </strong>
          </div>
        )}
      </div>

      {/* 3. Right: Action Controls (Move, End Turn, Pause, Disconnect simulation) */}
      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
        {/* Step 2 Move Piece Action */}
        {isMyTurn && hasRolled && !hasMoved && (
          <button
            id="couple-race-advance-move-btn"
            onClick={onMovePiece}
            disabled={isSubmittingAction}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
          >
            <span>Advance Piece</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Step 3 End Turn Action */}
        {isMyTurn && hasMoved && (
          <button
            id="couple-race-end-turn-btn"
            onClick={onEndTurn}
            disabled={isSubmittingAction}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Pass Turn</span>
          </button>
        )}

        {/* Pause / Resume Button */}
        <button
          id="couple-race-pause-toggle-btn"
          onClick={onTogglePause}
          disabled={isSubmittingAction}
          className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 transition-colors"
          title={isPaused ? "Resume Expedition" : "Pause Expedition"}
        >
          {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-stone-400" />}
        </button>

        {/* Disconnect Simulation Toggle */}
        <button
          id="couple-race-disconnect-toggle-btn"
          onClick={onToggleDisconnect}
          disabled={isSubmittingAction}
          className={`p-2 rounded-xl border transition-colors ${
            isLocalDisconnected
              ? "bg-rose-950/60 border-rose-600 text-rose-300"
              : "bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-400"
          }`}
          title={isLocalDisconnected ? "Reconnect Player" : "Simulate Player Disconnect"}
        >
          {isLocalDisconnected ? <WifiOff className="w-4 h-4 text-rose-400" /> : <Wifi className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

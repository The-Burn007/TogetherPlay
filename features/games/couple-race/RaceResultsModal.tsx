"use client";

import React from "react";
import { motion } from "motion/react";
import {
  Trophy,
  Award,
  RefreshCw,
  ArrowRight,
  Heart,
  Compass,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { PLAYER_METAS } from "./types";
import { GamePieceToken } from "./GamePieceToken";
import type {
  CoupleRacePlayerState,
  CoupleRaceRoundHistoryItem,
} from "@/types/domain";

interface RaceResultsModalProps {
  winnerId: string | null;
  players: Record<string, CoupleRacePlayerState>;
  scores: Record<string, number>;
  cooperativeHarmonyScore: number;
  history: CoupleRaceRoundHistoryItem[];
  onRematch: () => void;
  onExit: () => void;
  isRematching: boolean;
}

export const RaceResultsModal: React.FC<RaceResultsModalProps> = ({
  winnerId,
  players,
  scores,
  cooperativeHarmonyScore,
  history,
  onRematch,
  onExit,
  isRematching,
}) => {
  const winnerMeta = winnerId ? PLAYER_METAS[winnerId] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="w-full max-w-xl rounded-3xl bg-[#141312] border border-amber-500/30 p-6 sm:p-8 space-y-6 shadow-2xl text-stone-100 max-h-[90vh] overflow-y-auto"
      >
        {/* Header: Victorious Arch */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-400/50 flex items-center justify-center mx-auto text-amber-300 shadow-inner">
            <Trophy className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-mono tracking-widest text-amber-400 uppercase font-semibold">
              The Meridian Expedition Concluded
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-100">
              {winnerMeta ? `${winnerMeta.name} Wins the Meridian Laurel` : "Expedition Completed"}
            </h2>
            <p className="text-xs text-stone-400 max-w-sm mx-auto">
              Completed 2 authoritative laps across the 9,560 km circuit between London and Tokyo.
            </p>
          </div>
        </div>

        {/* Player Comparison Cards */}
        <div className="grid grid-cols-2 gap-3">
          {["user_alex", "user_sam"].map((pid) => {
            const meta = PLAYER_METAS[pid];
            const pState = players[pid];
            const isWinner = winnerId === pid;
            const score = scores[pid] || 0;

            return (
              <div
                key={pid}
                className={`rounded-2xl p-4 border flex flex-col justify-between space-y-3 transition-all ${
                  isWinner
                    ? "bg-gradient-to-b from-amber-950/40 to-stone-900 border-amber-400/80 shadow-lg shadow-amber-500/10"
                    : "bg-stone-900/60 border-stone-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GamePieceToken
                      playerId={pid}
                      playerState={pState}
                      isCurrentTurn={false}
                      size="sm"
                    />
                    <div>
                      <div className="text-xs font-serif font-bold text-stone-200">
                        {meta?.name || pid}
                      </div>
                      <div className="text-[10px] font-mono text-stone-400">{meta?.city}</div>
                    </div>
                  </div>

                  {isWinner && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 font-mono text-[9px] font-bold">
                      VICTOR
                    </span>
                  )}
                </div>

                <div className="space-y-1 border-t border-stone-800 pt-2 font-mono text-[11px]">
                  <div className="flex justify-between text-stone-400">
                    <span>Laps Finished:</span>
                    <strong className="text-stone-200">{pState?.lapsCompleted ?? 0} / 2</strong>
                  </div>
                  <div className="flex justify-between text-stone-400">
                    <span>Dice Rolls:</span>
                    <strong className="text-stone-200">{pState?.totalRolls ?? 0}</strong>
                  </div>
                  <div className="flex justify-between text-stone-400">
                    <span>Total Points:</span>
                    <strong className="text-amber-300 font-semibold">{score} pts</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Cooperative Harmony Score Milestone */}
        {cooperativeHarmonyScore > 0 && (
          <div className="rounded-2xl bg-emerald-950/30 border border-emerald-500/30 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-900/50 border border-emerald-500/40 text-emerald-300">
                <Heart className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-emerald-200">Cooperative Synchrony</div>
                <div className="text-[10px] text-stone-400">
                  Earned through Twin Fountains proximity and Harmony Leaps
                </div>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-sm font-bold text-emerald-300">+{cooperativeHarmonyScore}</span>
              <span className="text-[10px] text-emerald-400/80 block">Resonance</span>
            </div>
          </div>
        )}

        {/* Match History Breakdown */}
        {history.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-stone-400">
              <span>Authoritative Turn Log</span>
              <span>{history.length} events verified by server</span>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-[11px] font-mono">
              {history.slice(-6).map((item, idx) => {
                const pName = PLAYER_METAS[item.playerId]?.name || item.playerId;
                return (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-stone-900/80 border border-stone-800 flex items-center justify-between text-stone-300"
                  >
                    <span>
                      Turn {item.turn}: <strong className="text-amber-300">{pName}</strong> rolled{" "}
                      {item.diceValue} → Tile {item.toPos} ({item.tileType})
                    </span>
                    <span className="text-stone-400 font-semibold">+{item.pointsEarned} pts</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Controls: Rematch & Exit */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            id="couple-race-rematch-btn"
            onClick={onRematch}
            disabled={isRematching}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRematching ? "animate-spin" : ""}`} />
            <span>{isRematching ? "Resetting Tabletop..." : "Play Rematch"}</span>
          </button>

          <button
            id="couple-race-exit-btn"
            onClick={onExit}
            className="w-full sm:w-auto py-3 px-5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 font-mono text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Return to Vault
          </button>
        </div>
      </motion.div>
    </div>
  );
};

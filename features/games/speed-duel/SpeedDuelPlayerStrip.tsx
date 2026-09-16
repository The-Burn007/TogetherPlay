"use client";

import React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import type { SpeedDuelStage } from "@/types/domain";

interface SpeedDuelPlayerStripProps {
  player1Name: string;
  player1City: string;
  player1Score: number;
  player1Wins: number;
  player1ReactionMs?: number | null;
  player1Status?: "waiting" | "ready" | "holding" | "reacted" | "winner" | "false_start";
  
  player2Name: string;
  player2City: string;
  player2Score: number;
  player2Wins: number;
  player2ReactionMs?: number | null;
  player2Status?: "waiting" | "ready" | "holding" | "reacted" | "winner" | "false_start";

  activePlayerId: string;
  targetWinsToMatch?: number;
  stage: SpeedDuelStage;
}

export const SpeedDuelPlayerStrip: React.FC<SpeedDuelPlayerStripProps> = ({
  player1Name,
  player1City,
  player1Score,
  player1Wins,
  player1ReactionMs,
  player1Status = "holding",

  player2Name,
  player2City,
  player2Score,
  player2Wins,
  player2ReactionMs,
  player2Status = "holding",

  activePlayerId,
  targetWinsToMatch = 3,
  stage,
}) => {
  const renderPips = (wins: number) => {
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: targetWinsToMatch }).map((_, i) => (
          <span
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i < wins
                ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                : "bg-neutral-800 border border-neutral-700"
            }`}
          />
        ))}
      </div>
    );
  };

  const getStatusBadge = (
    status: "waiting" | "ready" | "holding" | "reacted" | "winner" | "false_start",
    reactionMs?: number | null,
    isEmber = true
  ) => {
    if (status === "false_start") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950/80 text-rose-300 border border-rose-800">
          False Start
        </span>
      );
    }
    if (status === "winner") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/80 shadow-sm animate-pulse">
          Round Win {reactionMs ? `· ${reactionMs}ms` : ""}
        </span>
      );
    }
    if (status === "reacted") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-neutral-300 border border-neutral-700">
          Reacted {reactionMs ? `· ${reactionMs}ms` : ""}
        </span>
      );
    }
    if (stage === "tension") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-900 text-neutral-400 border border-neutral-800">
          Primed & Holding
        </span>
      );
    }
    if (stage === "active") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/50 text-amber-400 border border-amber-800/60 animate-pulse">
          Reacting...
        </span>
      );
    }
    return (
      <Badge variant={isEmber ? "ember" : "sage"} size="sm">
        Ready
      </Badge>
    );
  };

  return (
    <div
      id="speed-duel-players-strip"
      className="grid grid-cols-2 gap-3 sm:gap-6 w-full max-w-2xl mx-auto"
    >
      {/* Player 1: Alex (Ember / London) */}
      <div
        id="player-indicator-alex"
        className={`p-3.5 rounded-2xl border transition-all ${
          activePlayerId === "user_alex"
            ? "bg-[#161311] border-amber-900/60 shadow-lg"
            : "bg-[#11100f] border-neutral-800"
        } ${player1Status === "winner" ? "ring-1 ring-amber-500/80" : ""}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Avatar
              name={player1Name}
              colorRole="ember"
              size="md"
              isOnline={true}
            />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-semibold text-neutral-200">
                  {player1Name}
                </span>
                {activePlayerId === "user_alex" && (
                  <span className="text-[10px] font-mono text-amber-400">(You)</span>
                )}
              </div>
              <div className="text-[10px] font-mono text-neutral-400">
                {player1City}
              </div>
            </div>
          </div>

          <div className="text-right space-y-0.5">
            <div className="text-sm sm:text-base font-mono font-bold text-amber-300">
              {player1Score} <span className="text-[10px] font-normal text-neutral-400">pts</span>
            </div>
            {renderPips(player1Wins)}
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between">
          <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
            Meridian Alpha
          </span>
          {getStatusBadge(player1Status, player1ReactionMs, true)}
        </div>
      </div>

      {/* Player 2: Sam (Sage / Tokyo) */}
      <div
        id="player-indicator-sam"
        className={`p-3.5 rounded-2xl border transition-all ${
          activePlayerId === "user_sam"
            ? "bg-[#131613] border-emerald-900/60 shadow-lg"
            : "bg-[#11100f] border-neutral-800"
        } ${player2Status === "winner" ? "ring-1 ring-emerald-500/80" : ""}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Avatar
              name={player2Name}
              colorRole="sage"
              size="md"
              isOnline={true}
            />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-semibold text-neutral-200">
                  {player2Name}
                </span>
                {activePlayerId === "user_sam" && (
                  <span className="text-[10px] font-mono text-emerald-400">(You)</span>
                )}
              </div>
              <div className="text-[10px] font-mono text-neutral-400">
                {player2City}
              </div>
            </div>
          </div>

          <div className="text-right space-y-0.5">
            <div className="text-sm sm:text-base font-mono font-bold text-emerald-300">
              {player2Score} <span className="text-[10px] font-normal text-neutral-400">pts</span>
            </div>
            {renderPips(player2Wins)}
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between">
          <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
            Meridian Omega
          </span>
          {getStatusBadge(player2Status, player2ReactionMs, false)}
        </div>
      </div>
    </div>
  );
};

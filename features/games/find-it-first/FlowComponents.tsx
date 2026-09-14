"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Trophy,
  RotateCcw,
  Users,
  CheckCircle2,
  Clock,
  Zap,
  ArrowRight,
  SplitSquareVertical,
} from "lucide-react";
import { getArtifactMeta } from "./artifactRegistry";

// ==========================================
// 1. LOBBY VIEW
// ==========================================
export interface LobbyViewProps {
  gameId: string;
  playerIds: string[];
  readyPlayerIds: string[];
  currentUserId: string;
  onToggleReady: () => void;
  onStartGame: () => void;
  dualSessionMode: boolean;
  onToggleDualSession: () => void;
  isReadying: boolean;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  gameId,
  playerIds,
  readyPlayerIds,
  currentUserId,
  onToggleReady,
  onStartGame,
  dualSessionMode,
  onToggleDualSession,
  isReadying,
}) => {
  const isCurrentUserReady = readyPlayerIds.includes(currentUserId);
  const allReady = playerIds.length >= 2 && playerIds.every((id) => readyPlayerIds.includes(id));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-6 bg-gradient-to-b from-[#201a16] to-[#14110f] border border-amber-900/40 shadow-2xl space-y-6"
    >
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-950/80 border border-amber-800/40 text-amber-300 text-[11px] font-mono tracking-widest uppercase">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>TogetherPlay Tabletop Room</span>
        </div>
        <h2 className="text-2xl font-serif text-amber-100 font-bold tracking-tight">
          Find It First
        </h2>
        <p className="text-xs text-stone-400 font-sans max-w-sm mx-auto">
          Race your partner across 5 rounds to identify antique artifacts on the authoritative tabletop.
        </p>
      </div>

      {/* Tabletop Player Seats */}
      <div className="grid grid-cols-2 gap-4">
        {/* Player A: Alex */}
        <div
          className={`p-4 rounded-xl border flex flex-col items-center text-center space-y-2.5 transition-all ${
            readyPlayerIds.includes("user_alex")
              ? "bg-amber-950/40 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
              : "bg-[#181412] border-stone-800"
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-700 to-amber-500 text-neutral-950 font-bold text-base flex items-center justify-center shadow-md">
            AL
          </div>
          <div>
            <div className="text-sm font-serif font-semibold text-stone-200">Alex</div>
            <div className="text-[10px] font-mono text-stone-500">London · GMT+0</div>
          </div>
          <div className="pt-1">
            {readyPlayerIds.includes("user_alex") ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-700/60">
                <CheckCircle2 className="w-3 h-3" /> Ready
              </span>
            ) : (
              <span className="text-[10px] font-mono text-stone-500">Waiting...</span>
            )}
          </div>
        </div>

        {/* Player B: Sam */}
        <div
          className={`p-4 rounded-xl border flex flex-col items-center text-center space-y-2.5 transition-all ${
            readyPlayerIds.includes("user_sam")
              ? "bg-emerald-950/40 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
              : "bg-[#181412] border-stone-800"
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-700 to-emerald-500 text-neutral-950 font-bold text-base flex items-center justify-center shadow-md">
            SM
          </div>
          <div>
            <div className="text-sm font-serif font-semibold text-stone-200">Sam</div>
            <div className="text-[10px] font-mono text-stone-500">Tokyo · JST+9</div>
          </div>
          <div className="pt-1">
            {readyPlayerIds.includes("user_sam") ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-700/60">
                <CheckCircle2 className="w-3 h-3" /> Ready
              </span>
            ) : (
              <span className="text-[10px] font-mono text-stone-500">Waiting...</span>
            )}
          </div>
        </div>
      </div>

      {/* Dual Session Simulation Switch */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-[#171311] border border-stone-800 text-xs">
        <div className="flex items-center gap-2">
          <SplitSquareVertical className="w-4 h-4 text-amber-400" />
          <span className="text-stone-300 font-medium">Dual Browser Simulator</span>
        </div>
        <button
          id="toggle-dual-session-btn"
          onClick={onToggleDualSession}
          className={`px-3 py-1 rounded-md font-mono text-xs font-semibold transition-all ${
            dualSessionMode
              ? "bg-amber-600 text-black shadow"
              : "bg-stone-800 text-stone-300 hover:bg-stone-700"
          }`}
        >
          {dualSessionMode ? "Active (Split View)" : "Off (Single View)"}
        </button>
      </div>

      {/* Lobby Primary Actions */}
      <div className="flex flex-col gap-2.5 pt-2">
        <button
          id="lobby-ready-btn"
          disabled={isReadying}
          onClick={onToggleReady}
          className={`w-full py-3 px-4 rounded-xl font-serif text-sm font-semibold tracking-wide transition-all shadow-lg active:scale-98 ${
            isCurrentUserReady
              ? "bg-stone-800 text-amber-300 border border-amber-800/40 hover:bg-stone-700"
              : "bg-gradient-to-r from-amber-600 to-amber-500 text-neutral-950 hover:brightness-110 shadow-[0_0_20px_rgba(217,155,56,0.3)]"
          }`}
        >
          {isCurrentUserReady ? "Ready! (Click to cancel)" : "Declare Ready for Match"}
        </button>

        {allReady && (
          <motion.button
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            id="lobby-start-game-btn"
            onClick={onStartGame}
            className="w-full py-3 px-4 rounded-xl font-serif text-sm font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 text-neutral-950 shadow-xl flex items-center justify-center gap-2 hover:brightness-110"
          >
            <span>Begin Authoritative Match</span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        )}
      </div>

      <div className="text-center text-[11px] font-mono text-stone-500">
        Room Code: <span className="text-amber-400 font-bold">{gameId}</span>
      </div>
    </motion.div>
  );
};

// ==========================================
// 2. COUNTDOWN VIEW
// ==========================================
export interface CountdownViewProps {
  countdownNumber: number;
}

export const CountdownView: React.FC<CountdownViewProps> = ({ countdownNumber }) => {
  return (
    <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
      <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-semibold">
        Authoritative Synchronization
      </span>
      <AnimatePresence mode="wait">
        <motion.div
          key={countdownNumber}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-24 h-24 rounded-full border-2 border-amber-500/80 bg-gradient-to-b from-amber-950/60 to-black flex items-center justify-center shadow-[0_0_35px_rgba(245,158,11,0.4)]"
        >
          <span className="text-5xl font-serif font-black text-amber-300">
            {countdownNumber}
          </span>
        </motion.div>
      </AnimatePresence>
      <p className="text-xs font-serif text-stone-400 italic">
        Take your places at the table...
      </p>
    </div>
  );
};

// ==========================================
// 3. TARGET REVEAL CARD
// ==========================================
export interface TargetRevealProps {
  targetId: string;
  targetName?: string;
  targetCode?: string;
  targetClue?: string;
  round: number;
  maxRounds: number;
  remainingSeconds: number;
}

export const TargetRevealCard: React.FC<TargetRevealProps> = ({
  targetId,
  targetName,
  targetCode,
  targetClue,
  round,
  maxRounds,
  remainingSeconds,
}) => {
  const meta = getArtifactMeta(targetId);
  const Icon = meta.icon;
  const displayName = targetName || meta.name;
  const displayCode = targetCode || meta.code;
  const displayClue = targetClue || meta.clue;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative rounded-2xl p-4 sm:p-5 bg-gradient-to-b from-[#261f1a] to-[#151210] border-2 border-amber-600/60 shadow-[0_10px_30px_rgba(0,0,0,0.7)]"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-amber-900/40">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-[11px] font-mono uppercase tracking-widest text-amber-300 font-bold">
            Target Clue · Round {round} / {maxRounds}
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono text-xs font-bold text-amber-300 bg-black/60 px-2.5 py-1 rounded-md border border-amber-700/40">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>00:{remainingSeconds.toString().padStart(2, "0")}</span>
        </div>
      </div>

      {/* Target Content Banner */}
      <div className="pt-3 pb-1 flex items-center gap-3 sm:gap-4">
        <motion.div
          animate={{ rotate: [0, -3, 3, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 text-neutral-950 flex items-center justify-center shrink-0 shadow-lg border border-amber-400/50"
        >
          <Icon className="w-8 h-8 sm:w-9 sm:h-9 text-neutral-950" />
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono text-amber-400/80 font-bold tracking-widest uppercase">
            Identify Artifact {displayCode}
          </div>
          <h2 className="text-lg sm:text-xl font-serif font-black text-amber-100 tracking-tight truncate">
            {displayName}
          </h2>
          <p className="text-xs font-serif text-stone-300 italic line-clamp-1">
            &ldquo;{displayClue}&rdquo;
          </p>
        </div>
      </div>

      {/* Fluid Tension Deadline Bar */}
      <div className="mt-3 w-full h-1.5 rounded-full bg-neutral-900 overflow-hidden border border-stone-800">
        <motion.div
          className={`h-full transition-all duration-300 ${
            remainingSeconds <= 4
              ? "bg-red-500"
              : remainingSeconds <= 8
              ? "bg-amber-500"
              : "bg-emerald-500"
          }`}
          style={{ width: `${Math.min(100, (remainingSeconds / 15) * 100)}%` }}
        />
      </div>
    </motion.div>
  );
};

// ==========================================
// 4. ROUND RESULT OVERLAY
// ==========================================
export interface RoundResultOverlayProps {
  round: number;
  winnerPlayerId: string | null;
  pointsAwarded: number;
  speedBonus: number;
  targetName: string;
  onNextRound: () => void;
  isLastRound: boolean;
}

export const RoundResultOverlay: React.FC<RoundResultOverlayProps> = ({
  round,
  winnerPlayerId,
  pointsAwarded,
  speedBonus,
  targetName,
  onNextRound,
  isLastRound,
}) => {
  const winnerName = winnerPlayerId === "user_alex" ? "Alex (London)" : winnerPlayerId === "user_sam" ? "Sam (Tokyo)" : "Neither Player (Timeout)";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-5 rounded-2xl bg-gradient-to-b from-[#241c18] to-[#120f0d] border-2 border-amber-500/80 shadow-[0_0_40px_rgba(217,155,56,0.35)] space-y-4 text-center"
    >
      <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-950 border border-amber-700/60 text-amber-300 text-[10px] font-mono tracking-widest uppercase">
        <Zap className="w-3 h-3 text-amber-400" />
        <span>Round {round} Resolved</span>
      </div>

      <div className="space-y-1">
        <div className="text-xl sm:text-2xl font-serif font-black text-amber-100">
          {winnerPlayerId ? `${winnerName} Found the ${targetName}!` : "Round Expired with No Discovery"}
        </div>
        {winnerPlayerId && (
          <p className="text-xs font-mono text-amber-300/80">
            +{pointsAwarded} Authoritative Points (+{speedBonus} reflex bonus)
          </p>
        )}
      </div>

      <button
        id="round-result-next-btn"
        onClick={onNextRound}
        className="w-full py-3 px-4 rounded-xl font-serif text-sm font-bold bg-gradient-to-r from-amber-600 to-amber-500 text-neutral-950 hover:brightness-110 shadow-lg flex items-center justify-center gap-2"
      >
        <span>{isLastRound ? "View Final Grand Results" : `Proceed to Round ${round + 1}`}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

// ==========================================
// 5. FINAL RESULT MODAL
// ==========================================
export interface FinalResultModalProps {
  scores: Record<string, number>;
  onRematch: () => void;
  roundHistory?: Array<{
    round: number;
    winnerId: string;
    targetName: string;
    pointsAwarded: number;
  }>;
}

export const FinalResultModal: React.FC<FinalResultModalProps> = ({
  scores,
  onRematch,
  roundHistory = [],
}) => {
  const alexScore = scores["user_alex"] || 0;
  const samScore = scores["user_sam"] || 0;

  let outcomeTitle = "A Dead Heat Draw!";
  let winnerColor = "text-amber-300";
  if (alexScore > samScore) {
    outcomeTitle = "Alex Wins the Match!";
    winnerColor = "text-amber-400";
  } else if (samScore > alexScore) {
    outcomeTitle = "Sam Wins the Match!";
    winnerColor = "text-emerald-400";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl bg-gradient-to-b from-[#221b16] to-[#120f0e] border-2 border-amber-500 shadow-[0_0_50px_rgba(217,155,56,0.3)] space-y-6 text-center"
    >
      <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-neutral-950 flex items-center justify-center shadow-xl">
        <Trophy className="w-9 h-9" />
      </div>

      <div className="space-y-1">
        <span className="text-[11px] font-mono tracking-widest uppercase text-amber-400/80 font-bold">
          Match Concluded · 5 Rounds
        </span>
        <h2 className={`text-2xl sm:text-3xl font-serif font-black ${winnerColor}`}>
          {outcomeTitle}
        </h2>
      </div>

      {/* Score Recap Cards */}
      <div className="grid grid-cols-2 gap-3 py-1">
        <div className="p-3.5 rounded-xl bg-black/40 border border-stone-800">
          <div className="text-xs font-mono text-stone-400">Alex (London)</div>
          <div className="text-2xl font-serif font-bold text-amber-300">{alexScore}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-black/40 border border-stone-800">
          <div className="text-xs font-mono text-stone-400">Sam (Tokyo)</div>
          <div className="text-2xl font-serif font-bold text-emerald-300">{samScore}</div>
        </div>
      </div>

      {/* Round Breakdown */}
      {roundHistory.length > 0 && (
        <div className="space-y-1.5 text-left bg-black/30 p-3 rounded-xl border border-stone-800/80 text-xs font-mono">
          <div className="text-[10px] uppercase text-stone-400 font-bold pb-1 border-b border-stone-800">
            Authoritative Round Ledger
          </div>
          {roundHistory.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-stone-300 py-0.5">
              <span>R{item.round}: {item.targetName}</span>
              <span className={item.winnerId === "user_alex" ? "text-amber-400" : "text-emerald-400"}>
                {item.winnerId === "user_alex" ? "Alex" : "Sam"} (+{item.pointsAwarded})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Rematch Button */}
      <button
        id="final-rematch-btn"
        onClick={onRematch}
        className="w-full py-3.5 px-4 rounded-xl font-serif text-sm font-bold bg-gradient-to-r from-amber-600 to-amber-500 text-neutral-950 hover:brightness-110 shadow-xl flex items-center justify-center gap-2 cursor-pointer"
      >
        <RotateCcw className="w-4 h-4" />
        <span>Request Authoritative Rematch</span>
      </button>
    </motion.div>
  );
};

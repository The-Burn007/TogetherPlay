"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { getArtifactMeta } from "@/features/games/find-it-first/artifactRegistry";

export interface GameBoardGridProps {
  board: string[];
  onSelectCell: (cellId: string) => void;
  disabled?: boolean;
  selectedCellId?: string | null;
  winningCellId?: string | null;
  mistakeCellId?: string | null;
  winnerPlayerName?: string | null;
}

export const GameBoardGrid: React.FC<GameBoardGridProps> = ({
  board,
  onSelectCell,
  disabled = false,
  selectedCellId,
  winningCellId,
  mistakeCellId,
  winnerPlayerName,
}) => {
  return (
    <div className="relative rounded-2xl p-3 sm:p-4 bg-gradient-to-b from-[#1c1815] to-[#120f0d] border border-amber-950/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_12px_32px_rgba(0,0,0,0.6)]">
      {/* Brass Tabletop Inlay Corner Accents */}
      <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-amber-700/40 rounded-tl-sm pointer-events-none" />
      <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-amber-700/40 rounded-tr-sm pointer-events-none" />
      <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-amber-700/40 rounded-bl-sm pointer-events-none" />
      <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-amber-700/40 rounded-br-sm pointer-events-none" />

      {/* 3x4 Antiquarian Artifact Matrix */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 sm:gap-3 relative z-10">
        {board.map((cellId, index) => {
          const meta = getArtifactMeta(cellId);
          const Icon = meta.icon;
          const isWinningCell = winningCellId === cellId;
          const isMistake = mistakeCellId === cellId;
          const isSelected = selectedCellId === cellId;

          return (
            <motion.button
              key={`${cellId}_${index}`}
              id={`board-cell-${cellId}`}
              disabled={disabled || !!winningCellId}
              onClick={() => onSelectCell(cellId)}
              whileHover={!disabled && !winningCellId ? { scale: 1.03, y: -2 } : {}}
              whileTap={!disabled && !winningCellId ? { scale: 0.94 } : {}}
              animate={
                isWinningCell
                  ? {
                      scale: [1, 1.08, 1.04],
                      boxShadow: [
                        "0 0 0 rgba(217,155,56,0)",
                        "0 0 24px rgba(217,155,56,0.6)",
                        "0 0 16px rgba(217,155,56,0.4)",
                      ],
                    }
                  : isMistake
                  ? {
                      x: [0, -6, 6, -4, 4, 0],
                      boxShadow: "0 0 18px rgba(217,83,79,0.5)",
                    }
                  : {}
              }
              transition={{ duration: isWinningCell ? 0.6 : 0.3 }}
              className={`relative aspect-square rounded-xl p-2 sm:p-2.5 flex flex-col items-center justify-between select-none cursor-pointer transition-colors border group ${
                isWinningCell
                  ? "bg-gradient-to-b from-amber-900/60 to-amber-950/80 border-amber-500 text-amber-200"
                  : isMistake
                  ? "bg-gradient-to-b from-red-950/60 to-neutral-900/90 border-red-500/80 text-red-200"
                  : isSelected
                  ? "bg-amber-950/40 border-amber-600/70 text-amber-300"
                  : disabled
                  ? "bg-[#161311] border-stone-800/60 text-stone-600 cursor-not-allowed opacity-80"
                  : "bg-gradient-to-b from-[#241f1c] to-[#181412] border-stone-800/80 hover:border-amber-700/60 text-stone-300 shadow-md"
              }`}
            >
              {/* Tile Top Header: Code & Indicator */}
              <div className="w-full flex items-center justify-between text-[10px] font-mono leading-none">
                <span
                  className={`font-semibold tracking-wider ${
                    isWinningCell
                      ? "text-amber-300"
                      : isMistake
                      ? "text-red-400"
                      : "text-stone-500 group-hover:text-stone-400"
                  }`}
                >
                  {meta.code}
                </span>

                <AnimatePresence>
                  {isWinningCell && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-amber-500 text-black shadow"
                    >
                      Found
                    </motion.span>
                  )}
                  {isMistake && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-red-600 text-white shadow"
                    >
                      Miss
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Central Antiquarian Artifact Icon */}
              <div className="relative py-1">
                <Icon
                  className={`w-7 h-7 sm:w-9 sm:h-9 transition-transform duration-200 ${
                    isWinningCell
                      ? "text-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                      : isMistake
                      ? "text-red-400 scale-95"
                      : "text-amber-100/80 group-hover:text-amber-200 group-hover:scale-105"
                  }`}
                />
              </div>

              {/* Artifact Name Footer */}
              <div className="w-full text-center">
                <span
                  className={`block text-[10px] sm:text-[11px] font-serif tracking-tight truncate leading-tight ${
                    isWinningCell
                      ? "text-amber-200 font-bold"
                      : isMistake
                      ? "text-red-300"
                      : "text-stone-300 group-hover:text-amber-100"
                  }`}
                >
                  {meta.name}
                </span>
              </div>

              {/* Winner overlay badge when solved */}
              {isWinningCell && winnerPlayerName && (
                <div className="absolute inset-x-1 bottom-1 py-0.5 bg-amber-500/90 text-neutral-950 font-sans text-[9px] font-bold uppercase tracking-widest text-center rounded-md shadow-lg">
                  {winnerPlayerName}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

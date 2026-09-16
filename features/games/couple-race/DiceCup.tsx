"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { Dices, Sparkles } from "lucide-react";
import { tabletopAudio } from "./coupleRaceAudio";

interface DiceCupProps {
  isCurrentTurn: boolean;
  hasRolled: boolean;
  currentDiceValue: number | null;
  secondDiceValue?: number | null;
  effectiveDistance?: number | null;
  activePowerThisTurn?: string | null;
  isRolling: boolean;
  onRollDice: () => void;
  disabled?: boolean;
}

// Render physical 3D dice face pips
const DiceFace: React.FC<{ value: number }> = ({ value }) => {
  const pips = [];
  // Standard dice pip layouts
  const pipPositions: Record<number, number[][]> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [0, 2], [2, 0], [2, 2]],
    5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
  };

  const activePoints = pipPositions[value] || [[1, 1]];

  return (
    <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-stone-100 text-stone-900 border-2 border-stone-300 shadow-[0_8px_16px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(0,0,0,0.3)] grid grid-cols-3 grid-rows-3 p-2.5 gap-1 select-none">
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => {
          const hasPip = activePoints.some(([pr, pc]) => pr === r && pc === c);
          return (
            <div key={`${r}-${c}`} className="flex items-center justify-center">
              {hasPip && (
                <div className="w-2.5 h-2.5 rounded-full bg-stone-900 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_1px_rgba(0,0,0,0.6)]" />
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export const DiceCup: React.FC<DiceCupProps> = ({
  isCurrentTurn,
  hasRolled,
  currentDiceValue,
  secondDiceValue,
  effectiveDistance,
  activePowerThisTurn,
  isRolling,
  onRollDice,
  disabled = false,
}) => {
  const [localTumble, setLocalTumble] = useState(false);

  const handleRollClick = () => {
    if (!isCurrentTurn || hasRolled || isRolling || disabled) return;
    setLocalTumble(true);
    tabletopAudio.playDiceRoll();
    onRollDice();
    setTimeout(() => setLocalTumble(false), 800);
  };

  const rolling = isRolling || localTumble;
  const isDoubleStride = Boolean(activePowerThisTurn === "DOUBLE_DICE" || secondDiceValue);
  const isWindStride = Boolean(activePowerThisTurn === "WIND_STRIDE");

  return (
    <div className="relative flex flex-col items-center justify-center p-4 rounded-2xl bg-stone-900/80 border border-stone-800 shadow-lg">
      {/* Active Tactical Power Banner */}
      {(isWindStride || isDoubleStride) && (
        <div className="absolute -top-3 px-3 py-0.5 rounded-full bg-amber-500/90 text-stone-950 text-[10px] font-mono font-bold tracking-tight shadow-md flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          <span>
            {isDoubleStride && isWindStride
              ? "Dual Stride (+2 Wind)"
              : isDoubleStride
              ? "Double Stride (2 Dice)"
              : "Wind Stride (+2 Steps)"}
          </span>
        </div>
      )}

      {/* Dice Arena */}
      <div className="flex items-center justify-center gap-3 py-2 min-h-[76px]">
        {hasRolled && currentDiceValue ? (
          <div className="flex items-center gap-3">
            {/* Primary Die */}
            <motion.div
              initial={{ rotate: -180, scale: 0.5, y: -20 }}
              animate={{ rotate: 0, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
            >
              <DiceFace value={secondDiceValue ? currentDiceValue - secondDiceValue : currentDiceValue} />
            </motion.div>

            {/* Second Die if Double Stride */}
            {secondDiceValue && (
              <motion.div
                initial={{ rotate: 180, scale: 0.5, y: -20 }}
                animate={{ rotate: 0, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
              >
                <DiceFace value={secondDiceValue} />
              </motion.div>
            )}
          </div>
        ) : rolling ? (
          <motion.div
            animate={{
              rotate: [0, 90, 180, 270, 360],
              scale: [0.9, 1.1, 0.9],
              y: [-6, 6, -6],
            }}
            transition={{ duration: 0.4, repeat: Infinity }}
            className="w-16 h-16 rounded-2xl bg-stone-200 border border-stone-400 flex items-center justify-center shadow-lg"
          >
            <Dices className="w-8 h-8 text-stone-700 animate-spin" />
          </motion.div>
        ) : (
          <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-stone-700 flex flex-col items-center justify-center text-stone-500">
            <Dices className="w-6 h-6" />
            <span className="text-[9px] font-mono mt-0.5">READY</span>
          </div>
        )}
      </div>

      {/* Outcome Summary & Roll Button */}
      <div className="mt-2 flex flex-col items-center space-y-1.5">
        {hasRolled && effectiveDistance ? (
          <div className="text-center font-mono">
            <div className="text-sm font-semibold text-amber-300">
              Total Advance: {effectiveDistance} {effectiveDistance === 1 ? "Tile" : "Tiles"}
            </div>
            <div className="text-[10px] text-stone-400">
              {isWindStride
                ? `(Dice: ${currentDiceValue ?? 0} + 2 Wind Bonus)`
                : secondDiceValue && currentDiceValue !== null
                ? `(Dice 1: ${currentDiceValue - secondDiceValue} + Dice 2: ${secondDiceValue})`
                : "Server Authorized Move"}
            </div>
          </div>
        ) : (
          <button
            id="couple-race-roll-dice-btn"
            onClick={handleRollClick}
            disabled={!isCurrentTurn || hasRolled || isRolling || disabled}
            className={`px-6 py-2.5 rounded-xl font-mono text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2 shadow-md ${
              isCurrentTurn && !hasRolled
                ? "bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-amber-500/20 active:scale-95 cursor-pointer"
                : "bg-stone-800 text-stone-500 border border-stone-700 cursor-not-allowed"
            }`}
          >
            <Dices className="w-4 h-4" />
            <span>{isRolling ? "Rolling Authoritatively..." : "Roll Dice"}</span>
          </button>
        )}
      </div>
    </div>
  );
};

"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Wind, Dices, HeartHandshake, ShieldCheck, ChevronUp, ChevronDown } from "lucide-react";
import { tabletopAudio } from "./coupleRaceAudio";
import type { CoupleRacePowerType } from "@/types/domain";

interface PowerCardDeckProps {
  powers: CoupleRacePowerType[];
  isCurrentTurn: boolean;
  hasRolled: boolean;
  hasMoved: boolean;
  activePowerThisTurn: string | null;
  onUsePower: (power: CoupleRacePowerType) => void;
  disabled?: boolean;
}

interface PowerCardDef {
  type: CoupleRacePowerType;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  usableTiming: "before_roll" | "anytime_turn";
  colorTheme: {
    border: string;
    bg: string;
    text: string;
    glow: string;
  };
}

const POWER_CATALOG: Record<CoupleRacePowerType, PowerCardDef> = {
  WIND_STRIDE: {
    type: "WIND_STRIDE",
    title: "Wind Stride",
    subtitle: "Zephyr Acceleration",
    description: "Adds +2 movement distance to your next dice roll this turn.",
    icon: <Wind className="w-4 h-4 text-sky-300" />,
    usableTiming: "before_roll",
    colorTheme: {
      border: "border-sky-500/50 hover:border-sky-400",
      bg: "bg-gradient-to-br from-sky-950/50 via-stone-900 to-stone-900",
      text: "text-sky-300",
      glow: "rgba(14, 165, 233, 0.2)",
    },
  },
  DOUBLE_DICE: {
    type: "DOUBLE_DICE",
    title: "Double Stride",
    subtitle: "Twin Ivory Roll",
    description: "Rolls two server dice simultaneously for rapid crossing.",
    icon: <Dices className="w-4 h-4 text-amber-300" />,
    usableTiming: "before_roll",
    colorTheme: {
      border: "border-amber-500/50 hover:border-amber-400",
      bg: "bg-gradient-to-br from-amber-950/50 via-stone-900 to-stone-900",
      text: "text-amber-300",
      glow: "rgba(245, 158, 11, 0.2)",
    },
  },
  HARMONY_LEAP: {
    type: "HARMONY_LEAP",
    title: "Harmony Leap",
    subtitle: "Quantum Resonance",
    description: "Teleport directly onto partner's tile. Awards +50 harmony points.",
    icon: <HeartHandshake className="w-4 h-4 text-emerald-300" />,
    usableTiming: "anytime_turn",
    colorTheme: {
      border: "border-emerald-500/50 hover:border-emerald-400",
      bg: "bg-gradient-to-br from-emerald-950/50 via-stone-900 to-stone-900",
      text: "text-emerald-300",
      glow: "rgba(16, 185, 129, 0.2)",
    },
  },
  SHIELD_AURA: {
    type: "SHIELD_AURA",
    title: "Shield Aura",
    subtitle: "Sanctuary Ward",
    description: "Protects piece against Winds of Chance hazard gate setbacks.",
    icon: <ShieldCheck className="w-4 h-4 text-violet-300" />,
    usableTiming: "anytime_turn",
    colorTheme: {
      border: "border-violet-500/50 hover:border-violet-400",
      bg: "bg-gradient-to-br from-violet-950/50 via-stone-900 to-stone-900",
      text: "text-violet-300",
      glow: "rgba(139, 92, 246, 0.2)",
    },
  },
};

export const PowerCardDeck: React.FC<PowerCardDeckProps> = ({
  powers,
  isCurrentTurn,
  hasRolled,
  hasMoved,
  activePowerThisTurn,
  onUsePower,
  disabled = false,
}) => {
  const handlePlayCard = (power: CoupleRacePowerType) => {
    if (!isCurrentTurn || disabled) return;
    tabletopAudio.playCardUse();
    onUsePower(power);
  };

  return (
    <div className="w-full flex flex-col space-y-2">
      <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 px-1">
        <div className="flex items-center gap-1.5 text-stone-300 font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Tactical Vault ({powers.length} Cards)</span>
        </div>
        <span className="text-[10px] text-stone-500">
          Draw cards by landing on Scriptorium Vaults
        </span>
      </div>

      {powers.length === 0 ? (
        <div className="rounded-xl border border-stone-800/80 bg-stone-900/40 p-4 text-center text-xs text-stone-500 font-mono">
          No tactical cards in hand. Land on Scriptorium Vault (tiles 4, 12, 20) to unlock cards.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {powers.map((pType, idx) => {
            const def = POWER_CATALOG[pType] || POWER_CATALOG.WIND_STRIDE;
            const canPlay =
              isCurrentTurn &&
              !disabled &&
              (def.usableTiming === "anytime_turn" || !hasRolled);
            const isActive = activePowerThisTurn === pType;

            return (
              <motion.div
                key={`${pType}-${idx}`}
                whileHover={canPlay ? { y: -3 } : {}}
                className={`relative rounded-xl border p-3 flex flex-col justify-between transition-all duration-200 shadow-md ${
                  def.colorTheme.bg
                } ${def.colorTheme.border} ${
                  isActive ? "ring-2 ring-amber-400 shadow-lg" : ""
                } ${!canPlay ? "opacity-60" : "cursor-pointer"}`}
                onClick={() => canPlay && handlePlayCard(pType)}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="p-1 rounded-md bg-stone-900/80 border border-stone-700">
                        {def.icon}
                      </div>
                      <span className={`text-xs font-semibold font-serif ${def.colorTheme.text}`}>
                        {def.title}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-stone-400 bg-stone-900/90 px-1.5 py-0.5 rounded border border-stone-800">
                      {def.usableTiming === "before_roll" ? "Pre-Roll" : "Anytime"}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-300 leading-snug">
                    {def.description}
                  </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-stone-800/80 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-stone-400">{def.subtitle}</span>
                  {canPlay ? (
                    <span className="text-amber-300 font-semibold group-hover:underline">
                      {isActive ? "Prepared" : "Click to Play →"}
                    </span>
                  ) : (
                    <span className="text-stone-600">
                      {hasRolled && def.usableTiming === "before_roll"
                        ? "Must play pre-roll"
                        : "Partner's turn"}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

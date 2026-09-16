"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Zap,
  BookOpen,
  Heart,
  Coffee,
  AlertTriangle,
  Flag,
  Compass,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
} from "lucide-react";
import { COUPLE_RACE_TILES } from "@/lib/firebase/server/authoritativeGameEngine";
import { GamePieceToken } from "./GamePieceToken";
import { PLAYER_METAS, type TabletopCameraMode } from "./types";
import type {
  CoupleRaceTile,
  CoupleRacePlayerState,
  CoupleRaceTileType,
} from "@/types/domain";

interface TabletopBoardProps {
  players: Record<string, CoupleRacePlayerState>;
  turnPlayerId: string | null;
  validMovePositions: number[];
  hasRolledThisTurn: boolean;
  hasMovedThisTurn: boolean;
  onTileClick: (tileIndex: number) => void;
  onSelectInspectTile: (tile: CoupleRaceTile | null) => void;
  selectedInspectTile: CoupleRaceTile | null;
  cameraMode: TabletopCameraMode;
  onChangeCameraMode: (mode: TabletopCameraMode) => void;
  zoom: number;
  onChangeZoom: (delta: number) => void;
  cooperativeHarmonyScore?: number;
}

// Compute (x, y) grid coordinates for 24-tile circuit in an 8x6 track
// Perimeter:
// Top row (8 tiles): [0,0] to [7,0] (indices 0..7)
// Right column (4 tiles): [7,1] to [7,4] (indices 8..11)
// Bottom row (8 tiles): [7,5] to [0,5] (indices 12..19, reversed)
// Left column (4 tiles): [0,4] to [0,1] (indices 20..23, going up)
function getTileGridPosition(index: number): { col: number; row: number } {
  if (index >= 0 && index <= 7) {
    return { col: index, row: 0 };
  } else if (index >= 8 && index <= 11) {
    return { col: 7, row: index - 7 };
  } else if (index >= 12 && index <= 19) {
    return { col: 7 - (index - 12), row: 5 };
  } else if (index >= 20 && index <= 23) {
    return { col: 0, row: 5 - (index - 19) };
  }
  return { col: 0, row: 0 };
}

export const TabletopBoard: React.FC<TabletopBoardProps> = ({
  players,
  turnPlayerId,
  validMovePositions,
  hasRolledThisTurn,
  hasMovedThisTurn,
  onTileClick,
  onSelectInspectTile,
  selectedInspectTile,
  cameraMode,
  onChangeCameraMode,
  zoom,
  onChangeZoom,
  cooperativeHarmonyScore = 0,
}) => {
  // Map tile index -> list of player IDs present
  const playersOnTiles = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (const [pid, pState] of Object.entries(players)) {
      const pos = pState.position % 24;
      if (!map[pos]) map[pos] = [];
      map[pos].push(pid);
    }
    return map;
  }, [players]);

  const getTileIcon = (type: CoupleRaceTileType) => {
    switch (type) {
      case "START":
        return <Flag className="w-3.5 h-3.5 text-amber-300" />;
      case "BOOST":
        return <Zap className="w-3.5 h-3.5 text-sky-400" />;
      case "POWER_CACHE":
        return <BookOpen className="w-3.5 h-3.5 text-violet-400" />;
      case "HARMONY_SYNC":
        return <Heart className="w-3.5 h-3.5 text-emerald-400" />;
      case "SCENIC_REST":
        return <Coffee className="w-3.5 h-3.5 text-amber-200" />;
      case "CHALLENGE_GATE":
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <span className="w-1.5 h-1.5 rounded-full bg-stone-500/60" />;
    }
  };

  const getTileBadgeColor = (type: CoupleRaceTileType) => {
    switch (type) {
      case "START":
        return "border-amber-400/80 bg-amber-950/40 text-amber-200";
      case "BOOST":
        return "border-sky-400/80 bg-sky-950/40 text-sky-200";
      case "POWER_CACHE":
        return "border-violet-400/80 bg-violet-950/40 text-violet-200";
      case "HARMONY_SYNC":
        return "border-emerald-400/80 bg-emerald-950/40 text-emerald-200";
      case "SCENIC_REST":
        return "border-amber-500/60 bg-amber-950/30 text-amber-300";
      case "CHALLENGE_GATE":
        return "border-rose-400/80 bg-rose-950/40 text-rose-200";
      default:
        return "border-stone-700/60 bg-stone-900/40 text-stone-400";
    }
  };

  return (
    <div className="relative w-full flex flex-col items-center select-none">
      {/* Tabletop Atmosphere & Camera Toolbar */}
      <div className="w-full flex items-center justify-between px-3 py-2 border-b border-stone-800/80 bg-[#121110] text-[11px] font-mono text-stone-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
            <Compass className="w-3.5 h-3.5" />
            <span className="tracking-wider uppercase">Meridian Track (24 Nodes)</span>
          </div>
          <span className="hidden sm:inline text-stone-600">|</span>
          <span className="hidden sm:inline text-stone-400">
            London ⇄ Tokyo · 9,560 km Circuit
          </span>
        </div>

        {/* Camera mode & Zoom controls */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-stone-900/90 p-0.5 border border-stone-800">
            <button
              onClick={() => onChangeCameraMode("perspective")}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                cameraMode === "perspective"
                  ? "bg-stone-800 text-amber-300 font-semibold shadow-sm"
                  : "text-stone-400 hover:text-stone-200"
              }`}
              title="3D Tabletop Tilt Perspective"
            >
              Tabletop 3D
            </button>
            <button
              onClick={() => onChangeCameraMode("flat")}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                cameraMode === "flat"
                  ? "bg-stone-800 text-amber-300 font-semibold shadow-sm"
                  : "text-stone-400 hover:text-stone-200"
              }`}
              title="Top-Down Overview"
            >
              Overview 2D
            </button>
          </div>

          <div className="flex items-center gap-1 bg-stone-900/90 rounded-lg p-0.5 border border-stone-800 text-stone-300">
            <button
              onClick={() => onChangeZoom(-0.1)}
              className="p-1 hover:text-amber-300 transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] w-8 text-center font-mono">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => onChangeZoom(0.1)}
              className="p-1 hover:text-amber-300 transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 3D Stage Viewport */}
      <div
        className="w-full overflow-x-auto overflow-y-visible flex items-center justify-center py-6 px-2 sm:px-4"
        style={{ perspective: cameraMode === "perspective" ? "1200px" : "none" }}
      >
        <motion.div
          animate={{
            rotateX: cameraMode === "perspective" ? 22 : 0,
            scale: zoom,
          }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          style={{
            transformStyle: "preserve-3d",
          }}
          className="relative rounded-3xl p-5 sm:p-7 transition-all duration-300 shadow-2xl"
        >
          {/* Tabletop Wood / Slate Outer Plinth */}
          <div
            className="absolute inset-0 rounded-3xl border-2 border-stone-800 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at 50% 30%, #1f1d1a 0%, #131211 75%, #0d0c0b 100%)",
              boxShadow: `
                inset 0 1px 2px rgba(255,255,255,0.08),
                inset 0 -2px 6px rgba(0,0,0,0.8),
                0 25px 50px -12px rgba(0,0,0,0.9)
              `,
            }}
          />

          {/* Tabletop Subtle Brass Inlay Border */}
          <div className="absolute inset-2.5 sm:inset-3.5 rounded-2xl border border-amber-500/20 pointer-events-none" />

          {/* 8x6 Grid Matrix Track */}
          <div
            className="relative grid grid-cols-8 grid-rows-6 gap-1.5 sm:gap-2.5 z-10"
            style={{ width: "min(92vw, 840px)", height: "min(68vw, 620px)" }}
          >
            {/* 1. The 24 Track Perimeter Tiles */}
            {COUPLE_RACE_TILES.map((tile) => {
              const { col, row } = getTileGridPosition(tile.index);
              const isTargetMove = validMovePositions.includes(tile.index);
              const isTurnActive = isTargetMove && hasRolledThisTurn && !hasMovedThisTurn;
              const occupantIds = playersOnTiles[tile.index] || [];
              const isSelected = selectedInspectTile?.index === tile.index;

              return (
                <div
                  key={tile.index}
                  onClick={() => {
                    onSelectInspectTile(tile);
                    if (isTurnActive) {
                      onTileClick(tile.index);
                    }
                  }}
                  style={{
                    gridColumnStart: col + 1,
                    gridRowStart: row + 1,
                  }}
                  className={`group relative rounded-xl sm:rounded-2xl transition-all duration-200 p-1 sm:p-2 flex flex-col justify-between cursor-pointer border ${
                    isSelected
                      ? "ring-2 ring-amber-400 border-amber-300 bg-stone-800/90 shadow-lg"
                      : isTurnActive
                      ? "border-amber-400 bg-amber-950/40 shadow-[0_0_16px_rgba(245,158,11,0.35)] animate-pulse"
                      : "border-stone-800/90 bg-[#171615] hover:border-stone-700 hover:bg-stone-800/60"
                  }`}
                >
                  {/* Subtle tile texture & bevel */}
                  <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

                  {/* Top indicator: tile index & archetype icon */}
                  <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono leading-none">
                    <span
                      className={`px-1 py-0.5 rounded font-medium border ${getTileBadgeColor(
                        tile.type
                      )}`}
                    >
                      {String(tile.index).padStart(2, "0")}
                    </span>
                    <div className="opacity-90">{getTileIcon(tile.type)}</div>
                  </div>

                  {/* Center: Tile name (abbreviated or fitted) */}
                  <div className="my-auto text-center px-0.5">
                    <span className="text-[10px] sm:text-[11px] font-serif font-medium text-stone-200 line-clamp-1 block">
                      {tile.name}
                    </span>
                  </div>

                  {/* Bottom: Player Tokens Present on this Tile */}
                  <div className="min-h-[26px] sm:min-h-[34px] flex items-center justify-center gap-1">
                    {occupantIds.map((pid) => (
                      <GamePieceToken
                        key={pid}
                        playerId={pid}
                        playerState={players[pid]}
                        isCurrentTurn={turnPlayerId === pid}
                        size="sm"
                      />
                    ))}
                  </div>

                  {/* Destination Prompt Pill */}
                  {isTurnActive && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute -top-3 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-amber-500 text-stone-950 text-[9px] font-mono font-bold tracking-tight shadow-md whitespace-nowrap z-20 pointer-events-none"
                    >
                      MOVE HERE
                    </motion.div>
                  )}
                </div>
              );
            })}

            {/* 2. Inner Tabletop Sanctuary Courtyard (Grid columns 2..7, rows 2..5) */}
            <div
              style={{
                gridColumn: "2 / 8",
                gridRow: "2 / 6",
              }}
              className="rounded-2xl border border-stone-800/80 bg-radial from-stone-900/60 to-[#0e0d0c] p-4 sm:p-6 flex flex-col justify-between items-center text-center relative overflow-hidden shadow-inner"
            >
              {/* Astrological Rose background watermark */}
              <div className="absolute inset-0 opacity-[0.04] flex items-center justify-center pointer-events-none">
                <Compass className="w-80 h-80 text-amber-200" />
              </div>

              {/* Courtyard Header: Meridian Expedition Status */}
              <div className="w-full flex items-center justify-between text-[11px] font-mono text-stone-400 border-b border-stone-800/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-stone-300 font-medium">The Great Meridian Circuit</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-stone-500">Lap Target:</span>
                  <span className="text-amber-300 font-semibold">2 Laps (48 Tiles)</span>
                </div>
              </div>

              {/* Central Courtyard Feature: Harmony Synchrony & Distance Arc */}
              <div className="my-auto py-2 space-y-3 max-w-md">
                <div className="flex items-center justify-center gap-6">
                  {/* London Player Alex status */}
                  <div className="flex items-center gap-2">
                    <GamePieceToken
                      playerId="user_alex"
                      playerState={players["user_alex"]}
                      isCurrentTurn={turnPlayerId === "user_alex"}
                      size="sm"
                    />
                    <div className="text-left">
                      <div className="text-xs font-semibold text-amber-300">Alex · London</div>
                      <div className="text-[10px] font-mono text-stone-400">
                        Lap {(players["user_alex"]?.lapsCompleted ?? 0) + 1} · Tile {players["user_alex"]?.position ?? 0}
                      </div>
                    </div>
                  </div>

                  {/* Meridian Compass Needle */}
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full border border-amber-500/30 bg-stone-900/80 flex items-center justify-center text-amber-400 shadow-sm">
                      <Compass className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono text-stone-500 mt-1">9,560 km</span>
                  </div>

                  {/* Tokyo Player Sam status */}
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-emerald-300">Sam · Tokyo</div>
                      <div className="text-[10px] font-mono text-stone-400">
                        Lap {(players["user_sam"]?.lapsCompleted ?? 0) + 1} · Tile {players["user_sam"]?.position ?? 0}
                      </div>
                    </div>
                    <GamePieceToken
                      playerId="user_sam"
                      playerState={players["user_sam"]}
                      isCurrentTurn={turnPlayerId === "user_sam"}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Cooperative Resonance Score Banner */}
                {cooperativeHarmonyScore > 0 && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/40 text-[11px] font-mono text-emerald-300">
                    <Heart className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Shared Harmony: +{cooperativeHarmonyScore} Resonance Pts</span>
                  </div>
                )}
              </div>

              {/* Courtyard Footer: Selected Tile Inspector preview */}
              <div className="w-full text-left bg-stone-900/50 rounded-xl p-2.5 border border-stone-800/60 flex items-center justify-between text-[11px]">
                {selectedInspectTile ? (
                  <div className="flex items-center gap-2.5">
                    <span className={`px-1.5 py-0.5 rounded font-mono font-semibold border ${getTileBadgeColor(selectedInspectTile.type)}`}>
                      Node {String(selectedInspectTile.index).padStart(2, "0")}
                    </span>
                    <div>
                      <span className="font-semibold text-stone-200 mr-2">{selectedInspectTile.name}:</span>
                      <span className="text-stone-400 text-[10px]">{selectedInspectTile.description}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-stone-500">
                    <Info className="w-3.5 h-3.5" />
                    <span>Select any tile on the circuit to inspect its tactical secrets</span>
                  </div>
                )}

                <div className="text-[10px] font-mono text-stone-400 shrink-0">
                  {turnPlayerId ? (
                    <span>
                      Active Turn: <strong className="text-amber-300">{PLAYER_METAS[turnPlayerId]?.name || turnPlayerId}</strong>
                    </span>
                  ) : (
                    <span>Awaiting Start</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

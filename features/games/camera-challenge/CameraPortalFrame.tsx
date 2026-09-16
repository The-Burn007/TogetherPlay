"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, Check, AlertCircle, RefreshCw, Sparkles, User } from "lucide-react";

interface CameraPortalFrameProps {
  id?: string;
  stream: MediaStream | null;
  playerName: string;
  city?: string;
  isLocal: boolean;
  auraColor?: "ember" | "sage";
  isLockedIn?: boolean;
  isCameraActive?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  onRetryCamera?: () => void;
  className?: string;
}

export const CameraPortalFrame: React.FC<CameraPortalFrameProps> = ({
  id,
  stream,
  playerName,
  city,
  isLocal,
  auraColor = "ember",
  isLockedIn = false,
  isCameraActive = true,
  hasError = false,
  errorMessage,
  onRetryCamera,
  className = "",
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream) {
      videoEl.srcObject = stream;
      videoEl
        .play()
        .catch((err) => {
          console.warn(`[CameraPortalFrame] Auto-play was interrupted for ${playerName}:`, err);
        });
    } else {
      videoEl.srcObject = null;
    }
  }, [stream, playerName]);

  const isEmber = auraColor === "ember";
  const borderColor = isLockedIn
    ? "border-emerald-400/80 shadow-[0_0_24px_rgba(52,211,153,0.35)]"
    : isEmber
    ? "border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.18)]"
    : "border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.18)]";

  const badgeBg = isEmber
    ? "bg-amber-950/70 border-amber-500/30 text-amber-200"
    : "bg-emerald-950/70 border-emerald-500/30 text-emerald-200";

  return (
    <div
      id={id}
      className={`relative w-full h-full min-h-[260px] sm:min-h-[340px] md:min-h-[420px] rounded-3xl overflow-hidden bg-neutral-950 border-2 transition-all duration-500 flex flex-col justify-end ${borderColor} ${className}`}
    >
      {/* Live Video Media Stream Element (Zero recording, purely peer-to-peer playback) */}
      {stream && isCameraActive ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`absolute inset-0 w-full h-full object-cover select-none ${
            isLocal ? "scale-x-[-1]" : ""
          }`}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-neutral-900/90 to-neutral-950 text-neutral-400 select-none">
          {hasError ? (
            <div className="flex flex-col items-center text-center max-w-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-200">Video Unavailable</p>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  {errorMessage || "Camera permissions or connection required."}
                </p>
              </div>
              {onRetryCamera && (
                <button
                  id={`retry-camera-${playerName.toLowerCase()}`}
                  onClick={onRetryCamera}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/60 transition-colors flex items-center space-x-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center text-neutral-400">
                <User className="w-7 h-7 opacity-70" />
              </div>
              <p className="text-xs tracking-wider uppercase text-neutral-400 font-medium">
                {playerName} · Standby
              </p>
              <p className="text-[11px] text-neutral-500">Live feed connecting...</p>
            </div>
          )}
        </div>
      )}

      {/* Subtle vignette gradient for readable cinematic overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30 pointer-events-none" />

      {/* Top Bar: Player identity & Live badge */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div
          className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-md border shadow-sm ${badgeBg}`}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isEmber ? "bg-amber-400" : "bg-emerald-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isEmber ? "bg-amber-500" : "bg-emerald-500"
              }`}
            />
          </span>
          <span className="tracking-wide">
            {playerName} {isLocal && "(You)"}
          </span>
          {city && <span className="opacity-70 font-light">· {city}</span>}
        </div>

        {/* Locked In Status Badge */}
        <AnimatePresence>
          {isLockedIn && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/90 text-white backdrop-blur-md shadow-lg shadow-emerald-950/40"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>LOCKED IN</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Status / Local Viewfinder Watermark */}
      <div className="relative z-10 p-4 flex items-end justify-between pointer-events-none">
        <div className="flex items-center space-x-2">
          {stream && isCameraActive && (
            <div className="flex items-center space-x-1 text-[11px] text-neutral-300 font-mono opacity-80 backdrop-blur-sm bg-neutral-950/40 px-2.5 py-0.5 rounded-lg border border-neutral-800/40">
              <Camera className="w-3 h-3 text-neutral-400" />
              <span>LIVE VIEW</span>
            </div>
          )}
        </div>

        {isLockedIn && (
          <div className="text-[11px] text-emerald-300 flex items-center space-x-1 bg-emerald-950/60 backdrop-blur-md border border-emerald-500/30 px-2 py-0.5 rounded-lg">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Ready for Review</span>
          </div>
        )}
      </div>
    </div>
  );
};

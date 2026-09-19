"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Wifi,
  WifiOff,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Maximize2,
  Minimize2,
  Lock,
  Radio,
} from "lucide-react";
import { useWebRtcVideoCall } from "./useWebRtcVideoCall";
import { VideoPrivacyControls } from "./VideoPrivacyControls";
import { Button } from "@/components/ui/Button";

interface GameRoomVideoCompanionProps {
  roomId: string;
  myUserId: string;
  partnerId: string;
  myDisplayName?: string;
  myCity?: string;
  partnerDisplayName?: string;
  partnerCity?: string;
  className?: string;
  isGameEnd?: boolean;
  gameStatus?: string;
}

export const GameRoomVideoCompanion: React.FC<GameRoomVideoCompanionProps> = ({
  roomId,
  myUserId,
  partnerId,
  myDisplayName = "Alex",
  myCity = "London",
  partnerDisplayName = "Sam",
  partnerCity = "Tokyo",
  className = "",
  isGameEnd = false,
  gameStatus,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [dismissPermissionWarning, setDismissPermissionWarning] = useState(false);

  const {
    status,
    errorMessage,
    isInCall,
    isConnecting,
    isConnected,
    isReconnecting,
    localStream,
    remoteStream,
    isCameraOn,
    isMicOn,
    hasCamera,
    hasMicrophone,
    isUsingDemoStream,
    partnerParticipant,
    isPartnerCameraOn,
    isPartnerMicOn,
    iceReport,
    startCall,
    leaveCall,
    toggleCamera,
    toggleMicrophone,
    retryConnection,
  } = useWebRtcVideoCall({
    roomId,
    myUserId,
    partnerId,
    myDisplayName,
    myCity,
    isGameEnd,
    gameStatus,
  });

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Bind local stream to video element
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Bind remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // If user hasn't joined the call yet, show an intimate non-intrusive companion launcher
  if (!isInCall && status !== "permission_denied") {
    return (
      <div
        id="video-companion-launcher"
        className={`bg-[#181412] border border-amber-900/40 rounded-2xl p-3.5 shadow-lg backdrop-blur-sm transition-all ${className}`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-amber-950/80 border border-amber-700/60 flex items-center justify-center text-amber-300 font-serif text-lg font-bold">
                {partnerDisplayName.charAt(0)}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#181412] animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-stone-200">
                  {partnerDisplayName} ({partnerCity})
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
                  Online
                </span>
              </div>
              <p className="text-xs text-stone-400 font-mono flex items-center gap-1.5 mt-0.5">
                <Lock className="w-3 h-3 text-amber-500/80" />
                <span>Encrypted P2P Live Video • Zero Recording</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              id="start-live-video-btn"
              variant="amber"
              size="sm"
              onClick={() => startCall(false)}
              className="flex items-center gap-1.5 text-xs font-mono py-1.5"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Connect Video</span>
            </Button>

            <Button
              id="start-virtual-feed-btn"
              variant="outline"
              size="sm"
              onClick={() => startCall(true)}
              title="Start with virtual companion avatar stream (ideal for testing or devices without webcam)"
              className="flex items-center gap-1 text-[11px] font-mono text-stone-400 hover:text-stone-200 py-1.5"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="hidden md:inline">Demo Feed</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Permission Denied State Banner (Game continues seamlessly!)
  if (status === "permission_denied" && !dismissPermissionWarning) {
    return (
      <div
        id="video-permission-denied-card"
        className="bg-rose-950/40 border border-rose-900/60 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-200 font-mono text-xs"
      >
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-300">Camera & Microphone Access Blocked</p>
            <p className="text-[11px] text-rose-300/80">
              The game remains completely playable without video. To use video, allow camera access in your browser address bar.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => startCall(false)}
            className="text-xs font-mono py-1 border-rose-800 text-rose-200 hover:bg-rose-900/50"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDismissPermissionWarning(true)}
            className="text-xs font-mono py-1 text-stone-400 hover:text-stone-200"
          >
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  // Active Video Companion Surface (Desktop supporting dock & Mobile floating/expandable panel)
  return (
    <div
      id="video-room-companion"
      className={`relative bg-[#161210] border border-amber-900/50 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${
        isMinimized ? "p-2 max-w-sm ml-auto" : "p-3 space-y-3"
      } ${className}`}
    >
      {/* 1. Header Bar: Partner Status & Connection Badge */}
      <div className="flex items-center justify-between text-xs font-mono px-1">
        <div className="flex items-center gap-2">
          {/* Status Indicator Dot */}
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              isConnected
                ? "bg-emerald-500 shadow-sm shadow-emerald-500"
                : isReconnecting
                ? "bg-amber-500 animate-ping"
                : "bg-amber-400 animate-pulse"
            }`}
          />

          <span className="font-bold text-stone-200 truncate">
            {partnerDisplayName} ({partnerCity})
          </span>

          {/* Connection Status Label */}
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border ${
              isConnected
                ? "bg-emerald-950/60 border-emerald-800/40 text-emerald-400"
                : isReconnecting
                ? "bg-amber-950/60 border-amber-800/40 text-amber-400 animate-pulse"
                : status === "unauthorized"
                ? "bg-rose-950/60 border-rose-800/40 text-rose-400"
                : status === "partner_disconnected"
                ? "bg-amber-950/60 border-amber-800/40 text-amber-400"
                : "bg-stone-800/80 border-stone-700 text-stone-400"
            }`}
          >
            {isConnected
              ? (iceReport.isProductionReliable ? "P2P (TURN)" : "P2P (STUN)")
              : isReconnecting
              ? "Reconnecting..."
              : isConnecting
              ? "Connecting..."
              : status === "unauthorized"
              ? "Unauthorized"
              : status === "partner_disconnected"
              ? "Partner Left"
              : status}
          </span>
        </div>

        {/* Minimalist Controls when Minimized */}
        {isMinimized && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleMicrophone}
              className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
              title="Toggle Microphone"
            >
              {isMicOn ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-rose-400" />}
            </button>
            <button
              type="button"
              onClick={toggleCamera}
              className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
              title="Toggle Camera"
            >
              {isCameraOn ? <Video className="w-3.5 h-3.5 text-emerald-400" /> : <VideoOff className="w-3.5 h-3.5 text-amber-400" />}
            </button>
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
              title="Expand Companion"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Main Video Viewports (Hidden when minimized for maximum game board visibility) */}
      {!isMinimized && (
        <div className="space-y-2">
          {/* Reconnecting Alert Banner if network degraded */}
          {isReconnecting && (
            <div className="bg-amber-950/70 border border-amber-800/60 rounded-lg p-2 text-[11px] font-mono text-amber-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>Reconnecting peer media stream...</span>
              </span>
              <button
                onClick={retryConnection}
                className="underline hover:text-amber-100 ml-2"
              >
                Reconnect now
              </button>
            </div>
          )}

          {/* Device Warnings if camera or mic missing */}
          {(!hasCamera || !hasMicrophone) && (
            <div className="bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1 text-[11px] font-mono text-stone-400 flex items-center gap-2">
              {!hasCamera && <span>• Running without camera (Audio only)</span>}
              {!hasMicrophone && <span>• Running without microphone</span>}
            </div>
          )}

          {/* Supporting Video Surfaces: Partner Video + Embedded Local Picture-In-Picture */}
          <div className="relative w-full aspect-video sm:aspect-[21/9] md:aspect-[16/7] rounded-xl overflow-hidden bg-black/80 border border-amber-950/60">
            {/* A. Partner Video Feed */}
            {remoteStream && isPartnerCameraOn ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              /* Partner Placeholder (Warm companion card when partner camera off or connecting) */
              <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-radial-gradient from-stone-900 to-black text-center space-y-2">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-300 font-serif text-2xl font-bold">
                    {partnerDisplayName.charAt(0)}
                  </div>
                  {isPartnerMicOn ? (
                    <span className="absolute -bottom-1 -right-1 p-1 bg-stone-900 rounded-full border border-stone-700">
                      <Mic className="w-3 h-3 text-emerald-400 animate-pulse" />
                    </span>
                  ) : (
                    <span className="absolute -bottom-1 -right-1 p-1 bg-stone-900 rounded-full border border-rose-800">
                      <MicOff className="w-3 h-3 text-rose-400" />
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-stone-200">
                    {partnerDisplayName} ({partnerCity})
                  </h4>
                  <p className="text-[11px] font-mono text-stone-400 mt-0.5">
                    {remoteStream && !isPartnerCameraOn
                      ? "Partner's camera is paused"
                      : isConnected
                      ? "Partner's audio stream connected"
                      : "Waiting for partner's video stream..."}
                  </p>
                </div>
              </div>
            )}

            {/* Partner Info Overlay Badge */}
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md border border-stone-800/80 text-[11px] font-mono text-stone-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{partnerDisplayName}</span>
              {!isPartnerMicOn && <MicOff className="w-3 h-3 text-rose-400 ml-1" />}
            </div>

            {/* Demo Feed Watermark indicator */}
            {isUsingDemoStream && (
              <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-amber-950/80 border border-amber-700/50 text-[10px] font-mono text-amber-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Virtual Stream Active</span>
              </div>
            )}

            {/* B. Local Video (Picture-in-Picture Self Preview) */}
            <div className="absolute bottom-2.5 right-2.5 w-24 sm:w-32 aspect-video rounded-lg overflow-hidden border-2 border-stone-700/80 bg-stone-950 shadow-xl z-10 group">
              {localStream && isCameraOn ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-stone-900 text-stone-400 p-1 text-center">
                  <VideoOff className="w-4 h-4 text-amber-500 mb-0.5" />
                  <span className="text-[9px] font-mono">Camera Off</span>
                </div>
              )}

              {/* Local Label Badge */}
              <div className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-black/70 text-[9px] font-mono text-stone-300 flex items-center gap-1">
                <span>You</span>
                {!isMicOn && <MicOff className="w-2.5 h-2.5 text-rose-400" />}
              </div>
            </div>
          </div>

          {/* 3. Privacy & Media Control Bar */}
          <VideoPrivacyControls
            isCameraOn={isCameraOn}
            isMicOn={isMicOn}
            isConnecting={isConnecting}
            isReconnecting={isReconnecting}
            onToggleCamera={toggleCamera}
            onToggleMicrophone={toggleMicrophone}
            onLeaveCall={leaveCall}
            onRetry={retryConnection}
            isMinimized={isMinimized}
            onToggleMinimize={() => setIsMinimized(true)}
          />
        </div>
      )}
    </div>
  );
};

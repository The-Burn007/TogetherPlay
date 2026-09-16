"use client";

import React from "react";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  ShieldCheck,
  Minimize2,
  Maximize2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface VideoPrivacyControlsProps {
  isCameraOn: boolean;
  isMicOn: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  onToggleCamera: () => void;
  onToggleMicrophone: () => void;
  onLeaveCall: () => void;
  onRetry?: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export const VideoPrivacyControls: React.FC<VideoPrivacyControlsProps> = ({
  isCameraOn,
  isMicOn,
  isConnecting,
  isReconnecting,
  onToggleCamera,
  onToggleMicrophone,
  onLeaveCall,
  onRetry,
  isMinimized,
  onToggleMinimize,
}) => {
  return (
    <div className="flex items-center justify-between gap-2 p-2 bg-[#120f0d]/95 backdrop-blur-md border border-amber-900/30 rounded-xl">
      {/* Privacy Guarantee Pill */}
      <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-emerald-950/40 border border-emerald-800/30 rounded-md text-[10px] font-mono text-emerald-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="truncate">Encrypted P2P • No Recording</span>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-1.5 mx-auto sm:mx-0">
        {/* Microphone Toggle */}
        <button
          type="button"
          onClick={onToggleMicrophone}
          title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
          className={`p-2 rounded-lg transition-all text-xs flex items-center gap-1 font-mono ${
            isMicOn
              ? "bg-stone-800/80 hover:bg-stone-700 text-stone-200 border border-stone-700/60"
              : "bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 shadow-sm shadow-rose-950/50"
          }`}
        >
          {isMicOn ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-rose-400" />}
          <span className="text-[11px] hidden md:inline">{isMicOn ? "Mic On" : "Muted"}</span>
        </button>

        {/* Camera Toggle */}
        <button
          type="button"
          onClick={onToggleCamera}
          title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
          className={`p-2 rounded-lg transition-all text-xs flex items-center gap-1 font-mono ${
            isCameraOn
              ? "bg-stone-800/80 hover:bg-stone-700 text-stone-200 border border-stone-700/60"
              : "bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800/60 shadow-sm shadow-amber-950/50"
          }`}
        >
          {isCameraOn ? <Video className="w-4 h-4 text-emerald-400" /> : <VideoOff className="w-4 h-4 text-amber-400" />}
          <span className="text-[11px] hidden md:inline">{isCameraOn ? "Cam On" : "Cam Off"}</span>
        </button>

        {/* Reconnect button if disconnected */}
        {isReconnecting && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            title="Retry Connection"
            className="p-2 rounded-lg bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-700/60 text-xs flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            <span className="text-[11px] hidden md:inline">Retry</span>
          </button>
        )}

        {/* Leave Call */}
        <button
          type="button"
          onClick={onLeaveCall}
          title="Leave Video Call"
          className="p-2 rounded-lg bg-rose-950/90 hover:bg-rose-900 text-rose-200 border border-rose-800/60 transition-colors text-xs flex items-center gap-1 font-mono"
        >
          <PhoneOff className="w-4 h-4 text-rose-300" />
          <span className="text-[11px] hidden md:inline">Leave</span>
        </button>

        {/* Expand / Minimize Toggle */}
        {onToggleMinimize && (
          <button
            type="button"
            onClick={onToggleMinimize}
            title={isMinimized ? "Expand Video" : "Minimize Video"}
            className="p-2 rounded-lg bg-stone-800/60 hover:bg-stone-700 text-stone-300 border border-stone-700/40"
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
};

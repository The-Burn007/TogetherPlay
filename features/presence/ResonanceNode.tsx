"use client";

import React, { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { CloudRain, SunMedium, ArrowLeftRight } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export const ResonanceNode: React.FC = () => {
  const { showToast } = useToast();
  const [pulseActive, setPulseActive] = useState(false);

  const handleResonanceTap = () => {
    setPulseActive(true);
    showToast("Resonance pulse transmitted to Tokyo");
    setTimeout(() => setPulseActive(false), 1200);
  };

  return (
    <section className="flex flex-col w-full rounded-xl bg-surface-raised border border-subtle-border p-5 shadow-xl relative overflow-hidden">
      {/* Ambient Presence Blobs */}
      <div className="absolute -top-12 -left-12 w-40 h-40 rounded-full bg-player-one-ember/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-player-two-sage/10 blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between relative z-10">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
            Intimacy Sanctuary
          </p>
          <h2 className="text-xl font-semibold text-on-surface tracking-tight mt-0.5">
            Good evening, Alex
          </h2>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-overlay border border-subtle-border text-shared-amber shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-shared-amber animate-ping" />
          <span className="text-[10px] font-mono tracking-wider uppercase font-medium">
            Live Relay
          </span>
        </div>
      </div>

      {/* Dual Interlocking Horizon Telemetry */}
      <div className="mt-4 p-4 rounded-lg bg-surface-deep border border-subtle-border relative flex flex-col items-center">
        {/* Visual Bridge Line */}
        <div className="absolute top-1/2 left-20 right-20 -translate-y-1/2 h-[1px] bg-gradient-to-r from-player-one-ember/50 via-shared-amber/60 to-player-two-sage/50 z-0" />

        <div className="w-full flex items-center justify-between relative z-10">
          {/* Alex Node (London) */}
          <div className="flex flex-col items-center gap-1.5">
            <Avatar
              name="Alex"
              colorRole="ember"
              size="lg"
              isOnline={true}
              imageUrl="https://picsum.photos/seed/alex-profile-london/200/200"
            />
            <div className="text-center">
              <span className="text-sm font-semibold text-on-surface">Alex</span>
              <p className="text-[10px] font-mono text-on-surface-variant">
                London · 23:24
              </p>
            </div>
          </div>

          {/* Resonance Hub Connection Indicator */}
          <button
            onClick={handleResonanceTap}
            className="flex flex-col items-center justify-center cursor-pointer select-none group focus:outline-none"
            aria-label="Tap to pulse resonance"
          >
            <div className="w-12 h-12 rounded-full bg-surface-overlay border border-shared-amber/30 flex items-center justify-center shadow-inner relative transition-transform active:scale-90">
              <div
                className={`absolute inset-0 rounded-full bg-shared-amber/20 ${
                  pulseActive ? "animate-ping opacity-100" : "opacity-0"
                }`}
              />
              <ArrowLeftRight className="w-5 h-5 text-shared-amber transition-transform group-hover:scale-110" />
            </div>
            <span className="text-[9px] font-mono uppercase tracking-widest text-shared-amber mt-1.5 font-medium">
              Synced
            </span>
          </button>

          {/* Sam Node (Tokyo) */}
          <div className="flex flex-col items-center gap-1.5">
            <Avatar
              name="Sam"
              colorRole="sage"
              size="lg"
              isOnline={true}
              imageUrl="https://picsum.photos/seed/sam-profile-tokyo/200/200"
            />
            <div className="text-center">
              <span className="text-sm font-semibold text-on-surface">Sam</span>
              <p className="text-[10px] font-mono text-on-surface-variant">
                Tokyo · 07:24
              </p>
            </div>
          </div>
        </div>

        {/* Real-time Atmospheric Micro-Climate Footnote */}
        <div className="mt-4 pt-3 w-full border-t border-subtle-border flex items-center justify-between text-on-surface-variant text-[11px] font-mono">
          <div className="flex items-center gap-1 text-player-one-ember">
            <CloudRain className="w-3.5 h-3.5" />
            <span>Rainy · 9°C</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-overlay text-canvas-cream text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-player-two-sage animate-pulse" />
            <span>Sam opened room 2m ago</span>
          </div>
          <div className="flex items-center gap-1 text-player-two-sage">
            <span>Clear · 18°C</span>
            <SunMedium className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </section>
  );
};

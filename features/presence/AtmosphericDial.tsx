"use client";

import React, { useState } from "react";
import { Moon, Sun } from "lucide-react";

export const AtmosphericDial: React.FC = () => {
  const [balance, setBalance] = useState(52); // Percentage 0-100

  return (
    <section className="flex flex-col w-full rounded-xl bg-surface-raised border border-subtle-border p-4 shadow-md space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">
          Paired Atmospheric Energy
        </span>
        <span className="text-xs font-mono text-shared-amber font-semibold">
          Harmony 94%
        </span>
      </div>

      <div className="p-4 rounded-lg bg-surface-deep border border-subtle-border flex flex-col gap-3">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5 text-player-one-ember">
            <Moon className="w-4 h-4" />
            <span className="font-semibold">Alex: Cozy Night</span>
          </div>
          <div className="flex items-center gap-1.5 text-player-two-sage">
            <span className="font-semibold">Sam: Fresh Awake</span>
            <Sun className="w-4 h-4" />
          </div>
        </div>

        {/* Bipolar Gradient Dial Track with Interactive Drag/Tap Slider */}
        <div className="relative w-full h-3 rounded-full bg-surface-container-highest overflow-hidden cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-r from-player-one-ember via-shared-amber to-player-two-sage opacity-85" />
          {/* Slider Pinpoint */}
          <div
            className="absolute top-0 bottom-0 w-3 -ml-1.5 rounded-full bg-canvas-cream shadow-md transition-all duration-150"
            style={{ left: `${balance}%` }}
          />
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <button
            onClick={() => setBalance(35)}
            className="text-[10px] font-mono text-on-surface-variant/70 hover:text-player-one-ember"
          >
            London Calm
          </button>
          <span className="text-[11px] font-mono text-center text-on-surface-variant">
            Shared Resonance: Gentle Focus
          </span>
          <button
            onClick={() => setBalance(68)}
            className="text-[10px] font-mono text-on-surface-variant/70 hover:text-player-two-sage"
          >
            Tokyo Dawn
          </button>
        </div>
      </div>
    </section>
  );
};

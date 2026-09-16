"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cameraChallengeAudio } from "./cameraChallengeAudio";

interface EventCountdownOverlayProps {
  seconds?: number;
  onComplete: () => void;
}

export const EventCountdownOverlay: React.FC<EventCountdownOverlayProps> = ({
  seconds = 3,
  onComplete,
}) => {
  const [currentNumber, setCurrentNumber] = useState<number>(seconds);

  useEffect(() => {
    // Play initial countdown tick
    cameraChallengeAudio.playCountdownTick(false);

    let remaining = seconds;
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCurrentNumber(remaining);
        cameraChallengeAudio.playCountdownTick(false);
      } else if (remaining === 0) {
        setCurrentNumber(0);
        cameraChallengeAudio.playCountdownTick(true);
      } else {
        clearInterval(interval);
        onComplete();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [seconds, onComplete]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none select-none">
      <div className="relative flex flex-col items-center justify-center">
        {/* Ambient Ring Pulse */}
        <div className="absolute w-56 h-56 rounded-full bg-amber-500/10 animate-ping opacity-30" />
        <div className="absolute w-44 h-44 rounded-full border border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.25)]" />

        <AnimatePresence mode="wait">
          <motion.div
            key={currentNumber}
            initial={{ scale: 0.4, opacity: 0, filter: "blur(4px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            exit={{ scale: 1.4, opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex flex-col items-center justify-center"
          >
            <span
              id="countdown-digit"
              className="text-7xl sm:text-9xl font-serif font-black tracking-tighter text-amber-300 drop-shadow-[0_4px_24px_rgba(245,158,11,0.6)]"
            >
              {currentNumber > 0 ? currentNumber : "GO!"}
            </span>
          </motion.div>
        </AnimatePresence>

        <p className="mt-4 text-xs sm:text-sm uppercase tracking-widest font-medium text-amber-200/90 drop-shadow">
          Prepare in Camera
        </p>
      </div>
    </div>
  );
};

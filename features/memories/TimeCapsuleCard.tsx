"use client";

import React, { useState } from "react";
import { Lock, Clock, Paperclip } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export const TimeCapsuleCard: React.FC = () => {
  const { showToast } = useToast();
  const [note, setNote] = useState("");
  const [isSealed, setIsSealed] = useState(false);

  const handleSeal = () => {
    if (!note.trim()) {
      showToast("Write a thought before sealing the capsule");
      return;
    }
    setIsSealed(true);
    showToast("Capsule sealed! Will unlock for Sam at 8:00 AM Tokyo time.");
  };

  return (
    <div className="bg-surface-raised border border-subtle-border p-4 sm:p-5 rounded-xl shadow-lg flex flex-col space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-shared-amber/15 border border-shared-amber/30 flex items-center justify-center text-shared-amber">
            <Clock className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-on-surface">
              Today&apos;s Time Capsule
            </span>
            <span className="text-[10px] font-mono text-on-surface-variant">
              Unlocks for Sam at 8:00 AM Tokyo time
            </span>
          </div>
        </div>
        <span className="text-[9px] font-mono text-player-one-ember uppercase tracking-wider bg-surface-deep px-2 py-0.5 rounded border border-subtle-border">
          {isSealed ? "Sealed" : "Draft"}
        </span>
      </div>

      <p className="text-xs text-on-surface-variant leading-relaxed">
        Drop a fleeting visual thought, an unspoken audio reflection, or a photo
        from your evening walk before they wake up.
      </p>

      {isSealed ? (
        <div className="bg-surface-deep border border-subtle-border p-3.5 rounded-lg flex items-center gap-3">
          <Lock className="w-4 h-4 text-shared-amber shrink-0" />
          <p className="text-xs text-on-surface font-mono italic">
            &ldquo;{note}&rdquo;
          </p>
        </div>
      ) : (
        <div className="bg-surface-deep border border-subtle-border p-2 rounded-lg flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 pl-1">
            <Paperclip className="w-4 h-4 text-on-surface-variant/70 shrink-0" />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Attach snippet or note for dawn..."
              className="bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none w-full"
            />
          </div>
          <button
            onClick={handleSeal}
            className="bg-shared-amber text-surface-deep text-xs font-mono font-bold px-3 py-1.5 rounded-md flex items-center gap-1 shadow-sm hover:bg-[#e6a847] active:scale-95 transition-all shrink-0"
          >
            <span>Seal</span>
            <Lock className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

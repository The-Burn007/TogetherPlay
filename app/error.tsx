"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global runtime error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface-deep text-center">
      <div className="w-16 h-16 rounded-full bg-player-one-ember/20 border border-player-one-ember/40 flex items-center justify-center text-player-one-ember mb-4 shadow-lg">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-semibold text-on-surface mb-2">
        Connection Interrupted
      </h2>
      <p className="text-sm text-on-surface-variant max-w-sm mb-6 leading-relaxed">
        The shared room encountered an unexpected state. Reconnecting your session will restore mutual presence.
      </p>
      <Button variant="amber" onClick={() => reset()}>
        <RotateCcw className="w-4 h-4 mr-2" />
        Reconnect Session
      </Button>
    </div>
  );
}

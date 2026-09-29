"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { motion } from "motion/react";
import { AlertCircle, RotateCcw, Home, ShieldCheck } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global sanctuary runtime error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background-canvas text-center selection:bg-brand selection:text-text-on-mint">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="max-w-md w-full bg-surface border border-border rounded-3xl p-8 sm:p-10 shadow-elevation-lg space-y-6 flex flex-col items-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-danger/15 border border-danger/30 flex items-center justify-center text-danger shadow-sm">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-raised border border-border text-[10px] font-mono text-text-muted uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-danger" />
            <span>Connection Interrupted</span>
          </div>

          <h1 className="text-2xl font-display font-medium text-text-primary tracking-tight">
            Sanctuary Sync Paused
          </h1>
          <p className="text-xs text-text-secondary leading-relaxed">
            The shared meridian encountered a transient sync interruption. Your memories,
            active games, and couple credentials remain safely secured.
          </p>
        </div>

        <div className="w-full p-3.5 rounded-xl bg-background-canvas border border-border-subtle flex items-center justify-center gap-2 text-[11px] font-mono text-text-muted">
          <ShieldCheck className="w-4 h-4 text-brand" />
          <span>Zero data loss · Private archive preserved</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full pt-2">
          <Button
            variant="brand"
            size="md"
            onClick={() => reset()}
            className="w-full font-semibold"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            <span>Reconnect Session</span>
          </Button>

          <Link href="/home" className="w-full">
            <Button
              variant="outline"
              size="md"
              className="w-full font-medium"
            >
              <Home className="w-4 h-4 mr-2" />
              <span>Sanctuary Home</span>
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

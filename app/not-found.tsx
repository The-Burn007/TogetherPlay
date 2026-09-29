import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Compass, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background-canvas text-center selection:bg-brand selection:text-text-on-mint">
      <div className="max-w-md w-full bg-surface border border-border rounded-3xl p-8 sm:p-10 shadow-elevation-lg space-y-6 flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-raised border border-border flex items-center justify-center text-brand shadow-elevation-sm">
          <Compass className="w-8 h-8 animate-spin [animation-duration:12s]" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-raised border border-border text-[10px] font-mono text-text-muted uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
            <span>Coordinate Unknown</span>
          </div>

          <h1 className="text-2xl font-display font-medium text-text-primary tracking-tight">
            Room Coordinate Not Found (404)
          </h1>
          <p className="text-xs text-text-secondary leading-relaxed">
            This space does not exist in your shared hemisphere. Return to your couple sanctuary home to continue connecting.
          </p>
        </div>

        <div className="pt-2 w-full">
          <Link href="/home" className="w-full block">
            <Button variant="brand" size="lg" className="w-full font-semibold">
              <Home className="w-4 h-4 mr-2" />
              <span>Return to Shared Room</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

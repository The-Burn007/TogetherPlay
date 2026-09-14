import React from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface-deep">
      <LoadingSpinner size="lg" label="Synchronizing couple room..." />
    </div>
  );
}

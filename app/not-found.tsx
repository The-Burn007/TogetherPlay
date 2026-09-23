import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface-deep text-center">
      <div className="w-16 h-16 rounded-full bg-surface-raised border border-subtle-border flex items-center justify-center text-shared-amber mb-4 shadow-lg">
        <Compass className="w-8 h-8 animate-spin [animation-duration:8s]" />
      </div>
      <h2 className="text-xl font-semibold text-on-surface mb-2 font-mono">
        Room Coordinate Not Found (404)
      </h2>
      <p className="text-sm text-on-surface-variant max-w-sm mb-6 leading-relaxed">
        This room does not exist in your shared hemisphere. Return to your home sanctuary.
      </p>
      <Link href="/">
        <Button variant="amber">Return to Shared Room</Button>
      </Link>
    </div>
  );
}

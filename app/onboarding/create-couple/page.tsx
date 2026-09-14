"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import { coupleService } from "@/lib/firebase/services/couple";
import {
  Heart,
  Calendar,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Flame,
} from "lucide-react";

export default function CreateCouplePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [startDate, setStartDate] = useState<string>("");
  const [coupleNickname, setCoupleNickname] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast({
        message: "Please sign in before creating a couple sanctuary.",
        variant: "error",
      });
      router.push("/login");
      return;
    }

    setIsLoading(true);
    try {
      // Create couple space in Firestore with owner as initial member
      const newCouple = await coupleService.createCouple(
        user.uid,
        startDate ? startDate : undefined
      );

      showToast({
        message: "Your sanctuary space has been dedicated. Creating partner invite...",
        variant: "success",
      });

      // Advance directly to step 3: invite partner & waiting state
      router.push(`/onboarding/invite?coupleId=${newCouple.coupleId}`);
    } catch (err: any) {
      console.error("Create couple error:", err);
      showToast({
        message: err.message || "Failed to create couple space. Please try again.",
        variant: "error",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Navigation & Step Indicator */}
      <div className="flex items-center justify-between">
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </Link>
        <Badge variant="amber">Step 2 of 3</Badge>
      </div>

      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface-raised border border-shared-amber/30 text-shared-amber mx-auto shadow-sm">
          <Heart className="w-6 h-6 fill-current" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-on-surface tracking-tight">
          Dedicate Your Shared Space
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant max-w-sm mx-auto leading-relaxed">
          You are establishing the sacred room where only you and your partner
          will connect, play, and remember.
        </p>
      </div>

      {/* Form Card */}
      <Card variant="raised" className="p-6">
        <form onSubmit={handleCreate} className="space-y-5">
          {/* Couple Nickname / Space Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="coupleNickname"
              className="block text-xs font-semibold text-on-surface tracking-wide uppercase font-mono"
            >
              Sanctuary Name (Optional)
            </label>
            <Input
              id="coupleNickname"
              placeholder="e.g., Tokyo & London, Us, or Our Haven"
              value={coupleNickname}
              onChange={(e) => setCoupleNickname(e.target.value)}
              className="text-sm"
              disabled={isLoading}
            />
            <p className="text-[11px] text-on-surface-variant font-mono">
              A private title visible exclusively to you and your partner.
            </p>
          </div>

          {/* Relationship Milestone Date */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="startDate"
                className="block text-xs font-semibold text-on-surface tracking-wide uppercase font-mono"
              >
                Relationship Milestone (Optional)
              </label>
              <span className="text-[10px] text-shared-amber font-mono font-medium">
                Anniversary Counter
              </span>
            </div>
            <div className="relative">
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm font-mono"
                disabled={isLoading}
              />
            </div>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              When did your story start? We use this to celebrate daily milestones
              and days together across distance.
            </p>
          </div>

          {/* Security & Invariant Guarantee Notice */}
          <div className="p-3.5 rounded-xl bg-surface-deep/60 border border-subtle-border space-y-1.5 text-left">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
              <ShieldCheck className="w-4 h-4 text-player-two-sage" />
              <span>Two-Person Cryptographic Seal</span>
            </div>
            <p className="text-[11px] text-on-surface-variant leading-relaxed font-mono">
              In MVP, your sanctuary is strictly locked to exactly two partners:
              you and the person who accepts your invite. No third parties can ever
              join.
            </p>
          </div>

          {/* Submit CTA */}
          <Button
            type="submit"
            variant="amber"
            size="lg"
            isLoading={isLoading}
            className="w-full font-semibold"
          >
            <span>Create Space &amp; Generate Invite</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </form>
      </Card>
    </div>
  );
}

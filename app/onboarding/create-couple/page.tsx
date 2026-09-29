"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import { coupleService } from "@/lib/firebase/services/couple";
import { motion } from "motion/react";
import {
  Heart,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
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
      const newCouple = await coupleService.createCouple(
        user.uid,
        startDate ? startDate : undefined
      );

      showToast({
        message: "Your sanctuary space has been dedicated. Creating partner invite...",
        variant: "success",
      });

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-lg mx-auto py-6 sm:py-10"
    >
      {/* Navigation & Step Indicator */}
      <div className="flex items-center justify-between">
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </Link>
        <Badge variant="brand">Step 2 of 3</Badge>
      </div>

      {/* Header */}
      <div className="space-y-3 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface border border-border text-brand mx-auto shadow-elevation-sm">
          <Heart className="w-6 h-6 fill-current" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-display font-medium text-text-primary tracking-tight">
            Dedicate Shared Space
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary max-w-sm mx-auto leading-relaxed">
            You are establishing the sacred room where only you and your partner
            will connect, play, and remember.
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-7 shadow-elevation-md">
        <form onSubmit={handleCreate} className="space-y-5">
          {/* Couple Nickname / Space Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="coupleNickname"
              className="block text-xs font-semibold text-text-primary tracking-wider uppercase font-mono"
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
            <p className="text-[11px] text-text-muted font-mono">
              A private title visible exclusively to you and your partner.
            </p>
          </div>

          {/* Relationship Milestone Date */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="startDate"
                className="block text-xs font-semibold text-text-primary tracking-wider uppercase font-mono"
              >
                Relationship Milestone (Optional)
              </label>
              <span className="text-[10px] text-brand font-mono font-medium">
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
            <p className="text-[11px] text-text-muted leading-relaxed">
              When did your story start? We use this to celebrate daily milestones
              and days together across distance.
            </p>
          </div>

          {/* Security & Invariant Guarantee Notice */}
          <div className="p-4 rounded-xl bg-background-canvas border border-border-subtle space-y-1.5 text-left">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
              <ShieldCheck className="w-4 h-4 text-brand" />
              <span>Two-Person Cryptographic Seal</span>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed font-mono">
              Your sanctuary is strictly locked to exactly two partners:
              you and the person who accepts your invite. No third parties can ever join.
            </p>
          </div>

          {/* Submit CTA */}
          <Button
            type="submit"
            variant="brand"
            size="lg"
            isLoading={isLoading}
            className="w-full font-semibold"
          >
            <span>Create Space &amp; Generate Invite</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </form>
      </div>
    </motion.div>
  );
}

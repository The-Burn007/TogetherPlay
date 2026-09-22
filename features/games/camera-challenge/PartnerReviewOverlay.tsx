"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, XCircle, Heart, ShieldCheck, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { CameraChallengeReview } from "@/types/domain";

interface PartnerReviewOverlayProps {
  partnerName: string;
  partnerId: string;
  myUserId: string;
  reviews: Record<string, CameraChallengeReview>;
  isSubmitting: boolean;
  onApprove: (feedback?: string) => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
}

export const PartnerReviewOverlay: React.FC<PartnerReviewOverlayProps> = ({
  partnerName,
  partnerId,
  myUserId,
  reviews,
  isSubmitting,
  onApprove,
  onReject,
}) => {
  const myReview = reviews[myUserId];
  const partnerReview = reviews[partnerId];
  const [feedback, setFeedback] = useState("");

  const handleApprove = async () => {
    if (isSubmitting || myReview) return;
    await onApprove(feedback.trim() || undefined);
  };

  const handleReject = async () => {
    if (isSubmitting || myReview) return;
    await onReject(feedback.trim() || undefined);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 bg-black/65 backdrop-blur-md select-none"
    >
      <motion.div
        initial={{ scale: 0.92, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: -12, opacity: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative max-w-lg w-full bg-neutral-900/95 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.2)] text-center overflow-hidden"
      >
        {/* Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-56 h-56 bg-amber-500/15 blur-3xl rounded-full pointer-events-none" />

        {/* Stage Badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-amber-500/10 border border-amber-500/30 text-amber-300 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>STAGE: PARTNER REVIEW</span>
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-100 tracking-tight">
          Verify Partner&apos;s Challenge
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-neutral-300 font-light max-w-md mx-auto">
          Did <span className="font-semibold text-amber-300">{partnerName}</span> accomplish the prompt on camera?
        </p>

        {/* Status Indicators */}
        <div className="mt-5 grid grid-cols-2 gap-3 text-left">
          {/* My Review Status */}
          <div className="p-3.5 rounded-2xl bg-neutral-950/70 border border-neutral-800">
            <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400 block mb-1">
              Your Review
            </span>
            {myReview ? (
              <div className="flex items-center space-x-2 text-xs font-medium">
                {myReview.approved ? (
                  <span className="inline-flex items-center text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Approved
                  </span>
                ) : (
                  <span className="inline-flex items-center text-rose-400">
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Rejected
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 text-amber-400 text-xs font-medium animate-pulse">
                <Clock className="w-3.5 h-3.5" />
                <span>Pending your vote</span>
              </div>
            )}
          </div>

          {/* Partner Review Status */}
          <div className="p-3.5 rounded-2xl bg-neutral-950/70 border border-neutral-800">
            <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400 block mb-1">
              {partnerName}&apos;s Review
            </span>
            {partnerReview ? (
              <div className="flex items-center space-x-2 text-xs font-medium">
                {partnerReview.approved ? (
                  <span className="inline-flex items-center text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Approved you!
                  </span>
                ) : (
                  <span className="inline-flex items-center text-rose-400">
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Requested retry
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 text-neutral-400 text-xs font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>Waiting for partner...</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {!myReview ? (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              id="reject-partner-button"
              variant="outline"
              size="md"
              disabled={isSubmitting}
              onClick={handleReject}
              className="w-full sm:w-1/2 border-rose-900/60 text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 text-xs font-medium"
            >
              <XCircle className="w-4 h-4 mr-1.5 text-rose-400" />
              Request Retry (0 PTS)
            </Button>

            <Button
              id="approve-partner-button"
              variant="amber"
              size="lg"
              disabled={isSubmitting}
              onClick={handleApprove}
              className="w-full sm:w-1/2 shadow-xl shadow-amber-950/40 text-xs font-semibold"
            >
              <Heart className="w-4 h-4 mr-1.5 fill-current text-amber-900" />
              Approve Challenge (+100 PTS)
            </Button>
          </div>
        ) : (
          <div className="mt-6 p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 text-xs text-neutral-300 flex items-center justify-center space-x-2">
            <Clock className="w-4 h-4 text-amber-400 animate-spin" />
            <span>Review submitted! Waiting for both decisions to resolve round...</span>
          </div>
        )}

        {/* Media Privacy Assurance */}
        <div className="mt-5 flex items-center justify-center space-x-2 text-[11px] text-neutral-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>P2P live review. No photos or media are saved to disk or server.</span>
        </div>
      </motion.div>
    </motion.div>
  );
};

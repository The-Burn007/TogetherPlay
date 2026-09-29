"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/lib/auth/AuthContext";
import { auth } from "@/lib/firebase/client";
import { coupleService, type CreateInviteResult } from "@/lib/firebase/services/couple";
import type { Couple, CoupleInvite } from "@/types/domain";
import { motion } from "motion/react";
import {
  Heart,
  Copy,
  Check,
  Share2,
  Sparkles,
  ArrowRight,
  KeyRound,
  Radio,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const queryCoupleId = searchParams.get("coupleId");
  const queryInviteId = searchParams.get("id");
  const queryCode = searchParams.get("code");

  // Mode: "inviter" (sharing & waiting) vs "acceptor" (accepting incoming invite)
  const [mode, setMode] = useState<"inviter" | "acceptor">("inviter");

  // Inviter state
  const [inviteData, setInviteData] = useState<CreateInviteResult | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isPartnerJoined, setIsPartnerJoined] = useState(false);

  // Acceptor state
  const [manualCode, setManualCode] = useState(queryCode || "");
  const [manualInviteId, setManualInviteId] = useState(queryInviteId || "");
  const [invitePreview, setInvitePreview] = useState<CoupleInvite | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptedSuccess, setAcceptedSuccess] = useState(false);

  // 1. Determine mode based on params or user state
  useEffect(() => {
    if (queryInviteId || queryCode) {
      setMode("acceptor");
    } else {
      setMode("inviter");
    }
  }, [queryInviteId, queryCode]);

  // 2. Inviter Mode: Ensure couple and generate secure invitation
  useEffect(() => {
    if (mode !== "inviter" || !user) return;

    let isMounted = true;
    let unsubscribeCouple: (() => void) | null = null;

    const setupInviterState = async () => {
      setIsGeneratingInvite(true);
      try {
        let activeCouple: Couple | null = null;
        if (queryCoupleId) {
          activeCouple = await coupleService.getCouple(queryCoupleId);
        }
        if (!activeCouple) {
          activeCouple = await coupleService.getUserCouple(user.uid);
        }

        if (!activeCouple) {
          router.push("/onboarding/create-couple");
          return;
        }

        if (!isMounted) return;
        setCouple(activeCouple);

        if (activeCouple.memberIds.length >= 2) {
          setIsPartnerJoined(true);
          return;
        }

        const inv = await coupleService.createInvitation(
          activeCouple.coupleId,
          user.uid,
          user.displayName || user.email || "Your Partner"
        );

        if (!isMounted) return;
        setInviteData(inv);

        unsubscribeCouple = coupleService.subscribeToCouple(
          activeCouple.coupleId,
          (updatedCouple) => {
            if (!updatedCouple) return;
            setCouple(updatedCouple);
            if (updatedCouple.memberIds.length >= 2) {
              setIsPartnerJoined(true);
              showToast({
                message: "Your partner joined! Sanctuary is now complete.",
                variant: "success",
              });
            }
          }
        );
      } catch (err: any) {
        console.error("Inviter setup error:", err);
        showToast({
          message: "Failed to initialize couple invite.",
          variant: "error",
        });
      } finally {
        if (isMounted) setIsGeneratingInvite(false);
      }
    };

    setupInviterState();

    return () => {
      isMounted = false;
      if (unsubscribeCouple) unsubscribeCouple();
    };
  }, [mode, user, queryCoupleId, router, showToast]);

  // 3. Acceptor Mode: Load invite preview when queryInviteId exists
  useEffect(() => {
    if (mode !== "acceptor" || !queryInviteId) return;

    let isMounted = true;
    const loadPreview = async () => {
      setIsLoadingPreview(true);
      try {
        const preview = await coupleService.getInvitation(queryInviteId);
        if (isMounted) {
          setInvitePreview(preview);
        }
      } catch (err) {
        console.error("Failed to load invitation preview:", err);
      } finally {
        if (isMounted) setIsLoadingPreview(false);
      }
    };

    loadPreview();
    return () => {
      isMounted = false;
    };
  }, [mode, queryInviteId]);

  const handleCopyCode = async () => {
    if (!inviteData?.pairingCode) return;
    try {
      await navigator.clipboard.writeText(inviteData.pairingCode);
      setCopiedCode(true);
      showToast({ message: "Pairing code copied to clipboard.", variant: "info" });
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      showToast({ message: "Failed to copy code.", variant: "error" });
    }
  };

  const handleCopyLink = async () => {
    if (!inviteData?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteData.inviteUrl);
      setCopiedLink(true);
      showToast({ message: "Sanctuary link copied.", variant: "info" });
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast({ message: "Failed to copy link.", variant: "error" });
    }
  };

  const handleShare = async () => {
    if (!inviteData) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Step into our TogetherPlay sanctuary",
          text: `Join me in our private couple space on TogetherPlay. Pairing Code: ${inviteData.pairingCode}`,
          url: inviteData.inviteUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyLink();
    }
  };

  const handleAcceptInvite = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!isAuthenticated || !user) {
      const returnUrl = `/onboarding/invite?id=${encodeURIComponent(
        manualInviteId
      )}&code=${encodeURIComponent(manualCode)}`;
      router.push(`/login?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }

    const targetInviteId = manualInviteId || queryInviteId;
    const targetCode = manualCode || queryCode;

    if (!targetInviteId || !targetCode) {
      showToast({
        message: "Please enter both the invitation ID and pairing code.",
        variant: "error",
      });
      return;
    }

    setIsAccepting(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/couples/accept-invite", {
        method: "POST",
        headers,
        body: JSON.stringify({
          inviteId: targetInviteId.trim(),
          code: targetCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to accept invitation.");
      }

      setAcceptedSuccess(true);
      showToast({
        message: "You and your person are now connected in your sanctuary!",
        variant: "success",
      });

      setTimeout(() => {
        router.push("/home");
      }, 1500);
    } catch (err: any) {
      console.error("Accept invite error:", err);
      showToast({
        message: err.message || "Failed to join couple space.",
        variant: "error",
      });
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-lg mx-auto py-6 sm:py-10"
    >
      {/* Mode Switch Tabs (Inviter vs Enter Code) */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <Link
          href="/onboarding"
          className="text-xs text-text-muted hover:text-text-primary font-mono transition-colors"
        >
          ← Sanctuary
        </Link>

        <div className="flex items-center gap-1 bg-surface border border-border rounded-full p-1 text-[11px] font-mono">
          <button
            onClick={() => setMode("inviter")}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              mode === "inviter"
                ? "bg-brand text-text-on-mint font-semibold shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Invite Partner
          </button>
          <button
            onClick={() => setMode("acceptor")}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              mode === "acceptor"
                ? "bg-brand text-text-on-mint font-semibold shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Enter Code
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCENARIO A: INVITER MODE (Waiting State & Share Invitation)               */}
      {/* ========================================================================= */}
      {mode === "inviter" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-[11px] font-mono text-brand">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Step 3 of 3 · Partner Pairing</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-medium text-text-primary tracking-tight">
              Invite Your Person
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary max-w-sm mx-auto leading-relaxed">
              Send this private pairing link or code to your partner. Once they step
              in, your shared world awakens.
            </p>
          </div>

          {/* Invitation Card */}
          {isGeneratingInvite ? (
            <div className="bg-surface border border-border rounded-2xl p-8 flex flex-col items-center justify-center space-y-3 shadow-elevation-md">
              <LoadingSpinner size="md" label="Preparing your private pairing key..." />
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-2xl p-6 sm:p-7 space-y-6 shadow-elevation-md">
              {/* Pairing Code Spotlight */}
              <div className="text-center space-y-2 p-5 rounded-2xl bg-background-canvas border border-border-strong relative overflow-hidden">
                <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                  Private Pairing Code
                </span>
                <div className="text-2xl sm:text-3xl font-mono font-bold text-brand tracking-widest select-all">
                  {inviteData?.pairingCode || "SANCT-PAIR-CODE"}
                </div>
                <p className="text-[10px] text-text-muted font-mono">
                  SHA-256 cryptographic seal · Single-use for your partner only
                </p>
              </div>

              {/* Action Buttons: Copy Code, Copy Link, Native Share */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Button
                  variant="brand"
                  size="md"
                  onClick={handleCopyLink}
                  className="w-full justify-center"
                >
                  {copiedLink ? (
                    <Check className="w-4 h-4 mr-1.5 text-text-on-mint" />
                  ) : (
                    <Copy className="w-4 h-4 mr-1.5" />
                  )}
                  <span>{copiedLink ? "Link Copied!" : "Copy Invite Link"}</span>
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  onClick={handleShare}
                  className="w-full justify-center"
                >
                  <Share2 className="w-4 h-4 mr-1.5 text-brand" />
                  <span>Send via Message</span>
                </Button>
              </div>

              {/* LIVE PARTNER CONNECTION & WAITING STATE */}
              <div className="pt-2 border-t border-border space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-text-muted uppercase text-[10px] tracking-wider">
                    Sanctuary Connection State
                  </span>
                  <Badge variant={isPartnerJoined ? "brand" : "neutral"}>
                    {isPartnerJoined ? "Connected" : "Waiting for Partner"}
                  </Badge>
                </div>

                {/* Visual Interlock Ripple Indicator */}
                <div className="p-5 rounded-2xl bg-background-canvas border border-border-subtle flex flex-col items-center justify-center space-y-3">
                  <div className="relative flex items-center justify-center py-2">
                    {/* Pulsing Aura if waiting */}
                    {!isPartnerJoined && (
                      <span className="absolute w-16 h-16 rounded-full bg-brand/20 animate-ping" />
                    )}

                    <div className="relative flex items-center -space-x-2">
                      {/* Inviter Node */}
                      <div className="w-11 h-11 rounded-full bg-surface border-2 border-player-one-ember flex items-center justify-center text-player-one-ember shadow-md">
                        <span className="text-xs font-bold font-mono">
                          {user?.displayName?.slice(0, 1) || "You"}
                        </span>
                      </div>

                      {/* Cord Connector */}
                      <div
                        className={`w-10 h-1 transition-all ${
                          isPartnerJoined ? "bg-brand" : "bg-border-strong"
                        }`}
                      />

                      {/* Partner Node */}
                      <div
                        className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all ${
                          isPartnerJoined
                            ? "bg-surface border-player-two-sage text-player-two-sage shadow-md"
                            : "bg-surface-raised border-dashed border-border text-text-muted"
                        }`}
                      >
                        {isPartnerJoined ? (
                          <CheckCircle2 className="w-5 h-5 text-player-two-sage" />
                        ) : (
                          <Radio className="w-4 h-4 animate-pulse text-brand" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Label */}
                  <div className="text-center space-y-1">
                    <p className="text-xs font-medium text-text-primary">
                      {isPartnerJoined
                        ? "Partner connected! Your sanctuary is now complete."
                        : "Listening for your partner's connection..."}
                    </p>
                    <p className="text-[11px] text-text-muted font-mono">
                      {isPartnerJoined
                        ? "All relationship rooms, memories, and duels unlocked."
                        : "Keep this tab open or share the link. We'll alert you instantly."}
                    </p>
                  </div>

                  {/* Enter Sanctuary Button when Connected */}
                  {isPartnerJoined && (
                    <Button
                      variant="brand"
                      size="lg"
                      onClick={() => router.push("/home")}
                      className="w-full mt-2 font-semibold"
                    >
                      <span>Enter TogetherPlay</span>
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCENARIO B: ACCEPTOR MODE (Join Partner's Sanctuary)                      */}
      {/* ========================================================================= */}
      {mode === "acceptor" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-[11px] font-mono text-brand">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Sanctuary Admission</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-medium text-text-primary tracking-tight">
              Step Into Your Space
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary max-w-sm mx-auto leading-relaxed">
              Your partner has initiated your private TogetherPlay room. Confirm your
              pairing code to link your accounts.
            </p>
          </div>

          {/* Invitation Preview Card */}
          {invitePreview && (
            <div className="p-5 rounded-2xl bg-surface border border-border space-y-3 shadow-elevation-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-raised border border-border flex items-center justify-center text-brand">
                  <Heart className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
                    Invited By
                  </span>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {invitePreview.inviterName || "Your Partner"}
                  </h3>
                </div>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                This room is exclusively designated for the two of you. No other users
                can view your live presence or memories.
              </p>
            </div>
          )}

          {/* Accept Form Card */}
          <div className="bg-surface border border-border rounded-2xl p-6 sm:p-7 shadow-elevation-md">
            <form onSubmit={handleAcceptInvite} className="space-y-4">
              {/* Pairing Code Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="pairingCode"
                  className="block text-xs font-semibold text-text-primary tracking-wider uppercase font-mono"
                >
                  Pairing Code
                </label>
                <Input
                  id="pairingCode"
                  placeholder="e.g. SANCT-7K9M-3W2P"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  className="font-mono text-sm uppercase tracking-wider"
                  disabled={isAccepting || acceptedSuccess}
                  required
                />
              </div>

              {/* Invite ID (if entering manually) */}
              {!queryInviteId && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="inviteId"
                    className="block text-xs font-semibold text-text-primary tracking-wider uppercase font-mono"
                  >
                    Invitation ID
                  </label>
                  <Input
                    id="inviteId"
                    placeholder="e.g. inv_82f91..."
                    value={manualInviteId}
                    onChange={(e) => setManualInviteId(e.target.value)}
                    className="font-mono text-xs"
                    disabled={isAccepting || acceptedSuccess}
                    required
                  />
                  <p className="text-[10px] text-text-muted font-mono">
                    Found at the end of the invite URL or provided by your partner.
                  </p>
                </div>
              )}

              {/* Security Invariant Notice */}
              <div className="p-3.5 rounded-xl bg-background-canvas border border-border-subtle space-y-1 text-left">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                  <ShieldCheck className="w-4 h-4 text-brand" />
                  <span>Verified Partner Membership</span>
                </div>
                <p className="text-[10px] text-text-muted font-mono leading-relaxed">
                  Accepting permanently links your profile as Player Two. The couple
                  space will be locked from any further members.
                </p>
              </div>

              {/* Submit CTA */}
              <Button
                type="submit"
                variant="brand"
                size="lg"
                isLoading={isAccepting}
                disabled={acceptedSuccess}
                className="w-full font-semibold"
              >
                {acceptedSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    <span>Connected! Entering sanctuary...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4 mr-1.5" />
                    <span>Accept Invitation &amp; Step In</span>
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function OnboardingInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 flex flex-col items-center justify-center">
          <LoadingSpinner size="lg" label="Loading invitation sanctuary..." />
        </div>
      }
    >
      <InviteContent />
    </Suspense>
  );
}

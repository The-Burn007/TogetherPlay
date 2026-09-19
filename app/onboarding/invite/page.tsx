"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/lib/auth/AuthContext";
import { auth } from "@/lib/firebase/client";
import { coupleService, type CreateInviteResult } from "@/lib/firebase/services/couple";
import type { Couple, CoupleInvite } from "@/types/domain";
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
  Clock,
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
        // Resolve active couple: either from query or user profile
        let activeCouple: Couple | null = null;
        if (queryCoupleId) {
          activeCouple = await coupleService.getCouple(queryCoupleId);
        }
        if (!activeCouple) {
          activeCouple = await coupleService.getUserCouple(user.uid);
        }

        if (!activeCouple) {
          // If no couple exists yet, direct to create step
          router.push("/onboarding/create-couple");
          return;
        }

        if (!isMounted) return;
        setCouple(activeCouple);

        // If couple already has 2 members, connection is complete
        if (activeCouple.memberIds.length >= 2) {
          setIsPartnerJoined(true);
          return;
        }

        // Generate high-entropy invite with SHA-256 hash in database
        const inv = await coupleService.createInvitation(
          activeCouple.coupleId,
          user.uid,
          user.displayName || user.email || "Your Partner"
        );

        if (!isMounted) return;
        setInviteData(inv);

        // Real-time listener: detects instant partner connection
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

  // Copy code handler
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

  // Copy full invite link handler
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

  // Native Web Share API handler
  const handleShare = async () => {
    if (!inviteData) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Step into our TogetherPlay sanctuary",
          text: `Join me in our private couple space on TogetherPlay. Pairing Code: ${inviteData.pairingCode}`,
          url: inviteData.inviteUrl,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      handleCopyLink();
    }
  };

  // Accept invite handler (using server API route or client service)
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

      // Server-side verification & atomic transaction membership change
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

      // Redirect into sanctuary home
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
    <div className="space-y-6 animate-fade-in">
      {/* Mode Switch Tabs (Inviter vs Enter Code) */}
      <div className="flex items-center justify-between border-b border-subtle-border pb-3">
        <Link
          href="/onboarding"
          className="text-xs text-on-surface-variant hover:text-on-surface font-mono transition-colors"
        >
          ← Sanctuary
        </Link>

        <div className="flex items-center gap-1 bg-surface-raised border border-subtle-border rounded-full p-1 text-[11px] font-mono">
          <button
            onClick={() => setMode("inviter")}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              mode === "inviter"
                ? "bg-surface-overlay text-shared-amber font-semibold shadow-xs"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Invite Partner
          </button>
          <button
            onClick={() => setMode("acceptor")}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              mode === "acceptor"
                ? "bg-surface-overlay text-player-two-sage font-semibold shadow-xs"
                : "text-on-surface-variant hover:text-on-surface"
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
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-raised border border-subtle-border text-[11px] font-mono text-shared-amber">
              <Sparkles className="w-3 h-3" />
              <span>Step 3 of 3 · Partner Pairing</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-on-surface tracking-tight">
              Invite Your Person
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant max-w-sm mx-auto leading-relaxed">
              Send this private pairing link or code to your partner. Once they step
              in, your shared world awakens.
            </p>
          </div>

          {/* Invitation Card */}
          {isGeneratingInvite ? (
            <Card variant="raised" className="p-8 flex flex-col items-center justify-center space-y-3">
              <LoadingSpinner size="md" label="Preparing your private pairing key..." />
            </Card>
          ) : (
            <Card variant="raised" className="p-6 space-y-6">
              {/* Pairing Code Spotlight */}
              <div className="text-center space-y-2 p-4 rounded-xl bg-surface-deep/80 border border-shared-amber/30 relative overflow-hidden">
                <span className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
                  Private Pairing Code
                </span>
                <div className="text-2xl sm:text-3xl font-mono font-bold text-shared-amber tracking-wider select-all">
                  {inviteData?.pairingCode || "SANCT-PAIR-CODE"}
                </div>
                <p className="text-[10px] text-on-surface-variant/80 font-mono">
                  SHA-256 cryptographic seal · Single-use for your partner only
                </p>
              </div>

              {/* Action Buttons: Copy Code, Copy Link, Native Share */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Button
                  variant="amber"
                  size="md"
                  onClick={handleCopyLink}
                  className="w-full justify-center"
                >
                  {copiedLink ? (
                    <Check className="w-4 h-4 mr-1.5 text-player-two-sage" />
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
                  <Share2 className="w-4 h-4 mr-1.5" />
                  <span>Send via Message</span>
                </Button>
              </div>

              {/* LIVE PARTNER CONNECTION & WAITING STATE */}
              <div className="pt-2 border-t border-subtle-border space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-on-surface-variant uppercase text-[10px] tracking-wider">
                    Sanctuary Connection State
                  </span>
                  <Badge variant={isPartnerJoined ? "sage" : "amber"}>
                    {isPartnerJoined ? "Connected" : "Waiting for Partner"}
                  </Badge>
                </div>

                {/* Visual Interlock Ripple Indicator */}
                <div className="p-4 rounded-xl bg-surface-base border border-subtle-border flex flex-col items-center justify-center space-y-3">
                  <div className="relative flex items-center justify-center">
                    {/* Pulsing Aura if waiting */}
                    {!isPartnerJoined && (
                      <span className="absolute w-14 h-14 rounded-full bg-shared-amber/20 animate-ping" />
                    )}

                    <div className="relative flex items-center -space-x-2">
                      {/* Inviter Node */}
                      <div className="w-10 h-10 rounded-full bg-surface-raised border-2 border-player-one-ember flex items-center justify-center text-player-one-ember shadow-md">
                        <span className="text-xs font-bold font-mono">
                          {user?.displayName?.slice(0, 1) || "You"}
                        </span>
                      </div>

                      {/* Cord Connector */}
                      <div
                        className={`w-8 h-1 transition-all ${
                          isPartnerJoined ? "bg-shared-amber" : "bg-subtle-border"
                        }`}
                      />

                      {/* Partner Node */}
                      <div
                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                          isPartnerJoined
                            ? "bg-surface-raised border-player-two-sage text-player-two-sage shadow-md"
                            : "bg-surface-deep border-dashed border-on-surface-variant/40 text-on-surface-variant/40"
                        }`}
                      >
                        {isPartnerJoined ? (
                          <CheckCircle2 className="w-5 h-5 text-player-two-sage" />
                        ) : (
                          <Radio className="w-4 h-4 animate-pulse text-shared-amber" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Label */}
                  <div className="text-center space-y-1">
                    <p className="text-xs font-medium text-on-surface">
                      {isPartnerJoined
                        ? "Partner connected! Your sanctuary is now complete."
                        : "Listening for your partner's connection..."}
                    </p>
                    <p className="text-[11px] text-on-surface-variant font-mono">
                      {isPartnerJoined
                        ? "All relationship rooms, memories, and duels unlocked."
                        : "Keep this tab open or share the link. We'll alert you instantly."}
                    </p>
                  </div>

                  {/* Enter Sanctuary Button when Connected */}
                  {isPartnerJoined && (
                    <Button
                      variant="sage"
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
            </Card>
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
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-raised border border-subtle-border text-[11px] font-mono text-player-two-sage">
              <KeyRound className="w-3 h-3" />
              <span>Sanctuary Admission</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-on-surface tracking-tight">
              Step Into Your Space
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant max-w-sm mx-auto leading-relaxed">
              Your partner has initiated your private TogetherPlay room. Confirm your
              pairing code to link your accounts.
            </p>
          </div>

          {/* Invitation Preview Card */}
          {invitePreview && (
            <Card
              variant="raised"
              className="p-5 border-player-two-sage/40 bg-gradient-to-b from-surface-raised to-player-two-sage/5 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-player-two-sage/20 border border-player-two-sage flex items-center justify-center text-player-two-sage">
                  <Heart className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <span className="text-xs font-mono text-on-surface-variant uppercase tracking-wider">
                    Invited By
                  </span>
                  <h3 className="text-sm font-semibold text-on-surface">
                    {invitePreview.inviterName || "Your Partner"}
                  </h3>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                This room is exclusively designated for the two of you. No other users
                can view your live presence or memories.
              </p>
            </Card>
          )}

          {/* Accept Form Card */}
          <Card variant="raised" className="p-6">
            <form onSubmit={handleAcceptInvite} className="space-y-4">
              {/* Pairing Code Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="pairingCode"
                  className="block text-xs font-semibold text-on-surface tracking-wide uppercase font-mono"
                >
                  8-Character Pairing Code
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
                    className="block text-xs font-semibold text-on-surface tracking-wide uppercase font-mono"
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
                  <p className="text-[10px] text-on-surface-variant font-mono">
                    Found at the end of the invite URL or provided by your partner.
                  </p>
                </div>
              )}

              {/* Security Invariant Notice */}
              <div className="p-3 rounded-lg bg-surface-deep/70 border border-subtle-border space-y-1 text-left">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-on-surface">
                  <ShieldCheck className="w-3.5 h-3.5 text-player-two-sage" />
                  <span>Verified Partner Membership</span>
                </div>
                <p className="text-[10px] text-on-surface-variant font-mono leading-relaxed">
                  Accepting permanently links your profile as Player Two. The couple
                  space will be locked from any further members.
                </p>
              </div>

              {/* Submit CTA */}
              <Button
                type="submit"
                variant="sage"
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
          </Card>
        </div>
      )}
    </div>
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

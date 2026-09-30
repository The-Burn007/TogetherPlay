"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  homeService,
  getPresetHomeData,
  type HomePresetKey,
  type HomeSanctuaryState,
} from "@/lib/firebase/services/home";
import { HomeStateSelector } from "@/features/home/HomeStateSelector";
import { HomePresenceHero } from "@/features/home/HomePresenceHero";
import { CurrentSharedActivityCard } from "@/features/home/CurrentSharedActivityCard";
import { TodayOpportunityCard } from "@/features/home/TodayOpportunityCard";
import { HomeGamesSection } from "@/features/home/HomeGamesSection";
import { HomeMemoriesSection } from "@/features/home/HomeMemoriesSection";
import { HomeSecondaryInfo } from "@/features/home/HomeSecondaryInfo";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { WifiOff, RefreshCw, UserPlus, Heart, Sparkles, ArrowRight, Settings } from "lucide-react";

function HomeContent() {
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();

  // Debug mechanism: strictly disabled in production builds.
  // A production user adding ?debug=true or ?preset=... must NOT gain access to fake preset states.
  const isDev = process.env.NODE_ENV !== "production";
  const isDebug = isDev && (searchParams.get("debug") === "true" || !!searchParams.get("preset"));
  const queryPreset = isDebug ? (searchParams.get("preset") as HomePresetKey | null) : null;

  // Production defaults strictly to "live" data; presets only available in explicit dev debug flow
  const [activePreset, setActivePreset] = useState<HomePresetKey>(() => (isDev && queryPreset ? queryPreset : "live"));
  const [sanctuaryState, setSanctuaryState] = useState<HomeSanctuaryState | null>(() => {
    // Only initialize synchronously with preset if in development explicit debug mode with non-live preset
    if (isDev && isDebug && queryPreset && queryPreset !== "live") {
      try {
        return getPresetHomeData(queryPreset, user?.displayName || "Alex");
      } catch {
        return null;
      }
    }
    return null;
  });

  const sanctuaryStateRef = useRef<HomeSanctuaryState | null>(sanctuaryState);
  sanctuaryStateRef.current = sanctuaryState;

  const [isLoading, setIsLoading] = useState<boolean>(!queryPreset || queryPreset === "live");
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLiveUnavailable, setIsLiveUnavailable] = useState<boolean>(false);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (activePreset === "live" || !isDev) {
        if (!sanctuaryStateRef.current) {
          setIsLoading(true);
        } else {
          setIsRetrying(true);
        }
        setError(null);

        try {
          if (user?.uid) {
            const liveData = await homeService.fetchLiveHomeData(user.uid);
            if (isMounted) {
              setSanctuaryState(liveData);
              setError(null);
              setIsLiveUnavailable(false);
            }
          } else if (!isAuthLoading) {
            // Unauthenticated state
            if (isMounted) {
              setSanctuaryState(null);
              setError(null);
              setIsLiveUnavailable(false);
            }
          }
        } catch (err) {
          console.warn("Unable to load live sanctuary state:", err);
          if (isMounted) {
            // State E & G: Truthful failure handling
            setIsLiveUnavailable(true);
            setError("Unable to synchronize your sanctuary");

            // Requirement 4:
            // For a temporary failure:
            // * preserve last known truthful state if one exists
            // * otherwise show an explicit unavailable state
            // * provide Retry
            // * never manufacture partner presence
            setSanctuaryState((prevState) => {
              if (!prevState) return null; // State G: Initial failure -> full unavailable screen
              
              // State E: Preserve previous state structure, but update presence to mark it unverified
              return {
                ...prevState,
                partner: prevState.partner
                  ? {
                      ...prevState.partner,
                      presenceState: "offline",
                      activityDetail: "Presence unavailable (sync paused)",
                    }
                  : null,
                presenceStatusHeadline: prevState.partner
                  ? `${prevState.partner.displayName} · Presence unverified (sync paused)`
                  : prevState.presenceStatusHeadline,
                presenceActionPrompt: "Reconnecting...",
              };
            });
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
            setIsRetrying(false);
          }
        }
      } else if (isDev) {
        // Debug mode preset selection (development only)
        setError(null);
        setIsLiveUnavailable(false);
        setIsLoading(false);
        try {
          setSanctuaryState(getPresetHomeData(activePreset, user?.displayName || "Alex"));
        } catch (err) {
          console.warn("Preset load failed:", err);
          setSanctuaryState(null);
        }
      }
    }

    if (!isAuthLoading) {
      loadData();
    }

    return () => {
      isMounted = false;
    };
  }, [activePreset, user?.uid, user?.displayName, isAuthLoading, retryTrigger, isDev]);

  const handleRetry = () => {
    setIsRetrying(true);
    setRetryTrigger((prev) => prev + 1);
  };

  return (
    <Container size="md" className="space-y-6 sm:space-y-7 pb-16 pt-0">
      {/* 0. Developer State Selector (Strictly hidden in production; dev-only via ?debug=true) */}
      {isDebug && isDev && (
        <HomeStateSelector
          currentPreset={activePreset}
          onSelectPreset={(preset) => {
            if (!isDev) return;
            setActivePreset(preset);
            if (preset !== "live") {
              try {
                setSanctuaryState(getPresetHomeData(preset, user?.displayName || "Alex"));
                setError(null);
                setIsLiveUnavailable(false);
              } catch {
                setSanctuaryState(null);
              }
            }
          }}
          coupleId={sanctuaryState?.coupleId}
        />
      )}

      {/* State A: Loading Live Data (Initial load or unhydrated state) */}
      {(isLoading || isAuthLoading) && !sanctuaryState && (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="space-y-6 py-6 animate-pulse"
        >
          <CardSkeleton />
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
            <LoadingSpinner size="md" label="Synchronizing relationship sanctuary across hemispheres..." />
            <p className="text-xs text-text-muted font-mono tracking-wider uppercase">
              Authenticating private sanctuary...
            </p>
          </div>
          <CardSkeleton />
        </div>
      )}

      {/* State E: Authenticated + couple exists + live data temporarily unavailable (with preserved last known truthful state) */}
      {!isLoading && !isAuthLoading && isLiveUnavailable && sanctuaryState && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-warm-cream">
                Sanctuary Live Sync Paused
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                Showing last known relationship space. Partner live presence cannot be verified while disconnected.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="self-start sm:self-auto px-4 py-2 rounded-xl bg-surface-raised hover:bg-surface border border-border text-xs font-semibold text-warm-cream flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-brand cursor-pointer disabled:opacity-50 transition-all active:scale-95 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`} aria-hidden="true" />
            <span>{isRetrying ? "Reconnecting..." : "Retry Connection"}</span>
          </button>
        </div>
      )}

      {/* State G: Network / Service Failure (No last known state to show) */}
      {!isLoading && !isAuthLoading && error && !sanctuaryState && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-3xl bg-surface border border-border/80 p-8 sm:p-12 text-center max-w-lg mx-auto my-6 space-y-6 shadow-elevation-md"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-raised border border-border flex items-center justify-center text-amber-400">
            <WifiOff className="w-7 h-7" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-serif text-warm-cream">
              Unable to load your sanctuary
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              We couldn’t synchronize your couple space right now. Your private relationship data is safe. Please check your connection and try again.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand text-text-on-mint font-semibold text-sm hover:bg-brand-hover active:bg-brand-active transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm focus-visible:outline-2 focus-visible:outline-brand"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`} aria-hidden="true" />
              <span>{isRetrying ? "Connecting..." : "Retry Connection"}</span>
            </button>
          </div>
        </div>
      )}

      {/* State B & State F (Scenario 1): Authenticated without Partner Connected (No Couple or Incomplete Couple) */}
      {!isLoading && !isAuthLoading && sanctuaryState && sanctuaryState.partner === null && (
        <div className="space-y-6">
          {/* Sanctuary Hero for Awaiting / Connecting Partner */}
          <HomePresenceHero
            greetingText={sanctuaryState.greetingText}
            statusHeadline={sanctuaryState.presenceStatusHeadline}
            actionPrompt={sanctuaryState.presenceActionPrompt}
            user={sanctuaryState.user}
            partner={null}
          />

          {/* Intentional "Connect with your partner" Onboarding Card */}
          <section className="relative w-full rounded-3xl bg-surface border border-border/80 p-6 sm:p-8 shadow-elevation-md space-y-6 overflow-hidden">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                  <span className="text-xs uppercase tracking-widest font-mono text-soft-stone font-semibold">
                    {sanctuaryState.connectionStatus === "incomplete_couple" ? "Sanctuary Awaiting Partner" : "New Sanctuary Space"}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-serif text-warm-cream">
                  {sanctuaryState.connectionStatus === "incomplete_couple"
                    ? "Your space is created · 1 of 2 joined"
                    : "Create your private space for two"}
                </h3>
                <p className="text-sm text-text-secondary max-w-xl leading-relaxed">
                  TogetherPlay is designed exclusively for you and your partner. Share your private invitation code to unlock real-time camera duels, encrypted whispers, and shared moments.
                </p>
              </div>
              <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-surface-raised border border-border items-center justify-center text-brand shrink-0">
                <Heart className="w-6 h-6" />
              </div>
            </div>

            {/* 3 Value Pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
              <div className="p-3.5 rounded-xl bg-surface-raised border border-border/60 space-y-1">
                <p className="text-xs font-semibold text-warm-cream flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-soft-stone" />
                  1. Real-time Duels
                </p>
                <p className="text-xs text-text-muted">
                  Tactile photo challenges & reflex games designed for distance.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-raised border border-border/60 space-y-1">
                <p className="text-xs font-semibold text-warm-cream flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-soft-stone" />
                  2. Whisper Channels
                </p>
                <p className="text-xs text-text-muted">
                  Private end-to-end encrypted audio and asynchronous notes.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-raised border border-border/60 space-y-1">
                <p className="text-xs font-semibold text-warm-cream flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-soft-stone" />
                  3. Shared Memories
                </p>
                <p className="text-xs text-text-muted">
                  Daily spark reflections and highlights archived together.
                </p>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <Link
                href="/onboarding/invite"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand text-text-on-mint font-semibold text-sm hover:bg-brand-hover active:bg-brand-active transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm focus-visible:outline-2 focus-visible:outline-brand"
              >
                <UserPlus className="w-4 h-4" />
                {sanctuaryState.connectionStatus === "incomplete_couple" ? "Share Invitation Link" : "Invite Your Partner"}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </section>

          {/* Today's Opportunity / Spark Preview */}
          <TodayOpportunityCard
            challenge={sanctuaryState.todayChallenge}
            partnerName="Your Partner"
            isNewCouple={true}
          />

          {/* Games Section */}
          <HomeGamesSection
            continueGame={null}
            suggestedGame={sanctuaryState.suggestedGame}
          />

          {/* Secondary Info */}
          <HomeSecondaryInfo
            daysTogether={sanctuaryState.daysTogether}
            distanceKm={sanctuaryState.distanceKm}
            encryptionSeal={sanctuaryState.encryptionSeal}
            isNewCouple={true}
          />
        </div>
      )}

      {/* State F (Scenario 2): Authenticated with Incomplete Partner Profile */}
      {!isLoading && !isAuthLoading && sanctuaryState && sanctuaryState.connectionStatus === "incomplete_partner_profile" && sanctuaryState.partner !== null && (
        <div className="space-y-6">
          <HomePresenceHero
            greetingText={sanctuaryState.greetingText}
            statusHeadline={sanctuaryState.presenceStatusHeadline}
            actionPrompt={sanctuaryState.presenceActionPrompt}
            user={sanctuaryState.user}
            partner={sanctuaryState.partner}
          />

          <section className="relative w-full rounded-3xl bg-surface border border-border/80 p-6 sm:p-8 shadow-elevation-md space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs uppercase tracking-widest font-mono text-soft-stone font-semibold">
                Partner Setup Pending
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-serif text-warm-cream">
              Partner Joined · Profile In Progress
            </h3>
            <p className="text-sm text-text-secondary max-w-xl leading-relaxed">
              Your partner has accepted your invite and joined your sanctuary. They are currently setting up their profile and preferences. Real-time duels and whispers will be ready as soon as their setup is finished.
            </p>
            <div className="pt-2">
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-raised border border-border text-xs font-semibold text-warm-cream hover:bg-surface transition-all focus-visible:outline-2 focus-visible:outline-brand"
              >
                <Settings className="w-3.5 h-3.5" />
                Sanctuary Settings
              </Link>
            </div>
          </section>

          <TodayOpportunityCard
            challenge={null}
            partnerName={sanctuaryState.partner.displayName}
            isNewCouple={true}
          />

          <HomeGamesSection
            continueGame={null}
            suggestedGame={null}
          />

          <HomeSecondaryInfo
            daysTogether={sanctuaryState.daysTogether}
            distanceKm={sanctuaryState.distanceKm}
            encryptionSeal={sanctuaryState.encryptionSeal}
            isNewCouple={true}
          />
        </div>
      )}

      {/* State C & State D: Valid Live Couple Data (Connected Couple) */}
      {!isLoading && !isAuthLoading && sanctuaryState && sanctuaryState.partner !== null && sanctuaryState.connectionStatus !== "incomplete_partner_profile" && (
        <>
          {/* 1. Primary Hierarchy: Partner Presence */}
          <HomePresenceHero
            greetingText={sanctuaryState.greetingText}
            statusHeadline={sanctuaryState.presenceStatusHeadline}
            actionPrompt={sanctuaryState.presenceActionPrompt}
            user={sanctuaryState.user}
            partner={sanctuaryState.partner}
          />

          {/* 2. Primary Hierarchy: Current Shared Activity */}
          <CurrentSharedActivityCard
            activity={sanctuaryState.currentActivity}
            daysTogether={sanctuaryState.daysTogether}
          />

          {/* 3. Primary Hierarchy: Today's Opportunity to Connect */}
          <TodayOpportunityCard
            challenge={sanctuaryState.todayChallenge}
            partnerName={sanctuaryState.partner.displayName}
            isNewCouple={false}
          />

          {/* 4. Primary Hierarchy: Games (Continue Game & Suggested Game) */}
          <HomeGamesSection
            continueGame={sanctuaryState.continueGame}
            suggestedGame={sanctuaryState.suggestedGame}
          />

          {/* 5. Primary Hierarchy: Memories (Recent Memory) */}
          <HomeMemoriesSection recentMemory={sanctuaryState.recentMemory} />

          {/* 6. Primary Hierarchy: Secondary Information */}
          <HomeSecondaryInfo
            daysTogether={sanctuaryState.daysTogether}
            distanceKm={sanctuaryState.distanceKm}
            encryptionSeal={sanctuaryState.encryptionSeal}
            isNewCouple={false}
          />
        </>
      )}

      {/* Unauthenticated State */}
      {!isLoading && !isAuthLoading && !error && !sanctuaryState && !user && (
        <div className="rounded-3xl bg-surface border border-border/80 p-8 sm:p-12 text-center max-w-lg mx-auto my-6 space-y-6 shadow-elevation-md">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-raised border border-border flex items-center justify-center text-brand">
            <Heart className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-serif text-warm-cream">Welcome to TogetherPlay</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              Your intimate sanctuary across distance. Sign in or create a space for two to begin.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand text-text-on-mint font-semibold text-sm hover:bg-brand-hover active:bg-brand-active transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm focus-visible:outline-2 focus-visible:outline-brand"
            >
              Sign In to Sanctuary
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </Container>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <Container size="md" className="space-y-8 pb-24 pt-8">
          <CardSkeleton />
          <div className="p-8 flex flex-col items-center justify-center">
            <LoadingSpinner size="md" label="Loading sanctuary..." />
          </div>
        </Container>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

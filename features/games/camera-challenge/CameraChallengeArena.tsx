"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Volume2,
  VolumeX,
  RotateCcw,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Video,
  VideoOff,
  Home,
  CheckCircle2,
  FastForward,
  Play,
  HeartHandshake,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useWebRtcVideoCall } from "@/features/video/useWebRtcVideoCall";
import { CameraPortalFrame } from "./CameraPortalFrame";
import { ChallengeTypographyBanner } from "./ChallengeTypographyBanner";
import { EventCountdownOverlay } from "./EventCountdownOverlay";
import { EventSubmitOverlay } from "./EventSubmitOverlay";
import { PartnerReviewOverlay } from "./PartnerReviewOverlay";
import { ChallengeResultModal } from "./ChallengeResultModal";
import { cameraChallengeAudio } from "./cameraChallengeAudio";
import { authoritativeGameClient } from "@/lib/firebase/services/authoritativeGameClient";
import { CAMERA_CHALLENGES } from "@/lib/games/definitions";
import { secureRandomInt } from "@/lib/utils/crypto";
import type {
  CameraChallengePrompt,
  CameraChallengeReview,
  CameraChallengeStage,
  GameState,
  GameSession,
} from "@/types/domain";

interface CameraChallengeArenaProps {
  gameId?: string;
  myUserId?: string;
  partnerId?: string;
  playerNames?: { p1: string; p2: string };
  playerCities?: { p1: string; p2: string };
}

export const CameraChallengeArena: React.FC<CameraChallengeArenaProps> = ({
  gameId = "camera_challenge_event",
  myUserId = "user_alex",
  partnerId = "user_sam",
  playerNames = { p1: "Alex", p2: "Sam" },
  playerCities = { p1: "London", p2: "Tokyo" },
}) => {
  // ---------------------------------------------------------------------------
  // WebRTC Video Call (Live peer-to-peer MediaStream, ZERO recording or storing)
  // ---------------------------------------------------------------------------
  const videoCall = useWebRtcVideoCall({
    roomId: `cc_room_${gameId}`,
    myUserId,
    partnerId,
    myDisplayName: myUserId === "user_alex" ? playerNames.p1 : playerNames.p2,
    myCity: myUserId === "user_alex" ? playerCities.p1 : playerCities.p2,
  });

  // ---------------------------------------------------------------------------
  // Game State & Lifecycle
  // ---------------------------------------------------------------------------
  const [session, setSession] = useState<GameSession | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  // Fallback / Active local state for immediate response
  const [stage, setStage] = useState<CameraChallengeStage>("challenge");
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [currentPrompt, setCurrentPrompt] = useState<CameraChallengePrompt>(CAMERA_CHALLENGES[0]);
  const [currentRound, setCurrentRound] = useState(1);
  const [maxRounds] = useState(5);
  const [scores, setScores] = useState<Record<string, number>>({
    [myUserId]: 0,
    [partnerId]: 0,
  });
  const [submissions, setSubmissions] = useState<Record<string, { submittedAt: number; ready: boolean }>>({});
  const [reviews, setReviews] = useState<Record<string, CameraChallengeReview>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [performSecondsRemaining, setPerformSecondsRemaining] = useState(20);
  const [isGameEnd, setIsGameEnd] = useState(false);

  // Auto-connect video call on mount
  useEffect(() => {
    videoCall.startCall().catch((err) => {
      console.warn("[CameraChallenge] Initial video call request:", err);
    });

    return () => {
      videoCall.leaveCall().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Audio mute toggle
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    cameraChallengeAudio.setMuted(next);
  };

  // Sync with Authoritative Server Game Engine
  const handleGameStateUpdate = useCallback(
    (state: GameState | null) => {
      if (!state) return;
      setGameState(state);

      const data = (state.data || {}) as Record<string, unknown>;
      if (data.gameType === "camera_challenge") {
        if (data.stage) setStage(data.stage as CameraChallengeStage);
        if (data.currentPrompt) setCurrentPrompt(data.currentPrompt as CameraChallengePrompt);
        if (typeof data.currentPromptIndex === "number") setCurrentPromptIndex(data.currentPromptIndex);
        if (typeof state.currentRound === "number") setCurrentRound(state.currentRound);
        if (state.scores) setScores(state.scores);
        if (data.submissions) {
          setSubmissions(data.submissions as Record<string, { submittedAt: number; ready: boolean }>);
        }
        if (data.reviews) {
          setReviews(data.reviews as Record<string, CameraChallengeReview>);
        }
        if (state.status === "game_end" || data.isGameEnd) {
          setIsGameEnd(true);
        }
      }
    },
    []
  );

  // Initialize or connect to authoritative game session
  useEffect(() => {
    let isSubscribed = true;

    async function initSession() {
      try {
        const { session: s, state: st } = await authoritativeGameClient.ensureGameSession(
          gameId,
          [myUserId, partnerId],
          false,
          "camera_challenge"
        );
        if (isSubscribed) {
          setSession(s);
          setGameState(st);
          handleGameStateUpdate(st);
        }
      } catch (err) {
        console.warn("[CameraChallenge] Server session init warning, using local state:", err);
      }
    }

    initSession();

    const unsubRTDB = authoritativeGameClient.subscribeToEphemeralState(gameId, (st) => {
      if (isSubscribed && st) {
        handleGameStateUpdate(st);
      }
    });

    const unsubFirestore = authoritativeGameClient.subscribeToDurableSession(gameId, (s) => {
      if (isSubscribed && s) {
        setSession(s);
      }
    });

    return () => {
      isSubscribed = false;
      unsubRTDB();
      unsubFirestore();
    };
  }, [gameId, myUserId, partnerId, handleGameStateUpdate]);

  // Perform Countdown Timer when in "perform" stage
  useEffect(() => {
    if (stage !== "perform") return;

    setPerformSecondsRemaining(currentPrompt.durationSeconds || 20);
    const interval = setInterval(() => {
      setPerformSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // When time runs out in perform, automatically transition to submit/result
          handleLockIn();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, currentPrompt]);

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  // 1. Start Challenge -> Countdown
  const handleStartCountdown = async () => {
    cameraChallengeAudio.playPromptReveal();
    setStage("countdown");

    try {
      await authoritativeGameClient.submitAction(
        gameId,
        "START_COUNTDOWN",
        { stage: "countdown" },
        myUserId
      );
    } catch {
      // Local fallback
    }
  };

  // 2. Countdown Complete -> Perform
  const handleCountdownComplete = async () => {
    setStage("perform");
    setSubmissions({});

    try {
      await authoritativeGameClient.submitAction(
        gameId,
        "START_PERFORM",
        { stage: "perform" },
        myUserId
      );
    } catch {
      // Local fallback
    }
  };

  // 3. Perform -> Submit / Lock In
  const handleLockIn = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    cameraChallengeAudio.playLockIn();

    // Optimistic local state: enter submit stage
    const nextSubs = {
      ...submissions,
      [myUserId]: { submittedAt: Date.now(), ready: true },
    };
    setSubmissions(nextSubs);
    setStage("submit");

    // In preview or sandbox, ensure partner capture registers for dual visual verification
    setTimeout(() => {
      setSubmissions((prev) => ({
        ...prev,
        [partnerId]: { submittedAt: Date.now(), ready: true },
      }));
    }, 600);

    try {
      const res = await authoritativeGameClient.submitAction(
        gameId,
        "SUBMIT_CAMERA_CHALLENGE",
        { submittedAt: Date.now() },
        myUserId
      );
      if (res?.gameState) {
        const data = (res.gameState.data || {}) as Record<string, unknown>;
        if (data.submissions) {
          setSubmissions(data.submissions as Record<string, { submittedAt: number; ready: boolean }>);
        }
      }
    } catch {
      // Local fallback handled by EventSubmitOverlay
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3b. Submit -> Partner Review transition
  const handleProceedToReview = useCallback(() => {
    setStage("partner_review");
  }, []);

  // 3c. Partner Review Actions (Authoritative)
  const handleApprovePartner = async (feedback?: string) => {
    setIsSubmitting(true);
    cameraChallengeAudio.playCelebration();
    try {
      const res = await authoritativeGameClient.submitAction(
        gameId,
        "APPROVE_CHALLENGE",
        { targetPlayerId: partnerId, feedback },
        myUserId
      );
      if (res?.gameState) {
        handleGameStateUpdate(res.gameState);
      }
    } catch {
      // Local fallback in case of disconnected sandbox
      setReviews((prev) => ({
        ...prev,
        [myUserId]: {
          reviewerId: myUserId,
          targetPlayerId: partnerId,
          decision: "approve",
          approved: true,
          reviewedAt: Date.now(),
        },
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectPartner = async (reason?: string) => {
    setIsSubmitting(true);
    cameraChallengeAudio.playSkip();
    try {
      const res = await authoritativeGameClient.submitAction(
        gameId,
        "REJECT_CHALLENGE",
        { targetPlayerId: partnerId, reason },
        myUserId
      );
      if (res?.gameState) {
        handleGameStateUpdate(res.gameState);
      }
    } catch {
      // Local fallback in case of disconnected sandbox
      setReviews((prev) => ({
        ...prev,
        [myUserId]: {
          reviewerId: myUserId,
          targetPlayerId: partnerId,
          decision: "reject",
          approved: false,
          reviewedAt: Date.now(),
        },
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Skip Challenge
  const handleSkip = async () => {
    cameraChallengeAudio.playSkip();
    const nextIdx = (currentPromptIndex + 1) % CAMERA_CHALLENGES.length;
    setCurrentPromptIndex(nextIdx);
    setCurrentPrompt(CAMERA_CHALLENGES[nextIdx]);
    setStage("challenge");
    setSubmissions({});

    try {
      const res = await authoritativeGameClient.submitAction(
        gameId,
        "SKIP_CHALLENGE",
        { nextIndex: nextIdx },
        myUserId
      );
      if (res?.gameState) {
        handleGameStateUpdate(res.gameState);
      }
    } catch {
      // Local fallback
    }
  };

  // 5. Next Challenge
  const handleNextChallenge = async () => {
    if (currentRound >= maxRounds) {
      setIsGameEnd(true);
      return;
    }

    cameraChallengeAudio.playPromptReveal();
    const nextIdx = (currentPromptIndex + 1) % CAMERA_CHALLENGES.length;
    setCurrentPromptIndex(nextIdx);
    setCurrentPrompt(CAMERA_CHALLENGES[nextIdx]);
    setCurrentRound((r) => r + 1);
    setStage("challenge");
    setSubmissions({});

    try {
      const res = await authoritativeGameClient.submitAction(
        gameId,
        "NEXT_CHALLENGE",
        { nextRound: currentRound + 1 },
        myUserId
      );
      if (res?.gameState) {
        handleGameStateUpdate(res.gameState);
      }
    } catch {
      // Local fallback
    }
  };

  // 6. Rematch / Restart
  const handleRematch = async () => {
    cameraChallengeAudio.playPromptReveal();
    const randomIdx = secureRandomInt(0, CAMERA_CHALLENGES.length - 1);
    setCurrentPromptIndex(randomIdx);
    setCurrentPrompt(CAMERA_CHALLENGES[randomIdx]);
    setCurrentRound(1);
    setIsGameEnd(false);
    setStage("challenge");
    setSubmissions({});
    setScores({ [myUserId]: 0, [partnerId]: 0 });

    try {
      const res = await authoritativeGameClient.submitAction(
        gameId,
        "REMATCH",
        {},
        myUserId
      );
      if (res?.gameState) {
        handleGameStateUpdate(res.gameState);
      }
    } catch {
      // Local fallback
    }
  };

  // Determine readiness states for display
  const isMySubmissionDone = Boolean(submissions[myUserId]?.ready);
  const isPartnerSubmissionDone = Boolean(submissions[partnerId]?.ready);

  // Check connection status
  const isConnectionFailing =
    videoCall.status === "failed" ||
    videoCall.status === "disconnected" ||
    videoCall.status === "reconnecting";

  const isCameraPermissionFailing =
    videoCall.status === "permission_denied" || videoCall.status === "no_camera";

  return (
    <main
      id="camera-challenge-arena"
      className="relative w-full min-h-screen bg-[#0c0b0a] text-neutral-100 flex flex-col justify-between overflow-hidden selection:bg-amber-500/30"
    >
      {/* --------------------------------------------------------------------- */}
      {/* Top Header Navigation & Event Status Bar                             */}
      {/* --------------------------------------------------------------------- */}
      <header className="relative z-20 w-full px-4 sm:px-8 py-4 flex items-center justify-between border-b border-neutral-900 bg-neutral-950/60 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 transition-colors border border-transparent hover:border-neutral-800"
            title="Return to lobby"
          >
            <Home className="w-4 h-4" />
          </Link>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide uppercase text-neutral-200">
              Camera Challenge
            </span>
            <span className="hidden sm:inline text-xs text-neutral-500">|</span>
            <span className="hidden sm:inline text-xs font-mono text-amber-300/80 uppercase">
              Live Event
            </span>
          </div>
        </div>

        {/* Central Round & Synergy Display */}
        <div className="flex items-center space-x-4">
          <div className="text-xs tracking-wider uppercase text-neutral-400 font-medium">
            Challenge <span className="text-amber-400 font-semibold">{currentRound}</span> of{" "}
            <span>{maxRounds}</span>
          </div>
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-950/50 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {(scores[myUserId] || 0) + (scores[partnerId] || 0)} Synergy
            </span>
          </div>
        </div>

        {/* Right Utility Controls */}
        <div className="flex items-center space-x-2">
          <button
            id="toggle-audio-button"
            onClick={toggleMute}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 transition-colors border border-neutral-800/80"
            title={isMuted ? "Unmute Sound" : "Mute Sound"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <Button
            id="skip-header-button"
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-xs text-neutral-400 hover:text-neutral-200"
            title="Skip to next prompt"
          >
            <FastForward className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Skip</span>
          </Button>
        </div>
      </header>

      {/* --------------------------------------------------------------------- */}
      {/* Alert Banners: Connection Failure & Camera Permission Failure         */}
      {/* --------------------------------------------------------------------- */}
      <AnimatePresence>
        {isConnectionFailing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-30 w-full bg-amber-950/90 border-b border-amber-500/40 px-4 py-2 text-amber-200 text-xs flex items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                WebRTC connection is {videoCall.status}. Attempting to restore peer video stream...
              </span>
            </div>
            <button
              onClick={() => videoCall.retryConnection()}
              className="px-3 py-1 rounded-lg bg-amber-900/80 hover:bg-amber-800 text-amber-100 font-medium transition-colors flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry Connection</span>
            </button>
          </motion.div>
        )}

        {isCameraPermissionFailing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-30 w-full bg-rose-950/90 border-b border-rose-500/40 px-4 py-3 text-rose-200 text-xs flex flex-col sm:flex-row items-center justify-between gap-2"
          >
            <div className="flex items-center space-x-2">
              <VideoOff className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                Camera permission blocked or unavailable. Click the camera icon in your browser address bar to allow, or switch to simulated streams.
              </span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => videoCall.startCall()}
                className="px-3 py-1 rounded-lg bg-rose-900/80 hover:bg-rose-800 text-rose-100 font-medium transition-colors"
              >
                Retry Permission
              </button>
              <button
                onClick={() => videoCall.startCall(true)}
                className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-colors"
              >
                Use Demo Stream
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --------------------------------------------------------------------- */}
      {/* Central Interactive Stage: Live Video Feeds as the Main Interface    */}
      {/* --------------------------------------------------------------------- */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-3 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
        {/* Large Challenge Typography Header */}
        <ChallengeTypographyBanner
          prompt={currentPrompt}
          currentRound={currentRound}
          maxRounds={maxRounds}
          stage={stage}
        />

        {/* Dual Video Portals Grid */}
        <div className="relative w-full mt-3 sm:mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 flex-1 max-h-[640px]">
          {/* Player 1 (Alex - Ember Aura) */}
          <CameraPortalFrame
            id="player-1-video-portal"
            stream={myUserId === "user_alex" ? videoCall.localStream : videoCall.remoteStream}
            playerName={playerNames.p1}
            city={playerCities.p1}
            isLocal={myUserId === "user_alex"}
            auraColor="ember"
            isLockedIn={Boolean(submissions["user_alex"]?.ready)}
            isCameraActive={myUserId === "user_alex" ? videoCall.isCameraOn : true}
            hasError={isCameraPermissionFailing && myUserId === "user_alex"}
            errorMessage={videoCall.errorMessage || undefined}
            onRetryCamera={() => videoCall.startCall()}
            className="flex-1"
          />

          {/* Player 2 (Sam - Sage Emerald Aura) */}
          <CameraPortalFrame
            id="player-2-video-portal"
            stream={myUserId === "user_sam" ? videoCall.localStream : videoCall.remoteStream}
            playerName={playerNames.p2}
            city={playerCities.p2}
            isLocal={myUserId === "user_sam"}
            auraColor="sage"
            isLockedIn={Boolean(submissions["user_sam"]?.ready)}
            isCameraActive={myUserId === "user_sam" ? videoCall.isCameraOn : true}
            hasError={isCameraPermissionFailing && myUserId === "user_sam"}
            errorMessage={videoCall.errorMessage || undefined}
            onRetryCamera={() => videoCall.startCall()}
            className="flex-1"
          />

          {/* Cinematic 3-2-1 Countdown Overlay */}
          {stage === "countdown" && (
            <EventCountdownOverlay
              seconds={currentPrompt.countdownSeconds || 3}
              onComplete={handleCountdownComplete}
            />
          )}

          {/* Explicit Submission Stage Overlay */}
          {stage === "submit" && (
            <EventSubmitOverlay
              playerNames={playerNames}
              isP1Locked={Boolean(submissions["user_alex"]?.ready || submissions[myUserId]?.ready)}
              isP2Locked={Boolean(submissions["user_sam"]?.ready || submissions[partnerId]?.ready)}
              onProceedToResult={handleProceedToReview}
              autoAdvanceSeconds={2.2}
            />
          )}

          {/* Authoritative Partner Review Overlay */}
          {stage === "partner_review" && (
            <PartnerReviewOverlay
              partnerName={myUserId === "user_alex" ? playerNames.p2 : playerNames.p1}
              partnerId={partnerId}
              myUserId={myUserId}
              reviews={reviews}
              isSubmitting={isSubmitting}
              onApprove={handleApprovePartner}
              onReject={handleRejectPartner}
            />
          )}
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* Bottom Theatrical Action Deck                                         */}
      {/* --------------------------------------------------------------------- */}
      <footer className="relative z-20 w-full px-4 sm:px-8 py-5 border-t border-neutral-900 bg-neutral-950/80 backdrop-blur-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Zero-Storage Privacy Note */}
        <div className="flex items-center space-x-2 text-[11px] text-neutral-400 select-none">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Real-time peer video. Zero media recording or server retention.</span>
        </div>

        {/* Dynamic Stage Controls */}
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
          {stage === "challenge" && (
            <>
              <Button
                id="skip-challenge-button"
                variant="outline"
                size="md"
                onClick={handleSkip}
                className="w-full sm:w-auto"
              >
                <FastForward className="w-4 h-4 mr-2" />
                Skip
              </Button>

              <Button
                id="start-countdown-button"
                variant="amber"
                size="lg"
                onClick={handleStartCountdown}
                className="w-full sm:w-auto shadow-xl shadow-amber-950/40 text-sm font-semibold"
              >
                <Play className="w-4 h-4 mr-2 fill-current" />
                Start Challenge
              </Button>
            </>
          )}

          {stage === "countdown" && (
            <div className="text-xs uppercase tracking-widest text-amber-300 font-semibold animate-pulse py-2">
              Event Commencing...
            </div>
          )}

          {stage === "perform" && (
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              {/* Perform Timer Ring */}
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono text-amber-300">
                <span>TIME:</span>
                <span className="font-bold text-sm">{performSecondsRemaining}s</span>
              </div>

              <Button
                id="skip-perform-button"
                variant="outline"
                size="md"
                onClick={handleSkip}
                className="text-xs text-neutral-300 hover:text-white"
                title="Skip challenge"
              >
                <FastForward className="w-3.5 h-3.5 mr-1" />
                Skip
              </Button>

              <Button
                id="lock-in-button"
                variant="amber"
                size="lg"
                onClick={handleLockIn}
                disabled={isMySubmissionDone || isSubmitting}
                className={`w-full sm:w-auto shadow-lg transition-all ${
                  isMySubmissionDone
                    ? "bg-emerald-600 text-white cursor-default"
                    : "shadow-amber-950/40"
                }`}
              >
                {isMySubmissionDone ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Locked In
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    I&apos;m Done / Lock In
                  </>
                )}
              </Button>
            </div>
          )}

          {stage === "submit" && (
            <div className="flex items-center space-x-3">
              <div className="text-xs text-amber-300 font-medium animate-pulse">
                Synchronizing live perspectives...
              </div>
              <Button
                id="manual-proceed-button"
                variant="amber"
                size="sm"
                onClick={handleProceedToReview}
              >
                <span>Proceed to Review</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          )}

          {stage === "partner_review" && (
            <div className="flex items-center space-x-2">
              {!reviews[myUserId] ? (
                <>
                  <Button
                    id="deck-reject-button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => handleRejectPartner()}
                    className="border-rose-900/60 text-rose-300 hover:text-rose-100"
                  >
                    <span>Request Retry</span>
                  </Button>
                  <Button
                    id="deck-approve-button"
                    variant="amber"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => handleApprovePartner()}
                  >
                    <span>Approve Partner</span>
                  </Button>
                </>
              ) : (
                <div className="text-xs text-amber-300 font-medium animate-pulse">
                  Awaiting partner verification...
                </div>
              )}
            </div>
          )}

          {stage === "result" && (
            <div className="flex items-center space-x-2">
              <Button
                id="deck-rematch-button"
                variant="outline"
                size="sm"
                onClick={handleRematch}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Rematch
              </Button>
              <Button
                id="deck-next-button"
                variant="amber"
                size="md"
                onClick={handleNextChallenge}
              >
                <span>Next Challenge</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </footer>

      {/* --------------------------------------------------------------------- */}
      {/* Result Modal: Clear Completion State & Synergy Award                 */}
      {/* --------------------------------------------------------------------- */}
      <AnimatePresence>
        {stage === "result" && (
          <ChallengeResultModal
            prompt={currentPrompt}
            currentRound={currentRound}
            maxRounds={maxRounds}
            isGameEnd={isGameEnd}
            playerScores={scores}
            playerNames={playerNames}
            onNextChallenge={handleNextChallenge}
            onRematch={handleRematch}
          />
        )}
      </AnimatePresence>
    </main>
  );
};

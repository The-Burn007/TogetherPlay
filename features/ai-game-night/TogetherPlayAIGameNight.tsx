"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  fetchGameNightLineup,
} from "@/lib/ai/gameNightClient";
import type {
  GameNightLineup,
  GameNightActivity,
  GameNightActivityResult,
  GameNightOverallResult,
  GameNightVibe,
} from "@/lib/ai/gameNightTypes";
import { getCuratedGameNight } from "@/lib/ai/curatedGameNights";
import { gameNightAudio } from "@/lib/ai/gameNightAudio";

import { AIGameNightHUD } from "./AIGameNightHUD";
import { AIGameNightLineupDrawer } from "./AIGameNightLineupDrawer";
import { AnticipationCurtain } from "./AnticipationCurtain";
import { ActivityIntermission } from "./ActivityIntermission";
import { GameNightFinalResult } from "./GameNightFinalResult";

import { FindItFirstMiniRunner } from "./runners/FindItFirstMiniRunner";
import { QuickQuestionRunner } from "./runners/QuickQuestionRunner";
import { CameraChallengeMiniRunner } from "./runners/CameraChallengeMiniRunner";
import { SpeedDuelMiniRunner } from "./runners/SpeedDuelMiniRunner";
import { FinalChallengeRunner } from "./runners/FinalChallengeRunner";

interface TogetherPlayAIGameNightProps {
  initialVibe?: GameNightVibe;
  partnerNames?: { p1: string; p2: string };
  partnerCities?: { p1: string; p2: string };
}

type GameNightStage =
  | "loading"
  | "anticipation"
  | "activity"
  | "intermission"
  | "completed";

export const TogetherPlayAIGameNight: React.FC<TogetherPlayAIGameNightProps> = ({
  initialVibe = "balanced",
  partnerNames = { p1: "Alex", p2: "Sam" },
  partnerCities = { p1: "London", p2: "Tokyo" },
}) => {
  const router = useRouter();

  const [lineup, setLineup] = useState<GameNightLineup>(() =>
    getCuratedGameNight(initialVibe, partnerNames, partnerCities)
  );
  const [currentVibe, setCurrentVibe] = useState<GameNightVibe>(initialVibe);
  const [stage, setStage] = useState<GameNightStage>("loading");
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [isGeneratingNew, setIsGeneratingNew] = useState(false);
  const [isLineupDrawerOpen, setIsLineupDrawerOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Authoritative Deterministic Score State
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [roundWins, setRoundWins] = useState({ p1: 0, p2: 0, ties: 0 });
  const [activityResults, setActivityResults] = useState<GameNightActivityResult[]>([]);
  const [lastCompletedResult, setLastCompletedResult] = useState<GameNightActivityResult | null>(null);

  // Initial Lineup Loading
  useEffect(() => {
    let isMounted = true;
    async function loadLineup() {
      try {
        const res = await fetchGameNightLineup({
          vibe: currentVibe,
          partnerNames,
          partnerCities,
        });
        if (isMounted) {
          setLineup(res.lineup);
          setStage("anticipation");
          gameNightAudio.playCurtainChime();
        }
      } catch {
        if (isMounted) {
          setStage("anticipation");
        }
      }
    }
    loadLineup();
    return () => {
      isMounted = false;
    };
  }, [currentVibe, partnerNames, partnerCities]);

  // Regenerate Lineup on Vibe Change
  const handleChangeVibe = async (vibe: GameNightVibe) => {
    setCurrentVibe(vibe);
    setIsGeneratingNew(true);
    try {
      const res = await fetchGameNightLineup({
        vibe,
        partnerNames,
        partnerCities,
      });
      setLineup(res.lineup);
      gameNightAudio.playTap();
    } catch {
      setLineup(getCuratedGameNight(vibe, partnerNames, partnerCities));
    } finally {
      setIsGeneratingNew(false);
    }
  };

  // Begin Evening from Anticipation
  const handleCommence = () => {
    gameNightAudio.playCurtainChime();
    setCurrentRoundIndex(0);
    setScores({ p1: 0, p2: 0 });
    setRoundWins({ p1: 0, p2: 0, ties: 0 });
    setActivityResults([]);
    setStage("activity");
  };

  // Callback when an activity concludes deterministically
  const handleRoundComplete = (result: GameNightActivityResult) => {
    // 1. Update scores deterministically
    const nextP1Score = scores.p1 + result.scores.p1;
    const nextP2Score = scores.p2 + result.scores.p2;
    setScores({ p1: nextP1Score, p2: nextP2Score });

    // 2. Track round wins
    if (result.winnerId === "user_alex") {
      setRoundWins((prev) => ({ ...prev, p1: prev.p1 + 1 }));
    } else if (result.winnerId === "user_sam") {
      setRoundWins((prev) => ({ ...prev, p2: prev.p2 + 1 }));
    } else {
      setRoundWins((prev) => ({ ...prev, ties: prev.ties + 1 }));
    }

    // 3. Attach result to activity
    const updatedActivities = [...lineup.activities];
    if (updatedActivities[currentRoundIndex]) {
      updatedActivities[currentRoundIndex] = {
        ...updatedActivities[currentRoundIndex],
        status: "completed",
        result,
      };
      setLineup({ ...lineup, activities: updatedActivities });
    }

    setActivityResults((prev) => [...prev, result]);
    setLastCompletedResult(result);
    setStage("intermission");
  };

  // Advance from Intermission to Next Activity or Final Result
  const handleContinueAfterIntermission = () => {
    if (currentRoundIndex + 1 < lineup.totalRounds) {
      setCurrentRoundIndex((prev) => prev + 1);
      setStage("activity");
      gameNightAudio.playRoundTransition();
    } else {
      setStage("completed");
      gameNightAudio.playFinaleFanfare();
    }
  };

  // Rematch: Fetch fresh new AI lineup and restart
  const handleRematch = async () => {
    setStage("loading");
    setScores({ p1: 0, p2: 0 });
    setRoundWins({ p1: 0, p2: 0, ties: 0 });
    setActivityResults([]);
    try {
      const res = await fetchGameNightLineup({
        vibe: currentVibe,
        partnerNames,
        partnerCities,
      });
      setLineup(res.lineup);
      setStage("anticipation");
      gameNightAudio.playCurtainChime();
    } catch {
      setLineup(getCuratedGameNight(currentVibe, partnerNames, partnerCities));
      setStage("anticipation");
    }
  };

  // Play Again: Replay same lineup from start
  const handlePlayAgain = () => {
    setScores({ p1: 0, p2: 0 });
    setRoundWins({ p1: 0, p2: 0, ties: 0 });
    setActivityResults([]);
    setCurrentRoundIndex(0);
    setStage("anticipation");
    gameNightAudio.playCurtainChime();
  };

  const handleToggleMute = () => {
    const muted = gameNightAudio.toggleMute();
    setIsMuted(muted);
  };

  // Compute overall result deterministically
  const calculateOverallResult = (): GameNightOverallResult => {
    const isTie = scores.p1 === scores.p2;
    const overallWinnerId = isTie
      ? null
      : scores.p1 > scores.p2
      ? "user_alex"
      : "user_sam";
    const overallWinnerName = isTie
      ? null
      : scores.p1 > scores.p2
      ? lineup.partnerNames.p1
      : lineup.partnerNames.p2;

    const funMoments = activityResults
      .map((r) => r.funMoment)
      .filter(Boolean)
      .slice(0, 3);

    // Synchrony metric: base 80% + 5% per matching question/camera/finale
    const synchrony = Math.min(
      98,
      Math.max(78, 80 + (roundWins.ties > 0 ? roundWins.ties * 6 : 4))
    );

    return {
      lineupId: lineup.id,
      theme: lineup.theme,
      totalScore: scores,
      roundWins,
      overallWinnerId,
      overallWinnerName,
      isTie,
      meridianSynchronyPercentage: synchrony,
      funMoments:
        funMoments.length > 0
          ? funMoments
          : [
              "Sensory radar locked in under 5 seconds.",
              "Double-blind synchrony reveal across London & Tokyo.",
              "Shared virtual toast sealed across 9,560 km.",
            ],
      completedAt: new Date().toISOString(),
    };
  };

  const currentActivity: GameNightActivity =
    lineup.activities[currentRoundIndex] || lineup.activities[0];
  const nextActivity: GameNightActivity | undefined =
    lineup.activities[currentRoundIndex + 1];

  return (
    <div className="min-h-screen bg-[#0c0b0a] text-neutral-100 flex flex-col justify-between selection:bg-amber-500/20">
      {/* Top HUD (Visible during activity, intermission & completion) */}
      {stage !== "loading" && stage !== "anticipation" && (
        <AIGameNightHUD
          lineup={lineup}
          currentActivity={currentActivity}
          nextActivity={nextActivity}
          currentRoundIndex={currentRoundIndex}
          totalRounds={lineup.totalRounds}
          scores={scores}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onOpenLineupDrawer={() => setIsLineupDrawerOpen(true)}
          onExit={() => router.push("/")}
        />
      )}

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-center px-4 py-6">
        {stage === "loading" && (
          <div className="flex flex-col items-center justify-center space-y-4 py-24 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
            <div className="space-y-1">
              <h3 className="font-serif text-lg text-neutral-200">
                Curating Tonight&apos;s Lineup...
              </h3>
              <p className="text-xs text-neutral-400 font-mono">
                TogetherPlay is assembling rituals for {partnerNames.p1} &amp; {partnerNames.p2}
              </p>
            </div>
          </div>
        )}

        {stage === "anticipation" && (
          <AnticipationCurtain
            lineup={lineup}
            onCommence={handleCommence}
            onChangeVibe={handleChangeVibe}
            currentVibe={currentVibe}
            isGeneratingNew={isGeneratingNew}
          />
        )}

        {stage === "activity" && (
          <div className="w-full max-w-4xl mx-auto space-y-6">
            {/* Host round intro card */}
            <div className="text-center space-y-1 pb-2">
              <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400">
                Round {currentRoundIndex + 1} of {lineup.totalRounds}
              </span>
              <h2 className="text-xl sm:text-2xl font-serif text-neutral-100">
                {currentActivity.title}
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-lg mx-auto italic">
                &ldquo;{currentActivity.hostIntro}&rdquo;
              </p>
            </div>

            {/* Render deterministic activity runner */}
            {currentActivity.type === "find_it_first" && (
              <FindItFirstMiniRunner
                activity={currentActivity}
                partnerNames={lineup.partnerNames}
                partnerCities={lineup.partnerCities}
                onRoundComplete={handleRoundComplete}
              />
            )}

            {currentActivity.type === "quick_question" && (
              <QuickQuestionRunner
                activity={currentActivity}
                partnerNames={lineup.partnerNames}
                partnerCities={lineup.partnerCities}
                onRoundComplete={handleRoundComplete}
              />
            )}

            {currentActivity.type === "camera_challenge" && (
              <CameraChallengeMiniRunner
                activity={currentActivity}
                partnerNames={lineup.partnerNames}
                partnerCities={lineup.partnerCities}
                onRoundComplete={handleRoundComplete}
              />
            )}

            {currentActivity.type === "speed_duel" && (
              <SpeedDuelMiniRunner
                activity={currentActivity}
                partnerNames={lineup.partnerNames}
                partnerCities={lineup.partnerCities}
                onRoundComplete={handleRoundComplete}
              />
            )}

            {currentActivity.type === "final_challenge" && (
              <FinalChallengeRunner
                activity={currentActivity}
                partnerNames={lineup.partnerNames}
                partnerCities={lineup.partnerCities}
                onRoundComplete={handleRoundComplete}
              />
            )}
          </div>
        )}

        {stage === "intermission" && lastCompletedResult && (
          <ActivityIntermission
            completedActivity={currentActivity}
            nextActivity={nextActivity}
            result={lastCompletedResult}
            lineup={lineup}
            roundIndex={currentRoundIndex}
            totalRounds={lineup.totalRounds}
            scores={scores}
            onContinue={handleContinueAfterIntermission}
          />
        )}

        {stage === "completed" && (
          <GameNightFinalResult
            lineup={lineup}
            overallResult={calculateOverallResult()}
            onRematch={handleRematch}
            onPlayAgain={handlePlayAgain}
            onExit={() => router.push("/")}
          />
        )}
      </main>

      {/* Slide-over Itinerary Drawer */}
      <AIGameNightLineupDrawer
        isOpen={isLineupDrawerOpen}
        onClose={() => setIsLineupDrawerOpen(false)}
        lineup={lineup}
        currentRoundIndex={currentRoundIndex}
      />
    </div>
  );
};

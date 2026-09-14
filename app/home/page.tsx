"use client";

import React, { useState, useEffect } from "react";
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

export default function HomePage() {
  const { user } = useAuth();
  const [activePreset, setActivePreset] = useState<HomePresetKey>("partner_online");
  const [sanctuaryState, setSanctuaryState] = useState<HomeSanctuaryState>(() =>
    getPresetHomeData("partner_online", user?.displayName || "Alex")
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (activePreset === "live") {
        setIsLoading(true);
        try {
          if (user?.uid) {
            const liveData = await homeService.fetchLiveHomeData(user.uid);
            if (isMounted) setSanctuaryState(liveData);
          } else {
            // Default baseline if unauthenticated live view
            if (isMounted) {
              setSanctuaryState(getPresetHomeData("partner_online", "Alex"));
            }
          }
        } catch (error) {
          console.warn("Error fetching live sanctuary state:", error);
          if (isMounted) {
            setSanctuaryState(getPresetHomeData("partner_online", user?.displayName || "Alex"));
          }
        } finally {
          if (isMounted) setIsLoading(false);
        }
      } else {
        setSanctuaryState(getPresetHomeData(activePreset, user?.displayName || "Alex"));
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [activePreset, user]);

  return (
    <Container size="sm" className="space-y-6 pb-12">
      {/* 0. Meaningful State Selector (Discreet quiet pill for testing & live modes) */}
      <HomeStateSelector
        currentPreset={activePreset}
        onSelectPreset={setActivePreset}
        coupleId={sanctuaryState.coupleId}
      />

      {isLoading ? (
        <div className="space-y-4 py-6">
          <CardSkeleton />
          <div className="p-8 flex flex-col items-center justify-center">
            <LoadingSpinner size="md" label="Synchronizing relationship sanctuary across hemispheres..." />
          </div>
          <CardSkeleton />
        </div>
      ) : (
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
            partnerName={sanctuaryState.partner?.displayName || "Partner"}
            isNewCouple={sanctuaryState.partner === null}
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
            isNewCouple={sanctuaryState.partner === null}
          />
        </>
      )}
    </Container>
  );
}


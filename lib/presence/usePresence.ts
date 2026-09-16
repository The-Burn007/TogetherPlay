"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { presenceService } from "@/lib/firebase/services/presence";
import {
  type PresenceState,
  type ConnectionStatus,
  type UserPresenceRecord,
} from "@/lib/presence/types";

export interface UsePresenceReturn {
  partnerPresence: UserPresenceRecord | null;
  partnerState: PresenceState;
  partnerConnection: ConnectionStatus;
  partnerDisplayName: string;
  partnerCity: string;
  partnerActivity: string;
  isPartnerOnline: boolean;
  isPartnerInGame: boolean;
  isPartnerInCall: boolean;
  isPartnerAway: boolean;
  myPresence: UserPresenceRecord | null;
  myState: PresenceState;
  setMyState: (state: PresenceState, activity?: string, gameId?: string) => Promise<void>;
  setSimulatedPartnerState: (state: PresenceState) => Promise<void>;
  sendHeartbeatNudge: () => Promise<boolean>;
}

export function usePresence(): UsePresenceReturn {
  const { user } = useAuth();

  // Determine current user and partner UIDs
  const myUserId = user?.uid || "user_alex";
  const myDisplayName = user?.displayName || (myUserId === "user_sam" ? "Sam" : "Alex");
  const myCity = myUserId === "user_sam" ? "Tokyo" : "London";
  const partnerUserId = myUserId === "user_sam" ? "user_alex" : "user_sam";
  const partnerDefaultName = myUserId === "user_sam" ? "Alex" : "Sam";
  const partnerDefaultCity = myUserId === "user_sam" ? "London" : "Tokyo";

  const [partnerPresence, setPartnerPresence] = useState<UserPresenceRecord | null>(null);
  const [myPresence, setMyPresence] = useState<UserPresenceRecord | null>(null);

  // Initialize lifecycle for self
  useEffect(() => {
    const cleanup = presenceService.initializePresenceLifecycle(myUserId, {
      displayName: myDisplayName,
      city: myCity,
      colorRole: myUserId === "user_sam" ? "sage" : "ember",
    });

    return () => {
      cleanup();
    };
  }, [myUserId, myDisplayName, myCity]);

  // Subscribe to partner presence
  useEffect(() => {
    const unsub = presenceService.subscribeToUserPresence(partnerUserId, (record) => {
      setPartnerPresence(record);
    });

    return () => {
      unsub();
    };
  }, [partnerUserId]);

  // Subscribe to self presence
  useEffect(() => {
    const unsub = presenceService.subscribeToUserPresence(myUserId, (record) => {
      setMyPresence(record);
    });

    return () => {
      unsub();
    };
  }, [myUserId]);

  const setMyState = useCallback(
    async (state: PresenceState, activity?: string, gameId?: string) => {
      await presenceService.setPresenceState(myUserId, state, activity, gameId);
    },
    [myUserId]
  );

  const setSimulatedPartnerState = useCallback(
    async (state: PresenceState) => {
      await presenceService.setPresenceState(partnerUserId, state, `Simulated as ${state}`);
    },
    [partnerUserId]
  );

  const sendHeartbeatNudge = useCallback(async () => {
    return presenceService.sendPartnerNudge(partnerUserId, "Resonance heartbeat sent");
  }, [partnerUserId]);

  const partnerState: PresenceState = partnerPresence?.state || "ONLINE";
  const partnerConnection: ConnectionStatus = partnerPresence?.connectionStatus || "online";
  const isPartnerOnline = partnerState !== "OFFLINE" && partnerConnection !== "offline";
  const myState: PresenceState = myPresence?.state || "ONLINE";

  return useMemo(
    () => ({
      partnerPresence,
      partnerState,
      partnerConnection,
      partnerDisplayName: partnerPresence?.displayName || partnerDefaultName,
      partnerCity: partnerPresence?.city || partnerDefaultCity,
      partnerActivity: partnerPresence?.currentActivity || "Relaxing in Sanctuary",
      isPartnerOnline,
      isPartnerInGame: partnerState === "IN_GAME",
      isPartnerInCall: partnerState === "IN_CALL",
      isPartnerAway: partnerState === "AWAY",
      myPresence,
      myState,
      setMyState,
      setSimulatedPartnerState,
      sendHeartbeatNudge,
    }),
    [
      partnerPresence,
      partnerState,
      partnerConnection,
      partnerDefaultName,
      partnerDefaultCity,
      isPartnerOnline,
      myPresence,
      myState,
      setMyState,
      setSimulatedPartnerState,
      sendHeartbeatNudge,
    ]
  );
}

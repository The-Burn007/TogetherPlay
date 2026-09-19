"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameSession, GameState, GameActionResult } from "@/types/domain";
import {
  MultiplayerRecoveryCoordinator,
  type GamePhase,
  type RecoveryConnectionStatus,
  type PartnerStatus,
  type InFlightActionRecord,
  computeAuthoritativePhase,
} from "./multiplayerRecovery";

export interface UseMultiplayerSessionOptions {
  gameId: string;
  playerId: string;
  onGameEnded?: (state: GameState) => void;
  onActionCommittedDuringDisconnect?: (action: InFlightActionRecord) => void;
  onPartnerStatusChange?: (status: PartnerStatus) => void;
}

export interface UseMultiplayerSessionResult {
  session: GameSession | null;
  gameState: GameState | null;
  gamePhase: GamePhase;
  connectionStatus: RecoveryConnectionStatus;
  partnerStatus: PartnerStatus;
  isRehydrating: boolean;
  isSubmitting: boolean;
  submitAction: (type: string, payload?: unknown, customUid?: string) => Promise<GameActionResult>;
  rehydrate: (reason?: string) => Promise<void>;
  coordinator: MultiplayerRecoveryCoordinator | null;
}

/**
 * React hook that binds to MultiplayerRecoveryCoordinator.
 * Guarantees:
 * 1. Stale React state is never trusted.
 * 2. On mount, refresh, or reconnect, authoritative state is fetched and listeners re-established.
 * 3. In-flight actions are reconciled if committed while offline.
 * 4. Stale tabs are re-synced.
 */
export function useMultiplayerSession({
  gameId,
  playerId,
  onGameEnded,
  onActionCommittedDuringDisconnect,
  onPartnerStatusChange,
}: UseMultiplayerSessionOptions): UseMultiplayerSessionResult {
  const [session, setSession] = useState<GameSession | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>("waiting");
  const [connectionStatus, setConnectionStatus] =
    useState<RecoveryConnectionStatus>("connecting");
  const [partnerStatus, setPartnerStatus] = useState<PartnerStatus>("connected");
  const [isRehydrating, setIsRehydrating] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const coordinatorRef = useRef<MultiplayerRecoveryCoordinator | null>(null);

  const callbacksRef = useRef({
    onGameEnded,
    onActionCommittedDuringDisconnect,
    onPartnerStatusChange,
  });

  useEffect(() => {
    callbacksRef.current = {
      onGameEnded,
      onActionCommittedDuringDisconnect,
      onPartnerStatusChange,
    };
  });

  // Initialize and run coordinator
  useEffect(() => {
    let isMounted = true;

    const coordinator = new MultiplayerRecoveryCoordinator({
      gameId,
      playerId,
      enableTabSync: true,
      onStateReconciled: (st, sess, phase) => {
        if (!isMounted) return;
        setGameState(st);
        setSession(sess);
        setGamePhase(phase);
        setIsRehydrating(false);
      },
      onActionCommittedDuringDisconnect: (action) => {
        callbacksRef.current.onActionCommittedDuringDisconnect?.(action);
      },
      onGameEndedWhileOffline: (st) => {
        if (!isMounted) return;
        setGamePhase("game_end");
        callbacksRef.current.onGameEnded?.(st);
      },
      onPartnerConnectionChange: (status) => {
        if (!isMounted) return;
        setPartnerStatus(status);
        callbacksRef.current.onPartnerStatusChange?.(status);
      },
      onConnectionStatusChange: (status) => {
        if (!isMounted) return;
        setConnectionStatus(status);
      },
      onPhaseChange: (phase) => {
        if (!isMounted) return;
        setGamePhase(phase);
      },
    });

    coordinatorRef.current = coordinator;

    coordinator
      .start()
      .then(({ session: s, state: st }) => {
        if (!isMounted) return;
        if (s) setSession(s);
        if (st) {
          setGameState(st);
          setGamePhase(computeAuthoritativePhase(st, s));
        }
        setIsRehydrating(false);
      })
      .catch(() => {
        if (isMounted) setIsRehydrating(false);
      });

    return () => {
      isMounted = false;
      coordinator.destroy();
      coordinatorRef.current = null;
    };
  }, [gameId, playerId]);

  const submitAction = useCallback(
    async (type: string, payload: unknown = {}, customUid?: string) => {
      if (!coordinatorRef.current) {
        throw new Error("Multiplayer coordinator is not active");
      }
      try {
        setIsSubmitting(true);
        const result = await coordinatorRef.current.submitAction(
          type,
          payload,
          customUid
        );
        if (result.gameState) {
          setGameState(result.gameState);
        }
        if (result.gameSession) {
          setSession(result.gameSession);
        }
        return result;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const rehydrate = useCallback(async (reason?: string) => {
    if (!coordinatorRef.current) return;
    setIsRehydrating(true);
    try {
      const res = await coordinatorRef.current.rehydrate(
        (reason as any) || "MANUAL"
      );
      if (res.session) setSession(res.session);
      if (res.state) {
        setGameState(res.state);
        setGamePhase(computeAuthoritativePhase(res.state, res.session));
      }
    } finally {
      setIsRehydrating(false);
    }
  }, []);

  return {
    session,
    gameState,
    gamePhase,
    connectionStatus,
    partnerStatus,
    isRehydrating,
    isSubmitting,
    submitAction,
    rehydrate,
    coordinator: coordinatorRef.current,
  };
}

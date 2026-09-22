import { NextRequest, NextResponse } from "next/server";
import { serverGameRepository, PersistenceError, logStructuredError } from "@/lib/firebase/server/gameRepository";
import { AuthoritativeGameEngine, CAMERA_CHALLENGES } from "@/lib/firebase/server/authoritativeGameEngine";
import { requireServerAuth, forbiddenResponse } from "@/lib/firebase/server/auth";
import { requireAppCheck } from "@/lib/firebase/server/security";
import type { GameSession, GameState, PublicGameState, GameType } from "@/types/domain";
import { getPublicState } from "@/lib/games/gameStateContract";

export const dynamic = "force-dynamic";

/**
 * Authoritative Game Session API Route
 * 
 * Provides:
 * - GET: Retrieves the current authoritative game aggregate { session, state }
 * - POST: Creates or returns an active game session for multi-player synchronization
 */
export async function GET(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ||
    `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  let gameId = "unknown_game";

  try {
    // 1. App Check Attestation
    const appCheckResult = await requireAppCheck(request);
    if (!appCheckResult.success) {
      return appCheckResult.errorResponse;
    }

    // 2. User Authentication
    const authResult = await requireServerAuth(request);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }
    const authUser = authResult.user;

    const { searchParams } = new URL(request.url);
    const queriedGameId = searchParams.get("gameId");

    if (!queriedGameId) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Missing required 'gameId' query parameter" } },
        { status: 400 }
      );
    }
    gameId = queriedGameId;

    const aggregate = await serverGameRepository.getGameAggregate(gameId);

    if (!aggregate) {
      return NextResponse.json(
        { error: { code: "GAME_NOT_FOUND", message: `Game session '${gameId}' not found` } },
        { status: 404 }
      );
    }

    // Access control: User must be a member player in this session
    if (!aggregate.session.playerIds.includes(authUser.uid)) {
      return forbiddenResponse("Access denied: You are not a player in this game session.");
    }

    const sanitizedAggregate = {
      session: aggregate.session,
      state: getPublicState({
        state: aggregate.state,
        viewingPlayerId: authUser.uid,
      }),
    };

    return NextResponse.json(sanitizedAggregate, { status: 200 });
  } catch (error) {
    if (error instanceof PersistenceError) {
      logStructuredError({
        requestId,
        gameId,
        actionId: "none",
        errorCategory: "PERSISTENCE_FAILURE",
        operation: error.operation,
        statusCode: 500,
        message: error.message,
        error,
      });

      return NextResponse.json(
        {
          error: {
            code: "PERSISTENCE_ERROR",
            message: "Failed to read game session from persistent store.",
          },
        },
        { status: 500 }
      );
    }

    logStructuredError({
      requestId,
      gameId,
      actionId: "none",
      errorCategory: "INTERNAL_FAILURE",
      statusCode: 500,
      message: error instanceof Error ? error.message : "Internal server error fetching game session",
      error,
    });

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error fetching game session" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ||
    `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  let gameId = "unknown_game";
  let authUid: string | undefined;

  try {
    // 1. App Check Attestation
    const appCheckResult = await requireAppCheck(request);
    if (!appCheckResult.success) {
      return appCheckResult.errorResponse;
    }

    // 2. User Authentication
    const authResult = await requireServerAuth(request);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }
    const authUser = authResult.user;
    authUid = authUser.uid;

    const body = (await request.json().catch(() => ({}))) as {
      gameId?: string;
      coupleId?: string;
      playerIds?: string[];
      gameType?: GameType;
      resetIfFinished?: boolean;
    };

    gameId = body.gameId || `fif_${Date.now().toString(36)}`;
    const coupleId = body.coupleId || "couple_space";
    const gameType: GameType = body.gameType || "find_it_first";

    // Check if session already exists
    const existing = await serverGameRepository.getGameAggregate(gameId);
    if (existing) {
      // Access control on existing session: Only participants may view or reset it
      if (!existing.session.playerIds.includes(authUser.uid)) {
        return forbiddenResponse("Access denied: You are not a player in this game session.");
      }

      const isFinished =
        Boolean(existing.state?.isFinished) ||
        existing.state?.status === "game_end" ||
        existing.session?.status === "game_end" ||
        existing.session?.status === "results";

      // If already exists and either reset is not requested OR game is not finished, return existing
      if (!body.resetIfFinished || !isFinished) {
        return NextResponse.json(existing, { status: 200 });
      }
    }

    // Ensure authenticated user is in the player list
    const playerIds = body.playerIds && body.playerIds.length >= 1
      ? body.playerIds.includes(authUser.uid)
        ? body.playerIds
        : [authUser.uid, ...body.playerIds]
      : [authUser.uid, "partner"];

    // Initialize fresh authoritative session & state
    const now = Date.now();
    const isSpeedDuel = gameType === "speed_duel";
    const isCoupleRace = gameType === "couple_race";
    const isCameraChallenge = gameType === "camera_challenge";
    const speedDuelTensionDelay = 2200;
    const speedDuelTargetTime = now + speedDuelTensionDelay;

    const session: GameSession = {
      gameId,
      coupleId,
      gameType,
      status: "ready",
      playerIds,
      createdBy: authUser.uid,
      createdAt: new Date(now).toISOString(),
      schemaVersion: 1,
      readyPlayerIds: [],
    };

    let initialData: Record<string, unknown>;

    if (isCoupleRace) {
      const players: Record<string, unknown> = {};
      for (const pid of playerIds) {
        players[pid] = {
          playerId: pid,
          position: 0,
          lapsCompleted: 0,
          powers: ["WIND_STRIDE"],
          shieldActive: false,
          activeEffects: [],
          totalRolls: 0,
          connectionStatus: "connected",
          disconnectedAt: null,
        };
      }

      initialData = {
        gameType: "couple_race",
        mode: "competitive",
        boardSize: 24,
        targetLaps: 2,
        players,
        currentTurnPlayerId: playerIds[0],
        turnNumber: 1,
        hasRolledThisTurn: false,
        hasMovedThisTurn: false,
        currentDiceValue: null,
        secondDiceValue: null,
        validMovePositions: [],
        activePowerThisTurn: null,
        isPaused: false,
        pausedByPlayerId: null,
        roundHistory: [],
        cooperativeHarmonyScore: 0,
      };
    } else if (isSpeedDuel) {
      initialData = {
        gameType: "speed_duel",
        roundStage: "ready",
        tensionStartedAtServer: now,
        tensionDelayMs: speedDuelTensionDelay,
        targetAppearedAtServer: speedDuelTargetTime,
        roundWinnerId: null,
        roundWinnerReactionMs: null,
        roundWinnerReason: null,
        playerReactions: {},
        falseStarts: {},
        roundHistory: [],
        competitiveMode: "first_to_3",
      };
    } else if (isCameraChallenge) {
      initialData = {
        gameType: "camera_challenge",
        stage: "challenge",
        currentPromptIndex: 0,
        currentPrompt: CAMERA_CHALLENGES[0],
        submissions: {},
        stageStartedAtServer: now,
        stageDeadlineServer: now + 60000,
        roundHistory: [],
        skips: {},
        isGameEnd: false,
      };
    } else {
      // Pre-game ready state contains NO secret target data (targetId, targetName, targetCode, targetAnswer, usedTargetIds).
      // The authoritative round target is generated exclusively when START_GAME is submitted and stored in privateGameStates.
      initialData = {
        board: [],
        roundWinnerId: null,
        roundWinningCell: null,
        lastMistake: null,
        roundStage: "ready",
        roundHistory: [],
      };
    }

    const state: GameState = {
      gameId,
      gameType,
      status: "ready",
      currentRound: 1,
      maxRounds: isCoupleRace ? 10 : 5,
      version: 1,
      scores: Object.fromEntries(playerIds.map((pid) => [pid, 0])),
      turnPlayerId: isCoupleRace ? playerIds[0] : null,
      roundStartedAtServer: now,
      roundDeadlineServer: isSpeedDuel
        ? speedDuelTargetTime + 6000
        : isCoupleRace
        ? now + 45000
        : now + 15000,
      serverTimestamp: now,
      data: initialData,
      processedActionIds: {},
      isFinished: false,
      winnerId: null,
    };

    // Produce strictly sanitized PublicGameState via formal contract
    const publicState = getPublicState({ state, viewingPlayerId: authUid });

    await serverGameRepository.saveGameSession(session);
    await serverGameRepository.saveEphemeralGameState(publicState);

    return NextResponse.json({ session, state: publicState }, { status: 201 });
  } catch (error) {
    if (error instanceof PersistenceError) {
      logStructuredError({
        requestId,
        gameId,
        actionId: "none",
        playerId: authUid,
        errorCategory: "PERSISTENCE_FAILURE",
        operation: error.operation,
        statusCode: 500,
        message: error.message,
        error,
      });

      return NextResponse.json(
        {
          error: {
            code: "PERSISTENCE_ERROR",
            message: "Failed to persist game session to authoritative store.",
          },
        },
        { status: 500 }
      );
    }

    logStructuredError({
      requestId,
      gameId,
      actionId: "none",
      playerId: authUid,
      errorCategory: "INTERNAL_FAILURE",
      statusCode: 500,
      message: error instanceof Error ? error.message : "Internal server error creating game session",
      error,
    });

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error creating game session" } },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { serverGameRepository } from "@/lib/firebase/server/gameRepository";
import { AuthoritativeGameEngine, CAMERA_CHALLENGES } from "@/lib/firebase/server/authoritativeGameEngine";
import type { GameSession, GameState, GameType } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * Authoritative Game Session API Route
 * 
 * Provides:
 * - GET: Retrieves the current authoritative game aggregate { session, state }
 * - POST: Creates or returns an active game session for multi-player synchronization
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");

    if (!gameId) {
      return NextResponse.json(
        { error: { message: "Missing required 'gameId' query parameter" } },
        { status: 400 }
      );
    }

    const aggregate = await serverGameRepository.getGameAggregate(gameId);

    if (!aggregate) {
      return NextResponse.json(
        { error: { message: `Game session '${gameId}' not found` } },
        { status: 404 }
      );
    }

    return NextResponse.json(aggregate, { status: 200 });
  } catch (error) {
    console.error("[GameSession GET Error]", error);
    return NextResponse.json(
      { error: { message: "Internal server error fetching game session" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      gameId?: string;
      coupleId?: string;
      playerIds?: string[];
      gameType?: GameType;
      resetIfFinished?: boolean;
    };

    const gameId = body.gameId || `fif_${Date.now().toString(36)}`;
    const coupleId = body.coupleId || "couple_london_tokyo";
    const gameType: GameType = body.gameType || "find_it_first";
    const playerIds =
      body.playerIds && body.playerIds.length >= 2
        ? body.playerIds
        : ["user_alex", "user_sam"];

    // Check if session already exists
    const existing = await serverGameRepository.getGameAggregate(gameId);
    if (existing && !body.resetIfFinished) {
      return NextResponse.json(existing, { status: 200 });
    }

    // Initialize fresh authoritative session & state
    const now = Date.now();
    const isSpeedDuel = gameType === "speed_duel";
    const isCoupleRace = gameType === "couple_race";
    const isCameraChallenge = gameType === "camera_challenge";
    const roundGen = isSpeedDuel || isCoupleRace || isCameraChallenge ? null : AuthoritativeGameEngine.generateAuthoritativeRound(1, []);
    const speedDuelTensionDelay = 2200;
    const speedDuelTargetTime = now + speedDuelTensionDelay;

    const session: GameSession = {
      gameId,
      coupleId,
      gameType,
      status: "ready",
      playerIds,
      createdBy: playerIds[0],
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
      initialData = {
        targetId: roundGen!.targetId,
        targetName: roundGen!.target.name,
        targetCode: roundGen!.target.code,
        targetClue: roundGen!.target.clue,
        board: roundGen!.board,
        usedTargetIds: [roundGen!.targetId],
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

    await serverGameRepository.saveGameSession(session);
    await serverGameRepository.saveEphemeralGameState(state);

    return NextResponse.json({ session, state }, { status: 201 });
  } catch (error) {
    console.error("[GameSession POST Error]", error);
    return NextResponse.json(
      { error: { message: "Internal server error creating game session" } },
      { status: 500 }
    );
  }
}

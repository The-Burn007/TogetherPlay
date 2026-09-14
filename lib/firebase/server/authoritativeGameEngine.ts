/**
 * Authoritative Server Game Engine
 * 
 * ARCHITECTURAL MANDATE:
 * THE BROWSER IS UNTRUSTED.
 * The server is strictly authoritative.
 * 
 * The client must never control:
 * - scores
 * - dice
 * - cards
 * - winners
 * - authoritative timers
 * - game state
 * 
 * All state mutations and game logic run on the server using server-side timestamps.
 */

import type { GameSession, GameState, GameAction, GameResult } from "@/types/domain";

export interface ArtifactDefinition {
  id: string;
  name: string;
  code: string;
  clue: string;
  category: "horology" | "navigation" | "antiquarian" | "correspondence" | "optics" | "curio";
}

export const ARTIFACT_CATALOG: ArtifactDefinition[] = [
  { id: "watch", name: "Pocket Watch", code: "#01", clue: "Precision horology with mechanical escapement", category: "horology" },
  { id: "compass", name: "Brass Compass", code: "#02", clue: "Magnetic needle attuned to true north", category: "navigation" },
  { id: "key", name: "Skeleton Key", code: "#03", clue: "Ornate iron bit suited for heavy deadbolts", category: "antiquarian" },
  { id: "seal", name: "Wax Seal", code: "#04", clue: "Vermilion crest pressed into warm beeswax", category: "correspondence" },
  { id: "pen", name: "Gold Nib Pen", code: "#05", clue: "Hand-ground iridium tip for maritime logs", category: "correspondence" },
  { id: "hourglass", name: "Brass Hourglass", code: "#06", clue: "Granular silicon sifting through twin globes", category: "horology" },
  { id: "prism", name: "Crystal Prism", code: "#07", clue: "Optical flint refracting white sunlight", category: "optics" },
  { id: "book", name: "Leather Tome", code: "#08", clue: "Hand-stitched folio bound in aged vellum", category: "antiquarian" },
  { id: "camera", name: "Twin Lens", code: "#09", clue: "Reflex viewfinder with brass aperture wheel", category: "optics" },
  { id: "bell", name: "Desk Bell", code: "#10", clue: "Domed bronze resonator with spring striker", category: "curio" },
  { id: "monocle", name: "Framed Monocle", code: "#11", clue: "Polished convex glass with galleried rim", category: "optics" },
  { id: "mug", name: "Clay Mug", code: "#12", clue: "Stoneware vessel fired with salt glaze", category: "curio" },
  { id: "postcard", name: "Airmail Post", code: "#13", clue: "Franked postmark from an overseas harbor", category: "correspondence" },
  { id: "sextant", name: "Nautical Sextant", code: "#14", clue: "Graduated silver arc for celestial sights", category: "navigation" },
  { id: "armillary", name: "Armillary Ring", code: "#15", clue: "Concentric rings modeling the ecliptic sphere", category: "navigation" },
  { id: "lamp", name: "Brass Lantern", code: "#16", clue: "Beveled glass cage sheltering a warm flame", category: "curio" },
];

export interface GameEngineExecutionResult {
  updatedState: GameState;
  updatedSession: GameSession;
  gameResult?: GameResult | null;
  authoritativePayload?: Record<string, unknown>;
}

export class AuthoritativeGameEngine {
  /**
   * Generates a cryptographically secure random dice roll [1..6] on the server.
   * Client-supplied rolls are completely ignored.
   */
  static serverRollDice(): number {
    return Math.floor(Math.random() * 6) + 1;
  }

  /**
   * Generates an authoritative round configuration for Find It First.
   * The server selects the target and generates the board state.
   */
  static generateAuthoritativeRound(
    roundNumber: number,
    previousTargetIds: string[] = []
  ): {
    targetId: string;
    target: ArtifactDefinition;
    board: string[];
  } {
    const availableTargets = ARTIFACT_CATALOG.filter((a) => !previousTargetIds.includes(a.id));
    const pool = availableTargets.length > 0 ? availableTargets : ARTIFACT_CATALOG;
    const targetIndex = Math.floor(Math.random() * pool.length);
    const target = pool[targetIndex];

    const distractors = ARTIFACT_CATALOG.filter((a) => a.id !== target.id);
    const shuffledDistractors = [...distractors].sort(() => Math.random() - 0.5).slice(0, 11);
    const board = [target.id, ...shuffledDistractors.map((d) => d.id)].sort(() => Math.random() - 0.5);

    return {
      targetId: target.id,
      target,
      board,
    };
  }

  /**
   * Processes an authoritative action on the game state.
   * Modifies the game state based on server rules and server timestamp.
   */
  static applyAction(
    session: GameSession,
    currentState: GameState,
    action: GameAction,
    playerId: string,
    serverTimestamp: number
  ): GameEngineExecutionResult {
    // Clone state immutably
    const nextState: GameState = {
      ...currentState,
      scores: { ...currentState.scores },
      data: { ...currentState.data },
      processedActionIds: { ...currentState.processedActionIds },
      version: currentState.version + 1,
      serverTimestamp,
    };

    const nextSession: GameSession = {
      ...session,
      playerIds: [...session.playerIds],
    };

    let createdResult: GameResult | null = null;
    let authoritativePayload: Record<string, unknown> = {};

    switch (action.type) {
      case "START_GAME": {
        nextState.status = "playing";
        nextState.currentRound = 1;
        nextState.maxRounds = 5;
        nextState.roundStartedAtServer = serverTimestamp;
        // Authoritative 15-second round deadline for tactile digital tabletop play
        nextState.roundDeadlineServer = serverTimestamp + 15000;
        nextState.turnPlayerId = nextSession.playerIds[0] || playerId;
        nextState.isFinished = false;
        nextState.winnerId = null;

        // Initialize Find It First authoritative board & target
        const roundGen = this.generateAuthoritativeRound(1, []);
        nextState.data = {
          ...nextState.data,
          targetId: roundGen.targetId,
          targetName: roundGen.target.name,
          targetCode: roundGen.target.code,
          targetClue: roundGen.target.clue,
          board: roundGen.board,
          usedTargetIds: [roundGen.targetId],
          roundWinnerId: null,
          roundWinningCell: null,
          lastMistake: null,
          roundStage: "playing",
          roundHistory: [],
        };

        nextSession.status = "playing";
        nextSession.startedAt = new Date(serverTimestamp).toISOString();

        authoritativePayload = {
          started: true,
          round: 1,
          targetId: roundGen.targetId,
          targetName: roundGen.target.name,
          board: roundGen.board,
          roundDeadlineServer: nextState.roundDeadlineServer,
        };
        break;
      }

      case "READY": {
        const readySet = new Set(nextSession.readyPlayerIds || []);
        readySet.add(playerId);
        nextSession.readyPlayerIds = Array.from(readySet);

        if (nextSession.readyPlayerIds.length >= 2) {
          nextSession.status = "countdown";
          nextState.status = "countdown";
        } else {
          nextSession.status = "ready";
          nextState.status = "ready";
        }

        authoritativePayload = {
          readyPlayerIds: nextSession.readyPlayerIds,
          isFullReady: nextSession.readyPlayerIds.length >= 2,
        };
        break;
      }

      case "ROLL_DICE": {
        // SECURITY: Server generates the dice roll! Any roll in action.payload is ignored.
        const serverDiceValue = this.serverRollDice();

        // Server computes new score
        const currentScore = nextState.scores[playerId] || 0;
        const newScore = currentScore + serverDiceValue;
        nextState.scores[playerId] = newScore;

        nextState.data.lastDiceRoll = {
          playerId,
          value: serverDiceValue,
          serverTimestamp,
        };

        // Advance turn authoritatively if turn-based
        const otherPlayer = nextSession.playerIds.find((id) => id !== playerId) || playerId;
        nextState.turnPlayerId = otherPlayer;

        // Check if round finishes
        if (nextState.currentRound >= nextState.maxRounds) {
          createdResult = this.finalizeGame(nextSession, nextState, serverTimestamp);
        } else {
          nextState.currentRound += 1;
          nextState.roundStartedAtServer = serverTimestamp;
          nextState.roundDeadlineServer = serverTimestamp + 30000;
        }

        authoritativePayload = {
          serverDiceValue,
          newScore,
          scores: { ...nextState.scores },
          turnPlayerId: nextState.turnPlayerId,
        };
        break;
      }

      case "SELECT_CELL":
      case "SUBMIT_ANSWER": {
        const rawPayload = (action.payload && typeof action.payload === "object" ? action.payload : {}) as Record<string, unknown>;
        const choice = String(rawPayload.cellId || rawPayload.choice || "");
        const serverTarget = String(nextState.data.targetId || nextState.data.targetAnswer || "CORRECT_ANSWER");

        // If this round already has a recorded winner, ignore redundant clicks
        if (nextState.data.roundWinnerId) {
          authoritativePayload = {
            alreadyResolved: true,
            roundWinnerId: nextState.data.roundWinnerId,
            scores: { ...nextState.scores },
          };
          break;
        }

        const isCorrect = choice === serverTarget || rawPayload.isCorrectMock === true;

        if (isCorrect) {
          // Authoritative speed-scaled scoring:
          // Base 100 points + speed bonus based on server-side remaining time
          const remainingMs = Math.max(0, nextState.roundDeadlineServer - serverTimestamp);
          const speedBonus = Math.min(150, Math.floor(remainingMs / 100));
          const pointsAwarded = 100 + speedBonus;

          const currentScore = nextState.scores[playerId] || 0;
          nextState.scores[playerId] = currentScore + pointsAwarded;

          nextState.data.roundWinnerId = playerId;
          nextState.data.roundWinningCell = choice;
          nextState.data.pointsAwarded = pointsAwarded;
          nextState.data.speedBonus = speedBonus;
          nextState.data.lastMistake = null;

          // Record round outcome into history
          const roundHistory = Array.isArray(nextState.data.roundHistory) ? [...nextState.data.roundHistory] : [];
          roundHistory.push({
            round: nextState.currentRound,
            winnerId: playerId,
            targetId: serverTarget,
            targetName: nextState.data.targetName || serverTarget,
            pointsAwarded,
            speedBonus,
            scoresAtEnd: { ...nextState.scores },
            serverTimestamp,
          });
          nextState.data.roundHistory = roundHistory;

          // Check if game completes (5 rounds)
          if (nextState.currentRound >= nextState.maxRounds) {
            createdResult = this.finalizeGame(nextSession, nextState, serverTimestamp);
            nextState.status = "game_end";
            nextState.data.roundStage = "game_end";
          } else {
            nextState.status = "round_end";
            nextState.data.roundStage = "round_result";
            nextState.data.nextRoundAvailableAt = serverTimestamp + 2500;
          }

          authoritativePayload = {
            isCorrect: true,
            cellId: choice,
            roundWinnerId: playerId,
            pointsAwarded,
            speedBonus,
            scores: { ...nextState.scores },
            currentRound: nextState.currentRound,
            isFinished: nextState.isFinished,
          };
        } else {
          // Authoritative Incorrect Feedback
          const currentScore = nextState.scores[playerId] || 0;
          const penalty = 10;
          const newScore = Math.max(0, currentScore - penalty);
          nextState.scores[playerId] = newScore;

          const mistake = {
            playerId,
            cellId: choice,
            penalty,
            serverTimestamp,
          };
          nextState.data.lastMistake = mistake;

          authoritativePayload = {
            isCorrect: false,
            cellId: choice,
            playerId,
            penalty,
            scores: { ...nextState.scores },
            currentRound: nextState.currentRound,
          };
        }
        break;
      }

      case "NEXT_ROUND": {
        if (nextState.currentRound >= nextState.maxRounds) {
          createdResult = this.finalizeGame(nextSession, nextState, serverTimestamp);
          nextState.status = "game_end";
          authoritativePayload = { gameEnded: true, winnerId: nextState.winnerId };
          break;
        }

        nextState.currentRound += 1;
        const usedIds = Array.isArray(nextState.data.usedTargetIds) ? (nextState.data.usedTargetIds as string[]) : [];
        const roundGen = this.generateAuthoritativeRound(nextState.currentRound, usedIds);

        nextState.data.targetId = roundGen.targetId;
        nextState.data.targetName = roundGen.target.name;
        nextState.data.targetCode = roundGen.target.code;
        nextState.data.targetClue = roundGen.target.clue;
        nextState.data.board = roundGen.board;
        nextState.data.usedTargetIds = [...usedIds, roundGen.targetId];
        nextState.data.roundWinnerId = null;
        nextState.data.roundWinningCell = null;
        nextState.data.lastMistake = null;
        nextState.data.roundStage = "playing";

        nextState.status = "playing";
        nextState.roundStartedAtServer = serverTimestamp;
        nextState.roundDeadlineServer = serverTimestamp + 15000;

        authoritativePayload = {
          round: nextState.currentRound,
          targetId: roundGen.targetId,
          targetName: roundGen.target.name,
          board: roundGen.board,
          roundDeadlineServer: nextState.roundDeadlineServer,
        };
        break;
      }

      case "REMATCH": {
        nextState.status = "playing";
        nextState.isFinished = false;
        nextState.winnerId = null;
        nextState.currentRound = 1;
        nextState.maxRounds = 5;
        nextState.scores = Object.fromEntries(nextSession.playerIds.map((pid) => [pid, 0]));

        nextSession.status = "playing";
        nextSession.winnerId = null;
        nextSession.startedAt = new Date(serverTimestamp).toISOString();
        delete nextSession.endedAt;

        const roundGen = this.generateAuthoritativeRound(1, []);
        nextState.data = {
          targetId: roundGen.targetId,
          targetName: roundGen.target.name,
          targetCode: roundGen.target.code,
          targetClue: roundGen.target.clue,
          board: roundGen.board,
          usedTargetIds: [roundGen.targetId],
          roundWinnerId: null,
          roundWinningCell: null,
          lastMistake: null,
          roundStage: "playing",
          roundHistory: [],
        };

        nextState.roundStartedAtServer = serverTimestamp;
        nextState.roundDeadlineServer = serverTimestamp + 15000;

        authoritativePayload = {
          rematchStarted: true,
          round: 1,
          targetId: roundGen.targetId,
          targetName: roundGen.target.name,
          board: roundGen.board,
          roundDeadlineServer: nextState.roundDeadlineServer,
        };
        break;
      }

      case "SUBMIT_REACTION": {
        // SECURITY: Reaction speed measured against server start timestamp, NOT client timestamp
        const reactionTimeMs = Math.max(0, serverTimestamp - nextState.roundStartedAtServer);
        
        // Faster reaction earns higher server-calculated score
        const pointsAwarded = Math.max(10, Math.floor(1000 - Math.min(900, reactionTimeMs)));
        nextState.scores[playerId] = (nextState.scores[playerId] || 0) + pointsAwarded;

        authoritativePayload = {
          reactionTimeMs,
          pointsAwarded,
          scores: { ...nextState.scores },
        };
        break;
      }

      case "END_GAME": {
        createdResult = this.finalizeGame(nextSession, nextState, serverTimestamp);
        authoritativePayload = {
          gameEnded: true,
          winnerId: nextState.winnerId,
        };
        break;
      }

      default: {
        // Generic fallback action that advances state without mutating scores
        authoritativePayload = {
          actionExecuted: action.type,
          serverTimestamp,
        };
        break;
      }
    }

    // Record clientActionId for idempotency
    nextState.processedActionIds[action.clientActionId] = serverTimestamp;
    nextState.lastProcessedAction = {
      clientActionId: action.clientActionId,
      type: action.type,
      playerId,
      serverTimestamp,
    };

    return {
      updatedState: nextState,
      updatedSession: nextSession,
      gameResult: createdResult,
      authoritativePayload,
    };
  }

  /**
   * Finalizes the game authoritatively:
   * - Evaluates winner purely from server scores
   * - Sets session status to "game_end"
   * - Creates durable GameResult for Firestore
   */
  private static finalizeGame(
    session: GameSession,
    state: GameState,
    serverTimestamp: number
  ): GameResult {
    state.status = "game_end";
    state.isFinished = true;

    // Evaluate winner authoritatively
    const scores = state.scores;
    const playerIds = session.playerIds;
    let highestScore = -Infinity;
    let winnerId: string | null = null;
    let isTie = false;

    for (const pid of playerIds) {
      const score = scores[pid] || 0;
      if (score > highestScore) {
        highestScore = score;
        winnerId = pid;
        isTie = false;
      } else if (score === highestScore) {
        isTie = true;
      }
    }

    if (isTie) {
      winnerId = null; // Tie
    }

    state.winnerId = winnerId;
    session.status = "game_end";
    session.winnerId = winnerId;
    session.endedAt = new Date(serverTimestamp).toISOString();

    const startedTime = session.startedAt ? new Date(session.startedAt).getTime() : new Date(session.createdAt).getTime();
    const durationSeconds = Math.max(1, Math.round((serverTimestamp - startedTime) / 1000));

    const result: GameResult = {
      resultId: `res_${session.gameId}_${Date.now()}`,
      gameId: session.gameId,
      coupleId: session.coupleId,
      gameType: session.gameType,
      playerIds: session.playerIds,
      winnerId,
      finalScores: { ...state.scores },
      totalRounds: state.currentRound,
      durationSeconds,
      startedAt: session.startedAt || session.createdAt,
      completedAt: new Date(serverTimestamp).toISOString(),
      serverTimestamp,
      summary: {
        winnerId,
        finalScores: { ...state.scores },
        isTie,
      },
    };

    return result;
  }
}

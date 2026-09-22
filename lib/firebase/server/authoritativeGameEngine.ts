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

import type {
  GameSession,
  GameState,
  PublicGameState,
  GameAction,
  GameResult,
  PrivateGameState,
  CoupleRaceTile,
  CoupleRacePowerType,
  CoupleRacePlayerState,
  CameraChallengePrompt,
  CameraChallengeSubmission,
  CameraChallengeReview,
  CameraChallengeResolution,
} from "@/types/domain";
import { MAX_BOUNDED_PROCESSED_ACTIONS } from "@/types/domain";
import { ActionValidationError } from "./errors";
import {
  getPublicState,
  getPrivateState,
  auditPublicStateForLeaks,
  GAME_STATE_CONTRACTS,
  FORBIDDEN_PUBLIC_FIELDS,
} from "@/lib/games/gameStateContract";
import {
  secureRandomInt,
  secureRandomChoice,
  secureFisherYatesShuffle,
  setTestRandomSource,
  getTestRandomSource,
  resetTestRandomSource,
  withTestRandomSource,
  type ServerRandomSource,
  DeterministicTestRandomSource,
} from "./random";

export {
  type ServerRandomSource,
  DeterministicTestRandomSource,
  withTestRandomSource,
  setTestRandomSource,
  resetTestRandomSource,
  secureRandomInt,
  secureRandomChoice,
  secureFisherYatesShuffle,
};

if (typeof window !== "undefined") {
  throw new Error("Security Violation: AuthoritativeGameEngine cannot be loaded in client browser bundle.");
}

import {
  CAMERA_CHALLENGES,
  COUPLE_RACE_TILES,
  ARTIFACT_CATALOG,
  type ArtifactDefinition,
} from "@/lib/games/definitions";

export {
  CAMERA_CHALLENGES,
  COUPLE_RACE_TILES,
  ARTIFACT_CATALOG,
  type ArtifactDefinition,
};

export interface GameEngineExecutionResult {
  updatedState: GameState;
  updatedSession: GameSession;
  gameResult?: GameResult | null;
  authoritativePayload?: Record<string, unknown>;
  updatedPrivateState?: PrivateGameState | null;
}

export class AuthoritativeGameEngine {
  /**
   * Produces an authoritative, client-safe PublicGameState.
   * Strips all secret targets, hidden keys, and cheating vectors.
   */
  static getPublicState(fullState: {
    state: GameState;
    privateState?: PrivateGameState | null;
    viewingPlayerId?: string;
  }): PublicGameState {
    return getPublicState(fullState);
  }

  /**
   * Extracts or produces the server-only PrivateGameState.
   */
  static getPrivateState(fullState: {
    state: GameState;
    privateState?: PrivateGameState | null;
  }): PrivateGameState | null {
    return getPrivateState(fullState);
  }

  /**
   * Generates a cryptographically secure random dice roll [min..max] (inclusive) on the server.
   * Uses rejection-sampled CSPRNG without modulo bias.
   * Client-supplied rolls are completely ignored.
   */
  static serverRollDice(min = 1, max = 6): number {
    return secureRandomInt(min, max);
  }

  /**
   * Generates an authoritative round configuration for Find It First.
   * The server selects the target via CSPRNG and generates the board state
   * using a proper Fisher-Yates (Knuth) shuffle algorithm driven by cryptographically
   * secure integers.
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
    const target = secureRandomChoice(pool);

    const distractors = ARTIFACT_CATALOG.filter((a) => a.id !== target.id);
    const shuffledDistractors = secureFisherYatesShuffle(distractors).slice(0, 11);
    const board = secureFisherYatesShuffle([target.id, ...shuffledDistractors.map((d) => d.id)]);

    return {
      targetId: target.id,
      target,
      board,
    };
  }

  /**
   * Injects a deterministic random source for testing purposes.
   * Strictly forbidden in production environments.
   */
  static setTestRandomSource(source: ServerRandomSource | null): void {
    setTestRandomSource(source);
  }

  /**
   * Returns the active test random source or null.
   */
  static getTestRandomSource(): ServerRandomSource | null {
    return getTestRandomSource();
  }

  /**
   * Resets any test random source, restoring default CSPRNG.
   */
  static resetTestRandomSource(): void {
    resetTestRandomSource();
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
    serverTimestamp: number,
    currentPrivateState?: PrivateGameState | null
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
    let updatedPrivateState: PrivateGameState | null = currentPrivateState
      ? { ...currentPrivateState }
      : null;

    switch (action.type) {
      case "START_GAME": {
        nextState.status = "playing";
        nextState.currentRound = 1;
        nextState.maxRounds = 5;
        nextState.roundStartedAtServer = serverTimestamp;
        nextState.turnPlayerId = nextSession.playerIds[0] || playerId;
        nextState.isFinished = false;
        nextState.winnerId = null;

        if (session.gameType === "speed_duel") {
          // Authoritative random tension delay: 1800ms - 4199ms via server CSPRNG
          const tensionDelayMs = secureRandomInt(1800, 4199);
          const targetAppearedAtServer = serverTimestamp + tensionDelayMs;
          nextState.roundDeadlineServer = targetAppearedAtServer + 6000;
          nextState.scores = Object.fromEntries(nextSession.playerIds.map((pid) => [pid, 0]));

          nextState.data = {
            gameType: "speed_duel",
            roundStage: "tension",
            tensionStartedAtServer: serverTimestamp,
            tensionDelayMs,
            targetAppearedAtServer,
            roundWinnerId: null,
            roundWinnerReactionMs: null,
            roundWinnerReason: null,
            playerReactions: {},
            falseStarts: {},
            roundHistory: [],
            competitiveMode: "first_to_3",
          };

          nextSession.status = "playing";
          nextSession.startedAt = new Date(serverTimestamp).toISOString();

          authoritativePayload = {
            started: true,
            round: 1,
            gameType: "speed_duel",
            tensionDelayMs,
            targetAppearedAtServer,
            roundDeadlineServer: nextState.roundDeadlineServer,
          };
        } else if (session.gameType === "couple_race") {
          // Initialize Couple Race digital tabletop board & authoritative players
          const players: Record<string, CoupleRacePlayerState> = {};
          for (const pid of nextSession.playerIds) {
            players[pid] = {
              playerId: pid,
              position: 0,
              lapsCompleted: 0,
              powers: ["WIND_STRIDE"], // initial tactical card
              shieldActive: false,
              activeEffects: [],
              totalRolls: 0,
              connectionStatus: "connected",
              disconnectedAt: null,
            };
          }

          nextState.turnPlayerId = nextSession.playerIds[0] || playerId;
          nextState.roundDeadlineServer = serverTimestamp + 45000; // 45s turn deadline
          nextState.scores = Object.fromEntries(nextSession.playerIds.map((pid) => [pid, 0]));
          nextState.currentRound = 1;
          nextState.maxRounds = 10; // laps & turns

          nextState.data = {
            gameType: "couple_race",
            mode: "competitive",
            boardSize: 24,
            targetLaps: 2,
            players,
            currentTurnPlayerId: nextState.turnPlayerId,
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

          nextSession.status = "playing";
          nextSession.startedAt = new Date(serverTimestamp).toISOString();

          authoritativePayload = {
            started: true,
            gameType: "couple_race",
            turnPlayerId: nextState.turnPlayerId,
            boardSize: 24,
            targetLaps: 2,
            players,
          };
        } else if (session.gameType === "camera_challenge") {
          const currentPrompt = CAMERA_CHALLENGES[0];
          nextState.currentRound = 1;
          nextState.maxRounds = 5;
          nextState.scores = Object.fromEntries(nextSession.playerIds.map((pid) => [pid, 0]));
          nextState.roundStartedAtServer = serverTimestamp;
          nextState.roundDeadlineServer = serverTimestamp + 60000;

          nextState.data = {
            gameType: "camera_challenge",
            stage: "challenge",
            currentPromptIndex: 0,
            currentPrompt,
            submissions: {},
            stageStartedAtServer: serverTimestamp,
            stageDeadlineServer: serverTimestamp + 60000,
            roundHistory: [],
            skips: {},
            isGameEnd: false,
          };

          nextSession.status = "playing";
          nextSession.startedAt = new Date(serverTimestamp).toISOString();

          authoritativePayload = {
            started: true,
            gameType: "camera_challenge",
            round: 1,
            stage: "challenge",
            prompt: currentPrompt,
          };
        } else {
          // Initialize Find It First authoritative board & target
          // Authoritative 15-second round deadline for tactile digital tabletop play
          nextState.roundDeadlineServer = serverTimestamp + 15000;
          const roundGen = this.generateAuthoritativeRound(1, []);

          updatedPrivateState = {
            gameId: session.gameId,
            targetId: roundGen.targetId,
            targetName: roundGen.target.name,
            targetCode: roundGen.target.code,
            targetClue: roundGen.target.clue,
            usedTargetIds: [roundGen.targetId],
          };

          nextState.data = {
            ...nextState.data,
            targetClue: roundGen.target.clue,
            board: roundGen.board,
            roundWinnerId: null,
            roundWinningCell: null,
            lastMistake: null,
            roundStage: "playing",
            roundHistory: [],
          };
          delete nextState.data.targetId;
          delete nextState.data.targetName;
          delete nextState.data.targetCode;
          delete nextState.data.usedTargetIds;

          nextSession.status = "playing";
          nextSession.startedAt = new Date(serverTimestamp).toISOString();

          authoritativePayload = {
            started: true,
            round: 1,
            targetClue: roundGen.target.clue,
            board: roundGen.board,
            roundDeadlineServer: nextState.roundDeadlineServer,
          };
        }
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
        if (session.gameType === "couple_race") {
          if (nextState.turnPlayerId && nextState.turnPlayerId !== playerId) {
            authoritativePayload = { error: "NOT_YOUR_TURN", turnPlayerId: nextState.turnPlayerId };
            break;
          }
          if (nextState.data.hasRolledThisTurn) {
            authoritativePayload = { error: "ALREADY_ROLLED_THIS_TURN" };
            break;
          }

          // Authoritative server randomness: client dice rolls are ignored
          const activePower = nextState.data.activePowerThisTurn as CoupleRacePowerType | null;
          let serverDiceValue = this.serverRollDice();
          let secondDiceValue: number | null = null;

          if (activePower === "DOUBLE_DICE") {
            secondDiceValue = this.serverRollDice();
            serverDiceValue = serverDiceValue + secondDiceValue;
          }

          let distance = serverDiceValue;
          if (activePower === "WIND_STRIDE") {
            distance += 2;
          }

          const players = (nextState.data.players || {}) as Record<string, CoupleRacePlayerState>;
          const playerState = players[playerId] || {
            playerId,
            position: 0,
            lapsCompleted: 0,
            powers: [],
            shieldActive: false,
            activeEffects: [],
            totalRolls: 0,
            connectionStatus: "connected",
            disconnectedAt: null,
          };

          const currentPos = playerState.position || 0;
          const boardSize = Number(nextState.data.boardSize) || 24;
          const targetPos = (currentPos + distance) % boardSize;
          const validMovePositions = [targetPos];

          nextState.data.hasRolledThisTurn = true;
          nextState.data.currentDiceValue = serverDiceValue;
          nextState.data.secondDiceValue = secondDiceValue;
          nextState.data.effectiveDistance = distance;
          nextState.data.validMovePositions = validMovePositions;

          playerState.totalRolls = (playerState.totalRolls || 0) + 1;
          players[playerId] = playerState;
          nextState.data.players = players;

          authoritativePayload = {
            diceValue: serverDiceValue,
            secondDiceValue,
            totalDistance: distance,
            validMovePositions,
            turnPlayerId: nextState.turnPlayerId,
            hasRolled: true,
          };
          break;
        }

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

      case "MOVE": {
        if (session.gameType === "couple_race") {
          if (nextState.turnPlayerId && nextState.turnPlayerId !== playerId) {
            authoritativePayload = { error: "NOT_YOUR_TURN" };
            break;
          }
          if (!nextState.data.hasRolledThisTurn) {
            authoritativePayload = { error: "MUST_ROLL_FIRST" };
            break;
          }
          if (nextState.data.hasMovedThisTurn) {
            authoritativePayload = { error: "ALREADY_MOVED_THIS_TURN" };
            break;
          }

          const rawPayload = (action.payload && typeof action.payload === "object" ? action.payload : {}) as Record<string, unknown>;
          const requestedTarget = typeof rawPayload.targetPosition === "number" ? rawPayload.targetPosition : null;
          const validMoves = (nextState.data.validMovePositions as number[]) || [];

          const targetPos = requestedTarget !== null && validMoves.includes(requestedTarget) ? requestedTarget : validMoves[0];
          const players = (nextState.data.players || {}) as Record<string, CoupleRacePlayerState>;
          const pState = players[playerId] || {
            playerId,
            position: 0,
            lapsCompleted: 0,
            powers: [],
            shieldActive: false,
            activeEffects: [],
            totalRolls: 0,
            connectionStatus: "connected",
            disconnectedAt: null,
          };

          const oldPos = pState.position;
          const distance = Number(nextState.data.effectiveDistance) || Number(nextState.data.currentDiceValue) || 1;
          const boardSize = Number(nextState.data.boardSize) || 24;

          // Lap completion check: advancing past tile 0
          let completedLap = false;
          if (oldPos + distance >= boardSize) {
            pState.lapsCompleted += 1;
            completedLap = true;
            nextState.scores[playerId] = (nextState.scores[playerId] || 0) + 100;
          }

          // Landing tile effect
          let finalPos = targetPos;
          const tile = COUPLE_RACE_TILES[targetPos] || COUPLE_RACE_TILES[0];
          let bonusPoints = tile.bonusPoints || 10;
          let powerAwarded: CoupleRacePowerType | null = null;
          let tileEffectDescription = tile.description;

          if (tile.type === "BOOST") {
            finalPos = (targetPos + (tile.stepOffset || 2)) % boardSize;
            bonusPoints += 25;
            tileEffectDescription = "Zephyr Boost: swept forward +2 tiles!";
          } else if (tile.type === "POWER_CACHE") {
            const powerList: CoupleRacePowerType[] = ["WIND_STRIDE", "DOUBLE_DICE", "HARMONY_LEAP", "SHIELD_AURA"];
            powerAwarded = secureRandomChoice(powerList);
            pState.powers = [...(pState.powers || []), powerAwarded];
            bonusPoints += 20;
            tileEffectDescription = `Scriptorium Vault: unlocked ${powerAwarded} card!`;
          } else if (tile.type === "HARMONY_SYNC") {
            const otherPid = nextSession.playerIds.find((p) => p !== playerId);
            const otherPos = otherPid && players[otherPid] ? players[otherPid].position : -99;
            const diff = Math.abs(finalPos - otherPos);
            if (diff <= 3 || diff >= boardSize - 3) {
              bonusPoints += 75;
              if (otherPid) {
                nextState.scores[otherPid] = (nextState.scores[otherPid] || 0) + 75;
              }
              nextState.data.cooperativeHarmonyScore = (Number(nextState.data.cooperativeHarmonyScore) || 0) + 100;
              tileEffectDescription = "Twin Fountains resonance: both players gain harmony bonus!";
            }
          } else if (tile.type === "CHALLENGE_GATE") {
            const diceVal = Number(nextState.data.currentDiceValue) || 4;
            if (diceVal < 4 && !pState.shieldActive) {
              finalPos = (targetPos - 1 + boardSize) % boardSize;
              tileEffectDescription = "Winds of Chance: roll under 4, stepped back 1 tile.";
            } else if (pState.shieldActive) {
              pState.shieldActive = false;
              tileEffectDescription = "Shield of Harmony absorbed the Winds of Chance!";
            }
          }

          pState.position = finalPos;
          nextState.scores[playerId] = (nextState.scores[playerId] || 0) + bonusPoints;
          players[playerId] = pState;
          nextState.data.players = players;
          nextState.data.hasMovedThisTurn = true;
          nextState.data.activePowerThisTurn = null;

          // Record in round history
          const history = Array.isArray(nextState.data.roundHistory) ? [...nextState.data.roundHistory] : [];
          history.push({
            turn: Number(nextState.data.turnNumber) || 1,
            playerId,
            action: "MOVE",
            diceValue: Number(nextState.data.currentDiceValue) || distance,
            fromPos: oldPos,
            toPos: finalPos,
            tileType: tile.type,
            pointsEarned: bonusPoints,
            powerUsed: powerAwarded || undefined,
            timestamp: serverTimestamp,
          });
          nextState.data.roundHistory = history;

          // Win condition: First to complete targetLaps (default 2)
          const targetLaps = Number(nextState.data.targetLaps) || 2;
          if (pState.lapsCompleted >= targetLaps) {
            nextState.status = "game_end";
            nextState.isFinished = true;
            nextState.winnerId = playerId;
            createdResult = this.finalizeGame(nextSession, nextState, serverTimestamp);
          }

          authoritativePayload = {
            moved: true,
            playerId,
            fromPos: oldPos,
            toPos: finalPos,
            tileType: tile.type,
            tileName: tile.name,
            tileEffectDescription,
            lapsCompleted: pState.lapsCompleted,
            completedLap,
            bonusPoints,
            powerAwarded,
            scores: { ...nextState.scores },
            isWinner: nextState.winnerId === playerId,
          };
        }
        break;
      }

      case "USE_POWER": {
        if (session.gameType === "couple_race") {
          if (nextState.turnPlayerId && nextState.turnPlayerId !== playerId) {
            authoritativePayload = { error: "NOT_YOUR_TURN" };
            break;
          }
          const rawPayload = (action.payload && typeof action.payload === "object" ? action.payload : {}) as Record<string, unknown>;
          const power = String(rawPayload.power || "") as CoupleRacePowerType;
          const players = (nextState.data.players || {}) as Record<string, CoupleRacePlayerState>;
          const pState = players[playerId];

          if (!pState || !pState.powers || !pState.powers.includes(power)) {
            authoritativePayload = { error: "POWER_NOT_OWNED", power };
            break;
          }

          // Remove power from inventory
          const powerIdx = pState.powers.indexOf(power);
          pState.powers.splice(powerIdx, 1);

          let effectMessage = "";
          if (power === "HARMONY_LEAP") {
            const otherPid = nextSession.playerIds.find((p) => p !== playerId);
            if (otherPid && players[otherPid]) {
              const partnerPos = players[otherPid].position;
              pState.position = partnerPos;
              nextState.data.hasMovedThisTurn = true;
              nextState.scores[playerId] = (nextState.scores[playerId] || 0) + 50;
              nextState.data.cooperativeHarmonyScore = (Number(nextState.data.cooperativeHarmonyScore) || 0) + 50;
              effectMessage = "Harmony Leap: synchronized directly with partner!";
            }
          } else if (power === "SHIELD_AURA") {
            pState.shieldActive = true;
            effectMessage = "Shield of Harmony active: protected against hazards!";
          } else if (power === "WIND_STRIDE") {
            nextState.data.activePowerThisTurn = "WIND_STRIDE";
            effectMessage = "Wind Stride prepared: +2 movement tiles on next roll!";
          } else if (power === "DOUBLE_DICE") {
            nextState.data.activePowerThisTurn = "DOUBLE_DICE";
            effectMessage = "Double Stride prepared: two dice will be rolled!";
          }

          players[playerId] = pState;
          nextState.data.players = players;

          authoritativePayload = {
            powerUsed: power,
            playerId,
            remainingPowers: [...pState.powers],
            effectMessage,
          };
        }
        break;
      }

      case "END_TURN": {
        if (session.gameType === "couple_race") {
          if (nextState.turnPlayerId && nextState.turnPlayerId !== playerId) {
            authoritativePayload = { error: "NOT_YOUR_TURN" };
            break;
          }

          const otherPlayer = nextSession.playerIds.find((id) => id !== playerId) || playerId;
          nextState.turnPlayerId = otherPlayer;
          nextState.data.currentTurnPlayerId = otherPlayer;
          nextState.data.hasRolledThisTurn = false;
          nextState.data.hasMovedThisTurn = false;
          nextState.data.currentDiceValue = null;
          nextState.data.secondDiceValue = null;
          nextState.data.validMovePositions = [];
          nextState.data.activePowerThisTurn = null;
          nextState.data.turnNumber = (Number(nextState.data.turnNumber) || 1) + 1;
          nextState.roundDeadlineServer = serverTimestamp + 45000;

          authoritativePayload = {
            turnEnded: true,
            nextTurnPlayerId: otherPlayer,
            turnNumber: nextState.data.turnNumber,
          };
        }
        break;
      }

      case "PAUSE_GAME": {
        nextState.data.isPaused = true;
        nextState.data.pausedByPlayerId = playerId;
        nextState.data.pauseRemainingMs = Math.max(0, nextState.roundDeadlineServer - serverTimestamp);
        authoritativePayload = {
          isPaused: true,
          pausedByPlayerId: playerId,
        };
        break;
      }

      case "RESUME_GAME": {
        nextState.data.isPaused = false;
        nextState.data.pausedByPlayerId = null;
        const remainingMs = Number(nextState.data.pauseRemainingMs) || 30000;
        nextState.roundDeadlineServer = serverTimestamp + remainingMs;
        authoritativePayload = {
          isPaused: false,
        };
        break;
      }

      case "PLAYER_DISCONNECT": {
        const players = (nextState.data.players || {}) as Record<string, CoupleRacePlayerState>;
        if (players[playerId]) {
          players[playerId].connectionStatus = "disconnected";
          players[playerId].disconnectedAt = serverTimestamp;
        }
        nextState.data.players = players;
        authoritativePayload = {
          connectionStatus: "disconnected",
          playerId,
          serverTimestamp,
        };
        break;
      }

      case "PLAYER_RECONNECT": {
        const players = (nextState.data.players || {}) as Record<string, CoupleRacePlayerState>;
        if (players[playerId]) {
          players[playerId].connectionStatus = "connected";
          players[playerId].disconnectedAt = null;
        }
        nextState.data.players = players;
        authoritativePayload = {
          connectionStatus: "connected",
          playerId,
          serverTimestamp,
        };
        break;
      }

      case "SELECT_CELL":
      case "SUBMIT_ANSWER": {
        const rawPayload = (action.payload && typeof action.payload === "object" ? action.payload : {}) as Record<string, unknown>;
        const choice = String(rawPayload.cellId || rawPayload.choice || "");
        const serverTarget = String(
          currentPrivateState?.targetId ||
          nextState.data.targetId ||
          nextState.data.targetAnswer ||
          "CORRECT_ANSWER"
        );
        const serverTargetName = String(
          currentPrivateState?.targetName ||
          nextState.data.targetName ||
          "Antique Artifact"
        );

        // If private state was not previously initialized (e.g. seeded state), migrate to private state
        if (!updatedPrivateState && (nextState.data.targetId || nextState.data.targetAnswer)) {
          updatedPrivateState = {
            gameId: session.gameId,
            targetId: serverTarget,
            targetName: serverTargetName,
            targetCode: String(nextState.data.targetCode || ""),
            targetClue: String(nextState.data.targetClue || ""),
            usedTargetIds: Array.isArray(nextState.data.usedTargetIds)
              ? (nextState.data.usedTargetIds as string[])
              : [serverTarget],
          };
        }

        // If this round already has a recorded winner, ignore redundant clicks
        if (nextState.data.roundWinnerId) {
          authoritativePayload = {
            alreadyResolved: true,
            roundWinnerId: nextState.data.roundWinnerId,
            scores: { ...nextState.scores },
          };
          break;
        }

        // Security Hardening: Client cannot cheat with isCorrectMock; server target evaluation is strictly authoritative
        const isCorrect = choice === serverTarget;

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
            targetName: serverTargetName,
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

          delete nextState.data.targetId;
          delete nextState.data.targetName;
          delete nextState.data.targetCode;
          delete nextState.data.targetAnswer;
          delete nextState.data.usedTargetIds;

          authoritativePayload = {
            isCorrect: true,
            cellId: choice,
            roundWinnerId: playerId,
            pointsAwarded,
            speedBonus,
            scores: { ...nextState.scores },
            currentRound: nextState.currentRound,
            isFinished: nextState.isFinished,
            targetName: serverTargetName,
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

          delete nextState.data.targetId;
          delete nextState.data.targetName;
          delete nextState.data.targetCode;
          delete nextState.data.targetAnswer;
          delete nextState.data.usedTargetIds;

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
        if (currentState.isFinished || currentState.status === "game_end") {
          throw new ActionValidationError(
            "GAME_NOT_ACTIVE",
            `Game is not active: Game '${session.gameId}' has already concluded with status '${currentState.status}'.`,
            409
          );
        }

        if (session.gameType === "couple_race") {
          throw new ActionValidationError(
            "ACTION_DISALLOWED_FOR_STATE",
            "Action 'NEXT_ROUND' is not supported for turn-based game 'couple_race'. Use 'END_TURN' to advance turns.",
            400
          );
        }

        if (nextState.turnPlayerId && nextState.turnPlayerId !== playerId) {
          throw new ActionValidationError(
            "NOT_PLAYER_TURN",
            `Action 'NEXT_ROUND' cannot be executed: it is player '${nextState.turnPlayerId}'s turn, not '${playerId}'.`,
            400
          );
        }

        // Authoritative State Machine Invariant:
        // A round may advance ONLY when:
        // 1. The round has been legitimately resolved on the server, OR
        // 2. The authoritative server deadline has expired.
        // Do NOT allow a client action alone to declare the round resolved.
        let isRoundResolved = false;
        if (currentState.status === "round_end") {
          isRoundResolved = true;
        } else if (session.gameType === "find_it_first") {
          isRoundResolved =
            nextState.data?.roundWinnerId != null ||
            nextState.data?.roundWinningCell != null ||
            nextState.data?.roundStage === "round_result";
        } else if (session.gameType === "speed_duel") {
          isRoundResolved =
            nextState.data?.roundStage === "round_result" ||
            nextState.data?.roundWinnerId != null ||
            nextState.data?.falseStartPlayerId != null;
        } else if (session.gameType === "camera_challenge") {
          isRoundResolved =
            nextState.data?.stage === "result" ||
            nextState.data?.isGameEnd === true;
        } else {
          isRoundResolved = nextState.data?.roundWinnerId != null;
        }

        const isDeadlineExpired =
          (typeof nextState.roundDeadlineServer === "number" &&
            nextState.roundDeadlineServer > 0 &&
            serverTimestamp >= nextState.roundDeadlineServer) ||
          (typeof nextState.data?.stageDeadlineServer === "number" &&
            nextState.data.stageDeadlineServer > 0 &&
            serverTimestamp >= nextState.data.stageDeadlineServer);

        if (!isRoundResolved && !isDeadlineExpired) {
          throw new ActionValidationError(
            "ACTION_DISALLOWED_FOR_STATE",
            `Cannot advance round: active round in '${session.gameType}' has not been resolved and server deadline has not expired.`,
            400
          );
        }

        if (session.gameType === "speed_duel") {
          const history = Array.isArray(nextState.data.roundHistory) ? nextState.data.roundHistory : [];
          const alexWins = history.filter((r) => r.winnerId === nextSession.playerIds[0]).length;
          const samWins = history.filter((r) => r.winnerId === nextSession.playerIds[1]).length;
          const isFirstTo3 = nextState.data.competitiveMode !== "standard_5";

          if ((isFirstTo3 && (alexWins >= 3 || samWins >= 3)) || nextState.currentRound >= nextState.maxRounds) {
            createdResult = this.finalizeGame(nextSession, nextState, serverTimestamp);
            nextState.status = "game_end";
            nextState.data.roundStage = "game_end";
            authoritativePayload = { gameEnded: true, winnerId: nextState.winnerId };
            break;
          }

          nextState.currentRound += 1;
          const tensionDelayMs = secureRandomInt(1800, 4199);
          const targetAppearedAtServer = serverTimestamp + tensionDelayMs;
          nextState.roundStartedAtServer = serverTimestamp;
          nextState.roundDeadlineServer = targetAppearedAtServer + 6000;
          nextState.status = "playing";

          nextState.data = {
            ...nextState.data,
            roundStage: "tension",
            tensionStartedAtServer: serverTimestamp,
            tensionDelayMs,
            targetAppearedAtServer,
            roundWinnerId: null,
            roundWinnerReactionMs: null,
            roundWinnerReason: null,
            playerReactions: {},
            falseStarts: {},
            lastMistake: null,
          };

          authoritativePayload = {
            round: nextState.currentRound,
            tensionDelayMs,
            targetAppearedAtServer,
            roundDeadlineServer: nextState.roundDeadlineServer,
          };
          break;
        }

        if (nextState.currentRound >= nextState.maxRounds) {
          createdResult = this.finalizeGame(nextSession, nextState, serverTimestamp);
          nextState.status = "game_end";
          authoritativePayload = { gameEnded: true, winnerId: nextState.winnerId };
          break;
        }

        nextState.currentRound += 1;
        const usedIds = Array.isArray(updatedPrivateState?.usedTargetIds)
          ? (updatedPrivateState.usedTargetIds as string[])
          : Array.isArray(nextState.data.usedTargetIds)
          ? (nextState.data.usedTargetIds as string[])
          : [];
        const roundGen = this.generateAuthoritativeRound(nextState.currentRound, usedIds);

        updatedPrivateState = {
          gameId: session.gameId,
          targetId: roundGen.targetId,
          targetName: roundGen.target.name,
          targetCode: roundGen.target.code,
          targetClue: roundGen.target.clue,
          usedTargetIds: [...usedIds, roundGen.targetId],
        };

        nextState.data.targetClue = roundGen.target.clue;
        nextState.data.board = roundGen.board;
        nextState.data.roundWinnerId = null;
        nextState.data.roundWinningCell = null;
        nextState.data.lastMistake = null;
        nextState.data.roundStage = "playing";
        delete nextState.data.targetId;
        delete nextState.data.targetName;
        delete nextState.data.targetCode;
        delete nextState.data.usedTargetIds;

        nextState.status = "playing";
        nextState.roundStartedAtServer = serverTimestamp;
        nextState.roundDeadlineServer = serverTimestamp + 15000;

        authoritativePayload = {
          round: nextState.currentRound,
          targetClue: roundGen.target.clue,
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

        if (session.gameType === "speed_duel") {
          const tensionDelayMs = secureRandomInt(1800, 4199);
          const targetAppearedAtServer = serverTimestamp + tensionDelayMs;
          nextState.roundStartedAtServer = serverTimestamp;
          nextState.roundDeadlineServer = targetAppearedAtServer + 6000;

          nextState.data = {
            ...nextState.data,
            gameType: "speed_duel",
            roundStage: "tension",
            tensionStartedAtServer: serverTimestamp,
            tensionDelayMs,
            targetAppearedAtServer,
            roundWinnerId: null,
            roundWinnerReactionMs: null,
            roundWinnerReason: null,
            playerReactions: {},
            falseStarts: {},
            roundHistory: [],
          };

          authoritativePayload = {
            rematchStarted: true,
            round: 1,
            gameType: "speed_duel",
            tensionDelayMs,
            targetAppearedAtServer,
            roundDeadlineServer: nextState.roundDeadlineServer,
          };
          break;
        }

        if (session.gameType === "couple_race") {
          const players: Record<string, CoupleRacePlayerState> = {};
          for (const pid of nextSession.playerIds) {
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

          nextState.turnPlayerId = nextSession.playerIds[0] || playerId;
          nextState.roundDeadlineServer = serverTimestamp + 45000;
          nextState.status = "playing";
          nextState.isFinished = false;
          nextState.winnerId = null;
          nextState.currentRound = 1;
          nextState.maxRounds = 10;
          nextState.scores = Object.fromEntries(nextSession.playerIds.map((pid) => [pid, 0]));

          nextState.data = {
            gameType: "couple_race",
            mode: "competitive",
            boardSize: 24,
            targetLaps: 2,
            players,
            currentTurnPlayerId: nextState.turnPlayerId,
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

          authoritativePayload = {
            rematchStarted: true,
            gameType: "couple_race",
            turnPlayerId: nextState.turnPlayerId,
          };
          break;
        }

        if (session.gameType === "camera_challenge") {
          const firstPrompt = secureRandomChoice(CAMERA_CHALLENGES);
          nextState.currentRound = 1;
          nextState.maxRounds = 5;
          nextState.status = "playing";
          nextState.isFinished = false;
          nextState.winnerId = null;
          nextState.scores = Object.fromEntries(nextSession.playerIds.map((pid) => [pid, 0]));

          nextSession.status = "playing";
          nextSession.winnerId = null;
          nextSession.startedAt = new Date(serverTimestamp).toISOString();
          delete nextSession.endedAt;

          nextState.data = {
            gameType: "camera_challenge",
            stage: "challenge",
            currentPromptIndex: CAMERA_CHALLENGES.findIndex((c) => c.id === firstPrompt.id),
            currentPrompt: firstPrompt,
            submissions: {},
            stageStartedAtServer: serverTimestamp,
            stageDeadlineServer: serverTimestamp + 60000,
            roundHistory: [],
            skips: {},
            isGameEnd: false,
          };

          authoritativePayload = {
            rematchStarted: true,
            round: 1,
            gameType: "camera_challenge",
            stage: "challenge",
            prompt: firstPrompt,
          };
          break;
        }

        const roundGen = this.generateAuthoritativeRound(1, []);
        updatedPrivateState = {
          gameId: session.gameId,
          targetId: roundGen.targetId,
          targetName: roundGen.target.name,
          targetCode: roundGen.target.code,
          targetClue: roundGen.target.clue,
          usedTargetIds: [roundGen.targetId],
        };

        nextState.data = {
          targetClue: roundGen.target.clue,
          board: roundGen.board,
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
          targetClue: roundGen.target.clue,
          board: roundGen.board,
          roundDeadlineServer: nextState.roundDeadlineServer,
        };
        break;
      }

      case "TRIGGER_TARGET": {
        if (session.gameType === "speed_duel") {
          const targetTime = Number(nextState.data.targetAppearedAtServer) || 0;
          if (serverTimestamp >= targetTime - 120) {
            nextState.data.roundStage = "active";
            authoritativePayload = {
              targetActive: true,
              targetAppearedAtServer: targetTime,
              roundStage: "active",
            };
          } else {
            authoritativePayload = {
              targetActive: false,
              reason: "Tension window not elapsed on server",
            };
          }
        }
        break;
      }

      case "SUBMIT_REACTION": {
        if (session.gameType === "speed_duel") {
          const targetTime = Number(nextState.data.targetAppearedAtServer) || 0;
          const currentStage = String(nextState.data.roundStage || "tension");

          // Check if this round already has a recorded winner (second player's reaction arrives)
          if (nextState.data.roundWinnerId) {
            const reactionTimeMs = targetTime > 0 ? Math.max(1, serverTimestamp - targetTime) : 0;
            const reactions = (nextState.data.playerReactions as Record<string, number>) || {};
            reactions[playerId] = reactionTimeMs;
            nextState.data.playerReactions = reactions;

            const winnerReaction = Number(nextState.data.roundWinnerReactionMs) || 0;
            const deltaMs = winnerReaction > 0 ? reactionTimeMs - winnerReaction : 0;

            authoritativePayload = {
              alreadyResolved: true,
              roundWinnerId: nextState.data.roundWinnerId,
              yourReactionMs: reactionTimeMs,
              deltaMs,
              scores: { ...nextState.scores },
            };
            break;
          }

          // Case 1: FALSE START (Reaction arrived before targetAppearedAtServer or during tension)
          if (serverTimestamp < targetTime || currentStage === "tension") {
            const falseStarts = (nextState.data.falseStarts as Record<string, number>) || {};
            falseStarts[playerId] = serverTimestamp;
            nextState.data.falseStarts = falseStarts;

            const opponentId = nextSession.playerIds.find((id) => id !== playerId) || "user_sam";
            nextState.data.roundWinnerId = opponentId;
            nextState.data.roundWinnerReactionMs = null;
            nextState.data.roundWinnerReason = "opponent_false_start";
            nextState.data.falseStartPlayerId = playerId;
            nextState.data.roundStage = "round_result";
            nextState.status = "round_end";

            const pointsAwarded = 100;
            nextState.scores[opponentId] = (nextState.scores[opponentId] || 0) + pointsAwarded;

            const roundHistory = Array.isArray(nextState.data.roundHistory)
              ? [...(nextState.data.roundHistory as Array<Record<string, unknown>>)]
              : [];
            roundHistory.push({
              round: nextState.currentRound,
              winnerId: opponentId,
              isFalseStart: true,
              falseStartPlayerId: playerId,
              pointsAwarded,
              scoresAtEnd: { ...nextState.scores },
              serverTimestamp,
            });
            nextState.data.roundHistory = roundHistory;

            // Check competitive completion
            const p1Wins = roundHistory.filter((r) => r.winnerId === nextSession.playerIds[0]).length;
            const p2Wins = roundHistory.filter((r) => r.winnerId === nextSession.playerIds[1]).length;
            const isFirstTo3 = nextState.data.competitiveMode !== "standard_5";

            if ((isFirstTo3 && (p1Wins >= 3 || p2Wins >= 3)) || nextState.currentRound >= nextState.maxRounds) {
              createdResult = this.finalizeGame(nextSession, nextState, serverTimestamp);
              nextState.status = "game_end";
              nextState.data.roundStage = "game_end";
            }

            authoritativePayload = {
              isFalseStart: true,
              falseStartPlayerId: playerId,
              roundWinnerId: opponentId,
              pointsAwarded,
              scores: { ...nextState.scores },
              currentRound: nextState.currentRound,
              isFinished: nextState.isFinished,
            };
            break;
          }

          // Case 2: FIRST VALID REACTION (Server determines accepted action ordering)
          nextState.data.roundStage = "round_result";
          nextState.status = "round_end";

          const reactionTimeMs = Math.max(1, serverTimestamp - targetTime);
          const reactions = (nextState.data.playerReactions as Record<string, number>) || {};
          reactions[playerId] = reactionTimeMs;
          nextState.data.playerReactions = reactions;

          // Speed bonus: faster reactions earn higher bonus points
          const speedBonus = Math.max(0, Math.min(250, Math.floor((1000 - reactionTimeMs) / 3)));
          const pointsAwarded = 100 + speedBonus;

          nextState.scores[playerId] = (nextState.scores[playerId] || 0) + pointsAwarded;
          nextState.data.roundWinnerId = playerId;
          nextState.data.roundWinnerReactionMs = reactionTimeMs;
          nextState.data.roundWinnerReason = "fastest_reaction";
          nextState.data.pointsAwarded = pointsAwarded;
          nextState.data.speedBonus = speedBonus;

          const roundHistory = Array.isArray(nextState.data.roundHistory)
            ? [...(nextState.data.roundHistory as Array<Record<string, unknown>>)]
            : [];
          roundHistory.push({
            round: nextState.currentRound,
            winnerId: playerId,
            reactionMs: reactionTimeMs,
            pointsAwarded,
            speedBonus,
            scoresAtEnd: { ...nextState.scores },
            serverTimestamp,
          });
          nextState.data.roundHistory = roundHistory;

          // Check match completion
          const p1Wins = roundHistory.filter((r) => r.winnerId === nextSession.playerIds[0]).length;
          const p2Wins = roundHistory.filter((r) => r.winnerId === nextSession.playerIds[1]).length;
          const isFirstTo3 = nextState.data.competitiveMode !== "standard_5";

          if ((isFirstTo3 && (p1Wins >= 3 || p2Wins >= 3)) || nextState.currentRound >= nextState.maxRounds) {
            createdResult = this.finalizeGame(nextSession, nextState, serverTimestamp);
            nextState.status = "game_end";
            nextState.data.roundStage = "game_end";
          }

          authoritativePayload = {
            isWinner: true,
            roundWinnerId: playerId,
            reactionTimeMs,
            pointsAwarded,
            speedBonus,
            scores: { ...nextState.scores },
            currentRound: nextState.currentRound,
            isFinished: nextState.isFinished,
          };
          break;
        }

        // Generic fallback reaction logic for other games
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

      case "START_COUNTDOWN": {
        if (session.gameType === "camera_challenge") {
          const countdownDurationMs = 3000;
          nextState.data.stage = "countdown";
          nextState.data.stageStartedAtServer = serverTimestamp;
          nextState.data.stageDeadlineServer = serverTimestamp + countdownDurationMs;
          nextState.data.submissions = {};

          authoritativePayload = {
            stage: "countdown",
            countdownSeconds: 3,
            stageDeadlineServer: nextState.data.stageDeadlineServer,
          };
        }
        break;
      }

      case "START_PERFORM": {
        if (session.gameType === "camera_challenge") {
          const currentPrompt = (nextState.data.currentPrompt as CameraChallengePrompt) || CAMERA_CHALLENGES[0];
          const durationSeconds = currentPrompt.durationSeconds || 20;
          const durationMs = durationSeconds * 1000;

          nextState.data.stage = "perform";
          nextState.data.stageStartedAtServer = serverTimestamp;
          nextState.data.stageDeadlineServer = serverTimestamp + durationMs;
          nextState.data.submissions = {};

          authoritativePayload = {
            stage: "perform",
            durationSeconds,
            stageDeadlineServer: nextState.data.stageDeadlineServer,
          };
        }
        break;
      }

      case "SUBMIT_CAMERA_CHALLENGE": {
        if (session.gameType === "camera_challenge") {
          // Check expired challenge
          const isExpired =
            (typeof nextState.data?.stageDeadlineServer === "number" &&
              nextState.data.stageDeadlineServer > 0 &&
              serverTimestamp > nextState.data.stageDeadlineServer) ||
            (typeof nextState.roundDeadlineServer === "number" &&
              nextState.roundDeadlineServer > 0 &&
              serverTimestamp > nextState.roundDeadlineServer);
          if (isExpired) {
            throw new ActionValidationError(
              "ACTION_DISALLOWED_FOR_STATE",
              "Cannot submit camera challenge: challenge deadline has expired on the server.",
              400
            );
          }

          const rawPayload = (action.payload && typeof action.payload === "object" ? action.payload : {}) as Record<string, unknown>;
          const subs = (nextState.data.submissions as Record<string, CameraChallengeSubmission>) || {};

          // Idempotent duplicate: if player already submitted, preserve submission
          if (subs[playerId]?.ready) {
            authoritativePayload = {
              idempotentDuplicate: true,
              playerSubmitted: playerId,
              stage: nextState.data.stage || "submit",
              submissions: subs,
            };
            break;
          }

          subs[playerId] = {
            submittedAt: serverTimestamp,
            ready: true,
            mediaRef: typeof rawPayload.mediaRef === "string" ? rawPayload.mediaRef : undefined,
            captureMeta: rawPayload.captureMeta && typeof rawPayload.captureMeta === "object" ? (rawPayload.captureMeta as Record<string, unknown>) : undefined,
          };
          nextState.data.submissions = subs;

          const allPlayersSubmitted = nextSession.playerIds.every((pid) => subs[pid]?.ready);

          if (allPlayersSubmitted && nextSession.playerIds.length > 1) {
            // Both players submitted -> transition to partner_review stage
            nextState.data.stage = "partner_review";
            nextState.data.stageStartedAtServer = serverTimestamp;
            nextState.data.stageDeadlineServer = serverTimestamp + 60000;
            nextState.data.reviews = {};

            authoritativePayload = {
              allSubmitted: true,
              stage: "partner_review",
              readyForReview: true,
              submissions: subs,
            };
          } else if (allPlayersSubmitted && nextSession.playerIds.length <= 1) {
            // Solo/Single-player test mode: auto-resolve
            const points = 100;
            nextState.scores[playerId] = (nextState.scores[playerId] || 0) + points;
            nextState.data.stage = "result";
            nextState.status = "round_end";
            nextState.data.resolution = {
              status: "approved",
              allApproved: true,
              approvedPlayerIds: [playerId],
              rejectedPlayerIds: [],
              scoresAwarded: { [playerId]: points },
              resolvedAt: serverTimestamp,
              round: nextState.currentRound,
            };

            const history = Array.isArray(nextState.data.roundHistory) ? [...nextState.data.roundHistory] : [];
            const currentPrompt = nextState.data.currentPrompt as CameraChallengePrompt;
            history.push({
              round: nextState.currentRound,
              promptId: currentPrompt?.id || "prompt",
              promptTitle: currentPrompt?.title || "Challenge",
              completedPlayerIds: [playerId],
              resolution: nextState.data.resolution,
              serverTimestamp,
            });
            nextState.data.roundHistory = history;

            if (nextState.currentRound >= nextState.maxRounds) {
              createdResult = this.finalizeGame(nextSession, nextState, serverTimestamp);
              nextState.status = "game_end";
              nextState.data.stage = "result";
              nextState.data.isGameEnd = true;
            }

            authoritativePayload = {
              allSubmitted: true,
              stage: "result",
              scores: { ...nextState.scores },
              pointsAwarded: points,
              currentRound: nextState.currentRound,
              isFinished: nextState.isFinished,
            };
          } else {
            nextState.data.stage = "submit";
            authoritativePayload = {
              playerSubmitted: playerId,
              stage: "submit",
              waitingForPartner: true,
            };
          }
        }
        break;
      }

      case "APPROVE_CHALLENGE":
      case "REJECT_CHALLENGE":
      case "REVIEW_CHALLENGE": {
        if (session.gameType === "camera_challenge") {
          const rawPayload = (action.payload && typeof action.payload === "object" ? action.payload : {}) as Record<string, unknown>;
          const subs = (nextState.data.submissions as Record<string, CameraChallengeSubmission>) || {};

          // Invariant: Player cannot approve their own submission
          const targetPlayerId = String(
            rawPayload.targetPlayerId ||
            nextSession.playerIds.find((pid) => pid !== playerId) ||
            ""
          );

          if (!targetPlayerId || targetPlayerId === playerId) {
            throw new ActionValidationError(
              "UNAUTHORIZED_ACTION",
              "Client cannot approve or review its own submission. Only the partner may review.",
              403
            );
          }

          // Target must be a participant in the session
          if (!nextSession.playerIds.includes(targetPlayerId)) {
            throw new ActionValidationError(
              "INVALID_ACTION_PAYLOAD",
              `Target player '${targetPlayerId}' is not a participant in this game session.`,
              400
            );
          }

          // Target must have submitted their challenge
          if (!subs[targetPlayerId]?.ready) {
            throw new ActionValidationError(
              "ACTION_DISALLOWED_FOR_STATE",
              `Cannot review partner '${targetPlayerId}' before they have submitted their challenge.`,
              400
            );
          }

          // Check deadline for review
          const isReviewExpired =
            typeof nextState.data?.stageDeadlineServer === "number" &&
            nextState.data.stageDeadlineServer > 0 &&
            serverTimestamp > nextState.data.stageDeadlineServer;
          if (isReviewExpired) {
            throw new ActionValidationError(
              "ACTION_DISALLOWED_FOR_STATE",
              "Cannot submit review: partner review deadline has expired on the server.",
              400
            );
          }

          const isApproved =
            action.type === "APPROVE_CHALLENGE"
              ? true
              : action.type === "REJECT_CHALLENGE"
              ? false
              : Boolean(rawPayload.approved ?? (rawPayload.decision === "approve"));

          const decision: "approve" | "reject" = isApproved ? "approve" : "reject";
          const feedback = typeof rawPayload.feedback === "string"
            ? rawPayload.feedback
            : typeof rawPayload.reason === "string"
            ? rawPayload.reason
            : "";

          const reviews = (nextState.data.reviews as Record<string, CameraChallengeReview>) || {};

          // Idempotent review: if reviewer already recorded identical decision, preserve without duplication
          if (reviews[playerId] && reviews[playerId].decision === decision) {
            authoritativePayload = {
              idempotentDuplicate: true,
              reviewerId: playerId,
              targetPlayerId,
              decision,
              stage: nextState.data.stage,
            };
            break;
          }

          reviews[playerId] = {
            reviewerId: playerId,
            targetPlayerId,
            decision,
            approved: isApproved,
            reviewedAt: serverTimestamp,
            feedback,
          };
          nextState.data.reviews = reviews;

          // Check if all expected partner reviews are completed
          const expectedReviewers = nextSession.playerIds.filter((pid) => pid !== "AI");
          const allReviewsComplete = expectedReviewers.every((pid) => Boolean(reviews[pid]));

          if (allReviewsComplete) {
            // Deterministic scoring controlled authoritatively on the server
            const approvedPlayerIds: string[] = [];
            const rejectedPlayerIds: string[] = [];
            const scoresAwarded: Record<string, number> = {};

            for (const pid of nextSession.playerIds) {
              scoresAwarded[pid] = 0;
            }

            for (const reviewerId of Object.keys(reviews)) {
              const rev = reviews[reviewerId];
              if (rev.approved) {
                approvedPlayerIds.push(rev.targetPlayerId);
              } else {
                rejectedPlayerIds.push(rev.targetPlayerId);
              }
            }

            const allApproved = approvedPlayerIds.length === nextSession.playerIds.length;
            const noneApproved = approvedPlayerIds.length === 0;

            if (allApproved) {
              // Mutual synergy: 100 points to both partners
              for (const pid of nextSession.playerIds) {
                scoresAwarded[pid] = 100;
                nextState.scores[pid] = (nextState.scores[pid] || 0) + 100;
              }
            } else if (!noneApproved) {
              // Partial synergy: 50 points to approved participants
              for (const pid of approvedPlayerIds) {
                scoresAwarded[pid] = 50;
                nextState.scores[pid] = (nextState.scores[pid] || 0) + 50;
              }
              for (const pid of rejectedPlayerIds) {
                scoresAwarded[pid] = 0;
              }
            }

            const resolution: CameraChallengeResolution = {
              status: allApproved ? "approved" : noneApproved ? "rejected" : "partial",
              allApproved,
              approvedPlayerIds,
              rejectedPlayerIds,
              scoresAwarded,
              resolvedAt: serverTimestamp,
              round: nextState.currentRound,
            };

            nextState.data.stage = "result";
            nextState.status = "round_end";
            nextState.data.resolution = resolution;

            const history = Array.isArray(nextState.data.roundHistory) ? [...nextState.data.roundHistory] : [];
            const currentPrompt = nextState.data.currentPrompt as CameraChallengePrompt;
            history.push({
              round: nextState.currentRound,
              promptId: currentPrompt?.id || "prompt",
              promptTitle: currentPrompt?.title || "Challenge",
              completedPlayerIds: approvedPlayerIds,
              reviews,
              resolution,
              serverTimestamp,
            });
            nextState.data.roundHistory = history;

            if (nextState.currentRound >= nextState.maxRounds) {
              createdResult = this.finalizeGame(nextSession, nextState, serverTimestamp);
              nextState.status = "game_end";
              nextState.data.stage = "result";
              nextState.data.isGameEnd = true;
            }

            authoritativePayload = {
              allReviewed: true,
              stage: "result",
              resolution,
              scores: { ...nextState.scores },
              scoresAwarded,
              currentRound: nextState.currentRound,
              isFinished: nextState.isFinished,
            };
          } else {
            authoritativePayload = {
              stage: "partner_review",
              reviewerId: playerId,
              decision,
              waitingForPartnerReview: true,
            };
          }
        }
        break;
      }

      case "SKIP_CHALLENGE": {
        if (session.gameType === "camera_challenge") {
          const currentIndex = Number(nextState.data.currentPromptIndex) || 0;
          const nextIndex = (currentIndex + 1) % CAMERA_CHALLENGES.length;
          const nextPrompt = CAMERA_CHALLENGES[nextIndex];

          nextState.data.currentPromptIndex = nextIndex;
          nextState.data.currentPrompt = nextPrompt;
          nextState.data.stage = "challenge";
          nextState.data.submissions = {};
          nextState.data.stageStartedAtServer = serverTimestamp;
          nextState.data.stageDeadlineServer = serverTimestamp + 60000;

          const history = Array.isArray(nextState.data.roundHistory) ? [...nextState.data.roundHistory] : [];
          history.push({
            round: nextState.currentRound,
            promptId: nextPrompt.id,
            promptTitle: nextPrompt.title,
            completedPlayerIds: [],
            skipped: true,
            serverTimestamp,
          });
          nextState.data.roundHistory = history;

          authoritativePayload = {
            skipped: true,
            stage: "challenge",
            prompt: nextPrompt,
            currentRound: nextState.currentRound,
          };
        }
        break;
      }

      case "NEXT_CHALLENGE": {
        if (session.gameType === "camera_challenge") {
          if (currentState.isFinished || currentState.status === "game_end") {
            throw new ActionValidationError(
              "GAME_NOT_ACTIVE",
              `Game is not active: Game '${session.gameId}' has already concluded with status '${currentState.status}'.`,
              409
            );
          }

          if (nextState.turnPlayerId && nextState.turnPlayerId !== playerId) {
            throw new ActionValidationError(
              "NOT_PLAYER_TURN",
              `Action 'NEXT_CHALLENGE' cannot be executed: it is player '${nextState.turnPlayerId}'s turn, not '${playerId}'.`,
              400
            );
          }

          const isResolved =
            currentState.status === "round_end" ||
            nextState.data?.stage === "result" ||
            nextState.data?.isGameEnd === true;

          const isDeadlineExpired =
            (typeof nextState.data?.stageDeadlineServer === "number" &&
              nextState.data.stageDeadlineServer > 0 &&
              serverTimestamp >= nextState.data.stageDeadlineServer) ||
            (typeof nextState.roundDeadlineServer === "number" &&
              nextState.roundDeadlineServer > 0 &&
              serverTimestamp >= nextState.roundDeadlineServer);

          if (!isResolved && !isDeadlineExpired) {
            throw new ActionValidationError(
              "ACTION_DISALLOWED_FOR_STATE",
              `Cannot advance challenge: active Camera Challenge has not been resolved and deadline has not expired.`,
              400
            );
          }

          if (nextState.currentRound >= nextState.maxRounds) {
            createdResult = this.finalizeGame(nextSession, nextState, serverTimestamp);
            nextState.status = "game_end";
            nextState.data.stage = "result";
            nextState.data.isGameEnd = true;
            authoritativePayload = { gameEnded: true, winnerId: nextState.winnerId };
            break;
          }

          nextState.currentRound += 1;
          const currentIndex = Number(nextState.data.currentPromptIndex) || 0;
          const nextIndex = (currentIndex + 1) % CAMERA_CHALLENGES.length;
          const nextPrompt = CAMERA_CHALLENGES[nextIndex];

          nextState.data.currentPromptIndex = nextIndex;
          nextState.data.currentPrompt = nextPrompt;
          nextState.data.stage = "challenge";
          nextState.data.submissions = {};
          nextState.data.reviews = {};
          delete nextState.data.resolution;
          nextState.status = "playing";
          nextState.roundStartedAtServer = serverTimestamp;
          nextState.roundDeadlineServer = serverTimestamp + 60000;
          nextState.data.stageStartedAtServer = serverTimestamp;
          nextState.data.stageDeadlineServer = serverTimestamp + 60000;

          authoritativePayload = {
            round: nextState.currentRound,
            stage: "challenge",
            prompt: nextPrompt,
          };
        }
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
    const allActionIds = Object.keys(nextState.processedActionIds);
    if (allActionIds.length > MAX_BOUNDED_PROCESSED_ACTIONS) {
      allActionIds
        .sort((a, b) => (nextState.processedActionIds[b] || 0) - (nextState.processedActionIds[a] || 0))
        .slice(MAX_BOUNDED_PROCESSED_ACTIONS)
        .forEach((id) => {
          delete nextState.processedActionIds[id];
        });
    }

    nextState.lastProcessedAction = {
      clientActionId: action.clientActionId,
      type: action.type,
      playerId,
      serverTimestamp,
    };

    // Produce client-safe PublicGameState via formal contract
    const sanitizedPublicState = getPublicState({
      state: nextState,
      privateState: updatedPrivateState,
    });

    return {
      updatedState: sanitizedPublicState,
      updatedSession: nextSession,
      gameResult: createdResult,
      authoritativePayload,
      updatedPrivateState,
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

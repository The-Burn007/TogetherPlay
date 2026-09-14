import type {
  FindItFirstState,
  GameAction,
} from "@/types/domain";
import type { GameDefinition, ValidationResult } from "./core";

type FindItAction = GameAction<{
  cellId?: string;
}>;

interface FindItResult {
  scores: Record<string, number>;
  winnerId?: string;
  rounds: number;
}

export const findItFirst: GameDefinition<
  FindItFirstState,
  FindItAction,
  FindItResult
> = {
  validateAction(state, action, playerId): ValidationResult {
    if (state.status !== "playing") {
      return { valid: false, code: "GAME_NOT_PLAYING" };
    }

    if (action.type !== "SELECT_CELL") {
      return { valid: false, code: "ACTION_NOT_ALLOWED" };
    }

    const cellId = action.payload?.cellId;
    if (typeof cellId !== "string") {
      return { valid: false, code: "INVALID_CELL" };
    }

    if (!state.board.includes(cellId)) {
      return { valid: false, code: "CELL_NOT_ON_BOARD" };
    }

    if (!playerId) {
      return { valid: false, code: "PLAYER_REQUIRED" };
    }

    return { valid: true };
  },

  applyAction(state, action): FindItFirstState {
    const cellId = action.payload?.cellId;
    if (!cellId) return state;

    const correct = cellId === state.targetId;
    const nextScores = { ...state.scores };

    if (correct) {
      // The server is responsible for deciding whether the submitted
      // cell is correct before this reducer is called.
      nextScores[action.clientActionId] =
        (nextScores[action.clientActionId] ?? 0) + 1;
    }

    return {
      ...state,
      scores: nextScores,
      status: correct ? "round_end" : state.status,
    };
  },

  isGameOver(state) {
    return state.status === "game_end" || state.round >= state.maxRounds;
  },

  getResult(state) {
    const entries = Object.entries(state.scores);
    entries.sort((a, b) => b[1] - a[1]);

    return {
      scores: state.scores,
      winnerId: entries[0]?.[0],
      rounds: state.round,
    };
  },
};

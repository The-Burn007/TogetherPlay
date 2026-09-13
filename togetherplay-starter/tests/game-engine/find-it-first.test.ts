import { describe, expect, it } from "vitest";
import { findItFirst } from "@/game-engine/find-it-first";
import type { FindItFirstState, GameAction } from "@/types/domain";

const state: FindItFirstState = {
  schemaVersion: 1,
  round: 1,
  maxRounds: 5,
  status: "playing",
  targetId: "c2",
  board: ["c1", "c2", "c3"],
  scores: {
    playerA: 0,
    playerB: 0
  }
};

describe("Find It First", () => {
  it("rejects a cell outside the board", () => {
    const action: GameAction<{ cellId: string }> = {
      gameId: "game1",
      clientActionId: crypto.randomUUID(),
      type: "SELECT_CELL",
      payload: { cellId: "c99" },
      clientTimestamp: Date.now()
    };

    expect(findItFirst.validateAction(state, action, "playerA").valid).toBe(false);
  });

  it("accepts a valid board selection", () => {
    const action: GameAction<{ cellId: string }> = {
      gameId: "game1",
      clientActionId: crypto.randomUUID(),
      type: "SELECT_CELL",
      payload: { cellId: "c2" },
      clientTimestamp: Date.now()
    };

    expect(findItFirst.validateAction(state, action, "playerA").valid).toBe(true);
  });
});

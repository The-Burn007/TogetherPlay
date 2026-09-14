import type { GameAction } from "@/types/domain";

export interface ValidationResult {
  valid: boolean;
  code?: string;
  message?: string;
}

export interface GameDefinition<S, A extends GameAction, R> {
  validateAction(
    state: S,
    action: A,
    playerId: string,
  ): ValidationResult;

  applyAction(state: S, action: A): S;

  isGameOver(state: S): boolean;

  getResult(state: S): R;
}

export function assertValid(
  result: ValidationResult,
): asserts result is ValidationResult & { valid: true } {
  if (!result.valid) {
    throw new Error(result.code ?? "INVALID_ACTION");
  }
}

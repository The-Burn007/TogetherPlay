/**
 * Authoritative Server Errors
 */

export type ActionErrorCode =
  | "UNAUTHENTICATED"
  | "APP_CHECK_INVALID"
  | "GAME_NOT_FOUND"
  | "PLAYER_NOT_IN_GAME"
  | "PLAYER_IMPERSONATION"
  | "GAME_NOT_ACTIVE"
  | "INVALID_ACTION"
  | "INVALID_ACTION_TYPE"
  | "INVALID_ACTION_PAYLOAD"
  | "UNAUTHORIZED_ACTION"
  | "ACTION_DISALLOWED_FOR_STATE"
  | "NOT_PLAYER_TURN"
  | "STALE_VERSION"
  | "ACTION_ID_REUSED_CROSS_GAME"
  | "ACTION_ID_REUSED_BY_OTHER_PLAYER"
  | "PERSISTENCE_ERROR"
  | "INTERNAL_ERROR";

export class ActionValidationError extends Error {
  constructor(
    public code: ActionErrorCode,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "ActionValidationError";
  }
}

export class PersistenceError extends Error {
  public readonly code = "PERSISTENCE_ERROR" as const;
  public readonly statusCode = 500;
  public readonly errorCategory = "PERSISTENCE_FAILURE" as const;
  public readonly operation: string;
  public readonly gameId?: string;
  public readonly actionId?: string;
  public readonly requestId?: string;

  constructor(
    message: string,
    options: {
      operation: string;
      gameId?: string;
      actionId?: string;
      requestId?: string;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = "PersistenceError";
    this.operation = options.operation;
    this.gameId = options.gameId;
    this.actionId = options.actionId;
    this.requestId = options.requestId;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

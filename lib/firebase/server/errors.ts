/**
 * Authoritative Server Errors
 */

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

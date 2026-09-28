/** Error codes are upper-case literals (write them SCREAMING_SNAKE); each use case declares its own closed union. */
export type ErrorCode = Uppercase<string>;

/** An expected failure, returned as a value inside a Result (never thrown). */
export type DomainError<C extends ErrorCode = ErrorCode> = {
  readonly code: C;
  readonly message: string;
};

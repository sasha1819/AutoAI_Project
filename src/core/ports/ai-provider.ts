import type { DomainError } from "../domain/domain-error.ts";
import type { Result } from "../domain/result.ts";

export type AiErrorCode =
  | "AI_AUTH_FAILED"
  | "AI_RATE_LIMITED"
  | "AI_UNAVAILABLE"
  | "AI_MODEL_NOT_FOUND"
  | "AI_BAD_REQUEST"
  | "AI_REFUSED"
  | "AI_OUTPUT_TRUNCATED";
export type AiError = DomainError<AiErrorCode>;

export type AiRequest = {
  readonly system: string;
  readonly user: string;
  /** When given, the reply must be JSON of this shape (the caller still validates it). */
  readonly jsonSchema?: Readonly<Record<string, unknown>>;
};
export type AiUsage = { readonly inputTokens: number; readonly outputTokens: number };
export type AiCompletion = {
  readonly text: string;
  readonly model: string;
  readonly usage: AiUsage;
};

/** Sends one prompt to a language model and returns its raw text. Never decides anything itself. */
export type AiProvider = {
  readonly complete: (request: AiRequest) => Promise<Result<AiCompletion, AiError>>;
};

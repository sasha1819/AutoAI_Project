import type { Requirement } from "../domain/requirement.ts";
import type { InvalidAiOutput } from "../parsing/json.ts";
import type { AiErrorCode } from "../ports/ai-provider.ts";

/** An answer that fails validation is asked for once more before its batch is reported as not scanned. */
export const INVALID_AI_OUTPUT_ATTEMPTS = 2;

/**
 * Splits requirements into the batches sent to Claude together: one per area, areas in order of first
 * appearance. The only place batching is decided, so a per-requirement mode can replace it.
 */
export function batchRequirements(
  requirements: readonly Requirement[],
): readonly (readonly Requirement[])[] {
  const byArea = new Map<string, Requirement[]>();
  for (const r of requirements) byArea.set(r.area, [...(byArea.get(r.area) ?? []), r]);
  return [...byArea.values()];
}

export type AiErrorAction = "stop_scan" | "skip_batch";

/**
 * What a scan does after an AI error. A bad key, an unknown model, rate limits or an outage would fail every
 * later batch too, so the scan stops (keeping what it already has); a problem with one prompt (including an answer
 * that stayed invalid after the retry) skips only that batch or file.
 */
export function aiErrorAction(code: AiErrorCode | InvalidAiOutput["code"]): AiErrorAction {
  switch (code) {
    case "AI_AUTH_FAILED":
    case "AI_MODEL_NOT_FOUND":
    case "AI_RATE_LIMITED":
    case "AI_UNAVAILABLE":
      return "stop_scan";
    case "AI_OUTPUT_TRUNCATED":
    case "AI_REFUSED":
    case "AI_BAD_REQUEST":
    case "INVALID_AI_OUTPUT":
      return "skip_batch";
  }
}

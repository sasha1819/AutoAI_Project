import { MAX_RUN_ATTEMPTS } from "./run-status.ts";

/**
 * The longest a whole run (first attempt plus retry) may take before AutoAI stops it. Without it, a dev server
 * or global setup that never finishes would hang the run forever. Generous on purpose: a generated spec is one
 * short test, and Playwright's own per-test timeout catches slow steps long before this.
 */
export const RUN_TIME_LIMIT_MS = 10 * 60_000;

/**
 * Each attempt gets an equal share of the run's limit, so the whole run stays within RUN_TIME_LIMIT_MS without
 * anyone measuring time between attempts. Past its limit an attempt is stopped and reported as RUN_TIMED_OUT.
 */
export function attemptTimeLimitMs(attempt: number): number {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > MAX_RUN_ATTEMPTS) {
    throw new Error(
      `runner bug: attempt ${String(attempt)} is outside 1..${String(MAX_RUN_ATTEMPTS)}`,
    );
  }
  return Math.floor(RUN_TIME_LIMIT_MS / MAX_RUN_ATTEMPTS);
}

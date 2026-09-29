import type { AttemptResult, RunStatus } from "../domain/run.ts";

/** A failed test is run once more, under the same conditions, before anyone calls it a failure. */
export const MAX_RUN_ATTEMPTS = 2;

/**
 * One attempt runs a whole spec file, which may hold several tests: the attempt fails if any of them failed.
 * No test ran means there is no result to report (the runner reports that as an error, never as a pass).
 */
export function attemptResultOfSpec(tests: readonly AttemptResult[]): AttemptResult | null {
  if (tests.length === 0) return null;
  return tests.includes("failed") ? "failed" : "passed";
}

export type RunDecision =
  { readonly kind: "retry" } | { readonly kind: "done"; readonly status: RunStatus };

/**
 * What to do after each attempt, given every attempt so far (all of them are kept, so both are logged). Pass/fail
 * comes only from Playwright; no AI is involved. A pass on retry is flaky, never passed: a flaky test must not
 * be hidden by re-running until green, and it is not sent to diagnosis as a bug.
 */
export function decideRun(attempts: readonly AttemptResult[]): RunDecision {
  const passedEarly = attempts.slice(0, -1).includes("passed");
  if (attempts.length > MAX_RUN_ATTEMPTS || passedEarly) {
    throw new Error(
      `runner bug: attempts ${JSON.stringify(attempts)} should never happen (retry only after a failure, at most ${String(MAX_RUN_ATTEMPTS)} attempts)`,
    );
  }
  const last = attempts.at(-1);
  if (last === undefined) return { kind: "done", status: "not_run" };
  if (last === "passed")
    return { kind: "done", status: attempts.length === 1 ? "passed" : "flaky" };
  if (attempts.length < MAX_RUN_ATTEMPTS) return { kind: "retry" };
  return { kind: "done", status: "failed" };
}

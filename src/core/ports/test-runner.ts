import type { DomainError } from "../domain/domain-error.ts";
import type { RunId } from "../domain/ids.ts";
import type { Result } from "../domain/result.ts";
import type { AttemptReport } from "../domain/run.ts";
import type { StepEvent } from "../domain/step.ts";

export type TestRunErrorCode =
  | "REPO_NOT_FOUND"
  | "PATH_NOT_ALLOWED"
  | "SPEC_NOT_FOUND"
  | "PLAYWRIGHT_NOT_INSTALLED"
  | "PLAYWRIGHT_CONFIG_MISSING"
  | "BROWSER_NOT_INSTALLED"
  | "TEST_SKIPPED"
  | "RUN_INTERRUPTED"
  | "RUN_TIMED_OUT"
  | "RUN_CRASHED";
export type TestRunError = DomainError<TestRunErrorCode>;

export type AttemptRequest = {
  readonly repoRoot: string;
  /** Repo-relative, and only ever a spec directly inside tests/autoai (the same confinement as TestWriter). */
  readonly specPath: string;
  readonly runId: RunId;
  /** 1 for the first run, 2 for the retry. */
  readonly attempt: number;
  /** Past this the attempt is stopped and reported as RUN_TIMED_OUT (from core/rules/run-time-limit.ts). */
  readonly timeLimitMs: number;
};

/**
 * Runs ONE attempt of a spec and reports what Playwright decided (ADR 0005). It never retries: that decision is
 * `decideRun` in core/rules/run-status.ts. Steps are streamed to `onStep` as they happen and returned in the report.
 * Anything that is not a pass or a failure (interrupted, crashed, skipped, not installed) is an error, not an attempt.
 */
export type TestRunner = {
  readonly runAttempt: (
    request: AttemptRequest,
    onStep: (event: StepEvent) => void,
  ) => Promise<Result<AttemptReport, TestRunError>>;
};

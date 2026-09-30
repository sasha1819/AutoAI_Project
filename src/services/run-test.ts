import type { RunId } from "../core/domain/ids.ts";
import { err, ok, type Result } from "../core/domain/result.ts";
import type { AttemptReport, Run } from "../core/domain/run.ts";
import type { StepEvent } from "../core/domain/step.ts";
import type { TestRunError, TestRunner } from "../core/ports/test-runner.ts";
import { decideRun } from "../core/rules/run-status.ts";
import { attemptTimeLimitMs } from "../core/rules/run-time-limit.ts";

export type RunTestInput = {
  readonly repoRoot: string;
  readonly specPath: string;
  readonly runId: RunId;
};
/** The runner could not finish an attempt; attempts that did finish are kept, and no status is guessed. */
export type RunTestError = TestRunError & { readonly attempts: readonly AttemptReport[] };
type Deps = { readonly testRunner: TestRunner };

/**
 * Runs one generated spec until the run-status rule is done: a failure is retried once under the same
 * conditions; a pass on retry is flaky. Playwright decides each attempt; nothing here judges a result.
 */
export async function runTest(
  deps: Deps,
  input: RunTestInput,
  onStep: (event: StepEvent) => void,
): Promise<Result<Run, RunTestError>> {
  const attempts: AttemptReport[] = [];
  // The rule is asked after each attempt: the first one always runs.
  for (;;) {
    const attempt = attempts.length + 1;
    const report = await deps.testRunner.runAttempt(
      { ...input, attempt, timeLimitMs: attemptTimeLimitMs(attempt) },
      onStep,
    );
    if (!report.ok) return err({ ...report.error, attempts });
    attempts.push(report.value);
    const decision = decideRun(attempts.map((a) => a.result));
    if (decision.kind === "done") return ok({ ...input, status: decision.status, attempts });
  }
}

import { readFile } from "node:fs/promises";
import { err, ok, type Result } from "../../core/domain/result.ts";
import type { AttemptReport, AttemptResult, FailureCapture } from "../../core/domain/run.ts";
import type { StepEvent } from "../../core/domain/step.ts";
import type { TestRunError, TestRunErrorCode } from "../../core/ports/test-runner.ts";
import { attemptResultOfSpec } from "../../core/rules/run-status.ts";
import { pageSnapshotOf, stripAnsi } from "./failure-text.ts";
import type { TestLine } from "./reporter-events.ts";

export type FinishedRun = {
  readonly steps: readonly StepEvent[];
  readonly tests: readonly TestLine[];
  /** Errors outside any test (config problems, "no tests found", ...). */
  readonly errors: readonly string[];
  readonly stderr: string;
  /** Set when the process was killed from outside. */
  readonly signal: string | null;
  /** Set when Playwright could not be started at all (e.g. no Node binary, no permission). */
  readonly spawnError: string | null;
};

// Playwright's message when the browser build it needs was never downloaded.
const BROWSER_MISSING =
  /Executable doesn't exist|Please run the following command to download new browsers/;

/**
 * Turns what the reporter said into an attempt, or an error (ADR 0005, BUILD-LOG outcome mapping): passed ->
 * passed; failed and timedOut -> failed; interrupted, skipped, a crash or no test at all -> an error, never an
 * attempt, so a run that didn't really happen can't be counted as a pass or a failure.
 */
export async function attemptReportOf(
  run: FinishedRun,
): Promise<Result<AttemptReport, TestRunError>> {
  if (run.spawnError !== null) {
    return fail("RUN_CRASHED", `Playwright could not be started: ${run.spawnError}`);
  }
  const messages = [...run.tests.flatMap((t) => t.errors), ...run.errors, run.stderr].map(
    stripAnsi,
  );
  if (messages.some((m) => BROWSER_MISSING.test(m))) {
    return fail(
      "BROWSER_NOT_INSTALLED",
      "Playwright's Chromium is not installed. Run in the repo: npx playwright install chromium",
    );
  }
  if (run.signal !== null || run.tests.some((t) => t.status === "interrupted")) {
    return fail("RUN_INTERRUPTED", "The test run was interrupted before it finished.");
  }
  if (run.tests.some((t) => t.status === "skipped")) {
    return fail("TEST_SKIPPED", "The spec skipped a test; generated tests must not skip.");
  }

  // Skipped and interrupted tests returned above, so every remaining test has a result.
  const result = attemptResultOfSpec(run.tests.flatMap((t) => resultOf(t.status) ?? []));
  if (result === null) {
    const detail = [...run.errors.map(stripAnsi), stripAnsi(run.stderr).trim()].filter(
      (m) => m !== "",
    );
    return fail(
      "RUN_CRASHED",
      `No test result from Playwright. ${detail.join("\n") || "No output."}`,
    );
  }

  const durationMs = run.tests.reduce((sum, t) => sum + t.durationMs, 0);
  if (result === "passed") return ok({ result, durationMs, steps: run.steps });
  const failedTest = run.tests.find((t) => resultOf(t.status) === "failed");
  if (failedTest === undefined)
    throw new Error("runner bug: a failed attempt without a failed test");
  return ok({ result, durationMs, steps: run.steps, failure: await captureOf(failedTest) });
}

function resultOf(status: TestLine["status"]): AttemptResult | null {
  switch (status) {
    case "passed":
      return "passed";
    case "failed":
    case "timedOut":
      return "failed";
    case "skipped":
    case "interrupted":
      return null;
  }
}

async function captureOf(test: TestLine): Promise<FailureCapture> {
  const error = test.errors.map(stripAnsi).join("\n\n").trim();
  const capture: FailureCapture = {
    step: test.failedStep,
    error:
      error === ""
        ? `The test ${test.status === "timedOut" ? "timed out" : "failed"} without an error message.`
        : error,
  };
  if (test.screenshotPath !== null) capture.screenshotPath = test.screenshotPath;
  const snapshot = test.errorContextPath === null ? null : await snapshotAt(test.errorContextPath);
  if (snapshot !== null) capture.pageSnapshot = snapshot;
  return capture;
}

async function snapshotAt(path: string): Promise<string | null> {
  try {
    return pageSnapshotOf(await readFile(path, "utf8"));
  } catch (e) {
    // The snapshot is optional (ADR 0005): a missing file degrades to "not captured", never to a wrong status.
    if (e instanceof Error && "code" in e && e.code === "ENOENT") return null;
    throw e;
  }
}

function fail(code: TestRunErrorCode, message: string): Result<never, TestRunError> {
  return err({ code, message });
}

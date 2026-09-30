import type { AttemptReport, Run, RunStatus } from "../core/domain/run.ts";
import type { StepEvent } from "../core/domain/step.ts";
import type { RunTestError } from "../services/run-test.ts";

// A long Playwright error (call log, diff) is cut in the terminal; --out / --json keep all of it.
const ERROR_LINES_SHOWN = 12;

const STATUS_LINE: Record<RunStatus, string> = {
  passed: "PASSED",
  failed: "FAILED: failed, including the retry under the same conditions.",
  flaky:
    "FLAKY: failed, then passed on the retry. Not reported as a bug; the test or the app is unstable.",
  not_run: "NOT RUN",
};

/** One line of the live log, printed as each step ends; a step starting prints nothing. */
export function formatStepLine(event: StepEvent): string | null {
  if (event.status === "running") return null;
  const mark = event.status === "passed" ? "ok  " : "FAIL";
  return `  ${mark} ${event.step}  (${String(event.durationMs)} ms)`;
}

export function formatAttemptStart(attempt: number): string {
  return attempt === 1 ? "Attempt 1" : `Attempt ${String(attempt)} (retry, same conditions)`;
}

/** Terminal summary of a finished run: the status the rule decided, then every attempt. */
export function formatRun(run: Run): string {
  return [
    `${run.specPath}: ${STATUS_LINE[run.status]}`,
    ...run.attempts.map(formatAttempt),
    `Run id: ${run.runId}`,
  ].join("\n\n");
}

/** A run the runner could not finish: the reason, and the attempts that did finish. */
export function formatRunError(error: RunTestError): string {
  return [`${error.code}: ${error.message}`, ...error.attempts.map(formatAttempt)].join("\n\n");
}

function formatAttempt(report: AttemptReport, index: number): string {
  const head = `Attempt ${String(index + 1)}: ${report.result} (${seconds(report.durationMs)})`;
  if (report.result === "passed") return head;
  const { failure } = report;
  const lines = failure.error.split("\n");
  const shown = lines.slice(0, ERROR_LINES_SHOWN).map((l) => `    ${l}`);
  if (lines.length > ERROR_LINES_SHOWN)
    shown.push(`    ... (${String(lines.length - ERROR_LINES_SHOWN)} more lines in --out)`);
  return [
    head,
    `  Failed step: ${failure.step ?? "(outside any step)"}`,
    "  Error:",
    ...shown,
    `  Screenshot: ${failure.screenshotPath ?? "not captured"}`,
    `  Page snapshot: ${failure.pageSnapshot === undefined ? "not captured" : `${lineCount(failure.pageSnapshot)} (in --out)`}`,
  ].join("\n");
}

function lineCount(text: string): string {
  const count = text.split("\n").length;
  return count === 1 ? "1 line" : `${String(count)} lines`;
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

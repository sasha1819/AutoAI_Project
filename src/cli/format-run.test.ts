import { describe, expect, it } from "vitest";
import { RunId } from "../core/domain/ids.ts";
import type { AttemptReport, Run } from "../core/domain/run.ts";
import type { StepEvent } from "../core/domain/step.ts";
import { formatAttemptStart, formatRun, formatRunError, formatStepLine } from "./format-run.ts";

const runId = RunId.parse("run-1");
const event = (status: StepEvent["status"]): StepEvent => ({
  runId,
  attempt: 1,
  step: "Click getByRole('button')",
  status,
  durationMs: 42,
  ts: "2026-09-29T18:00:00.000Z",
});
const failedAttempt: AttemptReport = {
  result: "failed",
  durationMs: 1234,
  steps: [],
  failure: {
    step: "Expect \"toHaveText\" locator('#t')",
    error: 'expect failed\nExpected: "Total: 5"',
    screenshotPath: "/art/run-1/attempt-1/shot.png",
    pageSnapshot: "- heading\n- paragraph",
  },
};
const oneLineSnapshot: AttemptReport = {
  ...failedAttempt,
  failure: {
    step: null,
    error: "x",
    pageSnapshot: '- paragraph: "Total: 0"',
  },
};
const passedAttempt: AttemptReport = { result: "passed", durationMs: 900, steps: [] };
const run = (over: Partial<Run>): Run => ({
  repoRoot: "/repo",
  specPath: "tests/autoai/cart.spec.ts",
  runId,
  status: "passed",
  attempts: [passedAttempt],
  ...over,
});

describe("formatStepLine", () => {
  it.each<[StepEvent["status"], string | null]>([
    ["running", null],
    ["passed", "  ok   Click getByRole('button')  (42 ms)"],
    ["failed", "  FAIL Click getByRole('button')  (42 ms)"],
  ])("%s -> %j", (status, line) => {
    expect(formatStepLine(event(status))).toBe(line);
  });
});

describe("formatAttemptStart", () => {
  it("marks the retry as a retry", () => {
    expect(formatAttemptStart(1)).toBe("Attempt 1");
    expect(formatAttemptStart(2)).toBe("Attempt 2 (retry, same conditions)");
  });
});

describe("formatRun", () => {
  it("shows a flaky run plainly, with both attempts and what was captured", () => {
    expect(formatRun(run({ status: "flaky", attempts: [failedAttempt, passedAttempt] }))).toBe(
      [
        "tests/autoai/cart.spec.ts: FLAKY: failed, then passed on the retry. Not reported as a bug; the test or the app is unstable.",
        [
          "Attempt 1: failed (1.2s)",
          "  Failed step: Expect \"toHaveText\" locator('#t')",
          "  Error:",
          "    expect failed",
          '    Expected: "Total: 5"',
          "  Screenshot: /art/run-1/attempt-1/shot.png",
          "  Page snapshot: 2 lines (in --out)",
        ].join("\n"),
        "Attempt 2: passed (0.9s)",
        "Run id: run-1",
      ].join("\n\n"),
    );
  });

  it("says when nothing was captured, and cuts a long error", () => {
    const long: AttemptReport = {
      result: "failed",
      durationMs: 0,
      steps: [],
      failure: {
        step: null,
        error: Array.from({ length: 15 }, (_, i) => `line ${String(i)}`).join("\n"),
      },
    };
    const text = formatRun(run({ status: "failed", attempts: [long, long] }));
    expect(text).toContain("FAILED: failed, including the retry");
    expect(text).toContain("  Failed step: (outside any step)");
    expect(text).toContain("    line 11\n    ... (3 more lines in --out)");
    expect(text).not.toContain("line 12");
    expect(text).toContain("  Screenshot: not captured\n  Page snapshot: not captured");
  });
});

describe("page snapshot size", () => {
  it("counts one line in the singular", () => {
    expect(formatRun(run({ status: "failed", attempts: [oneLineSnapshot] }))).toContain(
      "  Page snapshot: 1 line (in --out)",
    );
  });
});

describe("formatRunError", () => {
  it("gives the reason and keeps the attempts that finished", () => {
    expect(
      formatRunError({
        code: "RUN_TIMED_OUT",
        message: "stopped after 300s",
        attempts: [passedAttempt],
      }),
    ).toBe("RUN_TIMED_OUT: stopped after 300s\n\nAttempt 1: passed (0.9s)");
  });
});

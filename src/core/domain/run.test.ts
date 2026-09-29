import { describe, expect, it } from "vitest";
import { AttemptReport, AttemptResult, RunStatus } from "./run.ts";

describe("run vocabulary", () => {
  it("has the RunStatus values from ARCHITECTURE.md", () => {
    expect(RunStatus.options).toStrictEqual(["passed", "failed", "flaky", "not_run"]);
  });

  it("records each attempt only as Playwright reports it: passed or failed", () => {
    expect(AttemptResult.options).toStrictEqual(["passed", "failed"]);
    expect(AttemptResult.safeParse("flaky").success).toBe(false);
  });
});

describe("AttemptReport", () => {
  const failure = {
    step: "Expect toHaveText",
    error: "expected 'Total: 5' but got 'Total: 0'",
    screenshotPath: "/tmp/a/shot.png",
    pageSnapshot: '- heading "Cart"',
  };

  it("a failed attempt carries what was captured at the failure", () => {
    const report = { result: "failed", durationMs: 900, steps: [], failure };
    expect(AttemptReport.parse(report)).toStrictEqual(report);
  });

  it("a failure outside any step has no step name, and screenshot/snapshot are optional", () => {
    const report = {
      result: "failed",
      durationMs: 900,
      steps: [],
      failure: { step: null, error: "Test timeout of 1000ms exceeded." },
    };
    expect(AttemptReport.parse(report)).toStrictEqual(report);
  });

  it("a failed attempt without a capture is invalid", () => {
    expect(AttemptReport.safeParse({ result: "failed", durationMs: 1, steps: [] }).success).toBe(
      false,
    );
  });

  it("a passed attempt has no failure", () => {
    const passed = { result: "passed", durationMs: 1, steps: [] };
    expect(AttemptReport.parse(passed)).toStrictEqual(passed);
    expect(AttemptReport.safeParse({ ...passed, failure }).success).toBe(false);
  });
});

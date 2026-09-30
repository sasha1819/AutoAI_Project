import { describe, expect, it } from "vitest";
import { RunId } from "../core/domain/ids.ts";
import { err, ok, type Result } from "../core/domain/result.ts";
import type { AttemptReport } from "../core/domain/run.ts";
import type { StepEvent } from "../core/domain/step.ts";
import type { TestRunError } from "../core/ports/test-runner.ts";
import { attemptTimeLimitMs } from "../core/rules/run-time-limit.ts";
import { runTest } from "./run-test.ts";
import { scriptedTestRunner } from "./testing/scripted-test-runner.ts";

const runId = RunId.parse("run-1");
const input = { repoRoot: "/repo", specPath: "tests/autoai/cart.spec.ts", runId };
const step = (attempt: number, status: StepEvent["status"]): StepEvent => ({
  runId,
  attempt,
  step: "Click getByRole('button')",
  status,
  durationMs: 5,
  ts: "2026-09-29T18:00:00.000Z",
});
const passed = (attempt: number): Result<AttemptReport, TestRunError> =>
  ok({ result: "passed", durationMs: 100, steps: [step(attempt, "passed")] });
const failed = (attempt: number): Result<AttemptReport, TestRunError> =>
  ok({
    result: "failed",
    durationMs: 200,
    steps: [step(attempt, "failed")],
    failure: { step: "Click getByRole('button')", error: `boom ${String(attempt)}` },
  });
const broken = (code: TestRunError["code"]): Result<AttemptReport, TestRunError> =>
  err({ code, message: `${code} happened` });
const reportOf = (r: Result<AttemptReport, TestRunError>): AttemptReport => {
  if (!r.ok) throw new Error("test bug");
  return r.value;
};

describe("runTest: retry once, and the rule decides (Playwright decides each attempt)", () => {
  it.each<[string, Result<AttemptReport, TestRunError>[], string]>([
    ["a first pass", [passed(1)], "passed"],
    ["a pass on retry", [failed(1), passed(2)], "flaky"],
    ["two failures", [failed(1), failed(2)], "failed"],
  ])("%s -> %s, keeping every attempt", async (_name, script, status) => {
    const runner = scriptedTestRunner(...script);
    const result = await runTest({ testRunner: runner }, input, () => undefined);
    expect(result).toStrictEqual(ok({ ...input, status, attempts: script.map(reportOf) }));
    expect(runner.requests).toHaveLength(script.length);
  });

  it("retries under the same conditions, with each attempt's time limit from the rule", async () => {
    const runner = scriptedTestRunner(failed(1), failed(2));
    await runTest({ testRunner: runner }, input, () => undefined);
    expect(runner.requests).toStrictEqual([
      { ...input, attempt: 1, timeLimitMs: attemptTimeLimitMs(1) },
      { ...input, attempt: 2, timeLimitMs: attemptTimeLimitMs(2) },
    ]);
  });

  it("streams both attempts' steps as they happen", async () => {
    const streamed: StepEvent[] = [];
    await runTest({ testRunner: scriptedTestRunner(failed(1), passed(2)) }, input, (e) =>
      streamed.push(e),
    );
    expect(streamed).toStrictEqual([step(1, "failed"), step(2, "passed")]);
  });

  it("a runner error on the first attempt: nothing ran, no retry", async () => {
    const runner = scriptedTestRunner(broken("PLAYWRIGHT_NOT_INSTALLED"));
    const result = await runTest({ testRunner: runner }, input, () => undefined);
    expect(result).toStrictEqual(
      err({
        code: "PLAYWRIGHT_NOT_INSTALLED",
        message: "PLAYWRIGHT_NOT_INSTALLED happened",
        attempts: [],
      }),
    );
    expect(runner.requests).toHaveLength(1);
  });

  it("a runner error on the retry keeps the first attempt, and never guesses a status", async () => {
    const runner = scriptedTestRunner(failed(1), broken("RUN_TIMED_OUT"));
    const result = await runTest({ testRunner: runner }, input, () => undefined);
    expect(result).toStrictEqual(
      err({
        code: "RUN_TIMED_OUT",
        message: "RUN_TIMED_OUT happened",
        attempts: [reportOf(failed(1))],
      }),
    );
  });
});

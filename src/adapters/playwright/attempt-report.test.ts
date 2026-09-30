import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { attemptReportOf, type FinishedRun } from "./attempt-report.ts";
import type { TestLine } from "./reporter-events.ts";

const test = (over: Partial<TestLine>): TestLine => ({
  kind: "test",
  retry: 0,
  status: "passed",
  durationMs: 100,
  errors: [],
  failedStep: null,
  screenshotPath: null,
  errorContextPath: null,
  ...over,
});
const run = (over: Partial<FinishedRun>): FinishedRun => ({
  steps: [],
  tests: [],
  errors: [],
  stderr: "",
  signal: null,
  spawnError: null,
  timedOutAfterMs: null,
  skippedSetupProjects: [],
  ...over,
});

describe("attemptReportOf: Playwright's outcome -> an attempt, or an error (never a guess)", () => {
  it.each<[TestLine["status"][], "passed" | "failed"]>([
    [["passed"], "passed"],
    [["failed"], "failed"],
    [["timedOut"], "failed"],
    [["passed", "failed"], "failed"],
    [["passed", "passed"], "passed"],
  ])("tests %j -> %s", async (statuses, result) => {
    const report = await attemptReportOf(
      run({ tests: statuses.map((status) => test({ status, errors: ["boom"] })) }),
    );
    expect(report.ok && report.value.result).toBe(result);
  });

  it.each<[string, Partial<FinishedRun>, string]>([
    ["an interrupted test", { tests: [test({ status: "interrupted" })] }, "RUN_INTERRUPTED"],
    ["a killed process", { tests: [test({})], signal: "SIGTERM" }, "RUN_INTERRUPTED"],
    ["a skipped test", { tests: [test({ status: "skipped" })] }, "TEST_SKIPPED"],
    [
      "a skipped test next to a pass",
      { tests: [test({}), test({ status: "skipped" })] },
      "TEST_SKIPPED",
    ],
    ["no test at all", { errors: ["Error: No tests found"] }, "RUN_CRASHED"],
    ["a crash with only stderr", { stderr: "SyntaxError: bad config" }, "RUN_CRASHED"],
    [
      "an attempt stopped at its time limit (even though it was interrupted too)",
      { tests: [test({ status: "interrupted" })], signal: "SIGINT", timedOutAfterMs: 300_000 },
      "RUN_TIMED_OUT",
    ],
    ["Playwright that could not start", { spawnError: "spawn /x/node ENOENT" }, "RUN_CRASHED"],
    [
      "a missing browser",
      {
        tests: [
          test({
            status: "failed",
            errors: ["browserType.launch: Executable doesn't exist at /x/chrome"],
          }),
        ],
      },
      "BROWSER_NOT_INSTALLED",
    ],
  ])("%s -> %s", async (_name, over, code) => {
    const report = await attemptReportOf(run(over));
    expect(report.ok ? "ok" : report.error.code).toBe(code);
  });

  it("explains a crash with Playwright's errors and stderr", async () => {
    const report = await attemptReportOf(
      run({ errors: ["\u001b[31mError: No tests found\u001b[39m"], stderr: "more detail" }),
    );
    expect(report.ok ? "" : report.error.message).toContain("Error: No tests found\nmore detail");
  });

  it("captures the failed step, a clean error, the screenshot and the page snapshot", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autoai-report-"));
    const contextPath = join(dir, "error-context.md");
    await writeFile(contextPath, "# Page snapshot\n\n```yaml\n- paragraph: Total 0\n```\n");
    const report = await attemptReportOf(
      run({
        tests: [
          test({}),
          test({
            status: "failed",
            durationMs: 50,
            errors: ["\u001b[2mexpect\u001b[22m failed", "second"],
            failedStep: "Expect \"toHaveText\" locator('#t')",
            screenshotPath: "/art/shot.png",
            errorContextPath: contextPath,
          }),
        ],
      }),
    );
    expect(report).toStrictEqual({
      ok: true,
      value: {
        result: "failed",
        durationMs: 150,
        steps: [],
        failure: {
          step: "Expect \"toHaveText\" locator('#t')",
          error: "expect failed\n\nsecond",
          screenshotPath: "/art/shot.png",
          pageSnapshot: "- paragraph: Total 0",
        },
      },
    });
  });

  it("a failure with nothing captured still says what happened", async () => {
    const report = await attemptReportOf(
      run({ tests: [test({ status: "timedOut", errorContextPath: "/missing/error-context.md" })] }),
    );
    expect(report.ok && report.value.result === "failed" && report.value.failure).toStrictEqual({
      step: null,
      error: "The test timed out without an error message.",
    });
  });
});

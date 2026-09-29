import { describe, expect, it } from "vitest";
import { AttemptResult, RunStatus } from "./run.ts";

describe("run vocabulary", () => {
  it("has the RunStatus values from ARCHITECTURE.md", () => {
    expect(RunStatus.options).toStrictEqual(["passed", "failed", "flaky", "not_run"]);
  });

  it("records each attempt only as Playwright reports it: passed or failed", () => {
    expect(AttemptResult.options).toStrictEqual(["passed", "failed"]);
    expect(AttemptResult.safeParse("flaky").success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import type { AttemptResult } from "../domain/run.ts";
import { decideRun, MAX_RUN_ATTEMPTS, type RunDecision } from "./run-status.ts";

describe("MAX_RUN_ATTEMPTS", () => {
  it("allows the first run plus one retry", () => {
    expect(MAX_RUN_ATTEMPTS).toBe(2);
  });
});

describe("decideRun", () => {
  it.each<[readonly AttemptResult[], RunDecision]>([
    [[], { kind: "done", status: "not_run" }],
    [["passed"], { kind: "done", status: "passed" }],
    [["failed"], { kind: "retry" }],
    [["failed", "passed"], { kind: "done", status: "flaky" }],
    [["failed", "failed"], { kind: "done", status: "failed" }],
  ])("after %j -> %j", (attempts, decision) => {
    expect(decideRun(attempts)).toStrictEqual(decision);
  });

  it("never turns a failure into a pass: a pass on retry is flaky, not passed", () => {
    expect(decideRun(["failed", "passed"])).not.toStrictEqual({ kind: "done", status: "passed" });
  });

  it.each<[readonly AttemptResult[]]>([
    [["passed", "passed"]],
    [["passed", "failed"]],
    [["failed", "failed", "passed"]],
    [["failed", "passed", "failed"]],
  ])("treats %j as a runner bug (it retried when it should not have)", (attempts) => {
    expect(() => decideRun(attempts)).toThrow(/runner bug/);
  });
});

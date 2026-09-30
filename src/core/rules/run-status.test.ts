import { describe, expect, it } from "vitest";
import type { AttemptResult, RunStatus } from "../domain/run.ts";
import {
  attemptResultOfSpec,
  decideRun,
  isRunFailure,
  settledStatus,
  shouldDiagnose,
  MAX_RUN_ATTEMPTS,
  type RunDecision,
} from "./run-status.ts";

describe("attemptResultOfSpec", () => {
  it.each<[readonly AttemptResult[], AttemptResult | null]>([
    [[], null],
    [["passed"], "passed"],
    [["failed"], "failed"],
    [["passed", "passed"], "passed"],
    [["passed", "failed"], "failed"],
    [["failed", "passed"], "failed"],
  ])(
    "tests %j -> the spec attempt %j (any failed test fails it; none ran -> no result)",
    (tests, result) => {
      expect(attemptResultOfSpec(tests)).toBe(result);
    },
  );
});

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

describe("isRunFailure", () => {
  it.each<[RunStatus, boolean]>([
    ["passed", false],
    ["flaky", false],
    ["failed", true],
    ["not_run", false],
  ])(
    "%s -> %s (only a failure that survived the retry counts; flaky is shown, not failed)",
    (status, failure) => {
      expect(isRunFailure(status)).toBe(failure);
    },
  );
});

describe("shouldDiagnose", () => {
  it.each<[RunStatus, boolean]>([
    ["failed", true],
    ["flaky", false],
    ["passed", false],
    ["not_run", false],
  ])(
    "%s -> %s (only a confirmed failure is sent for diagnosis; a flaky run is not a bug)",
    (status, diagnose) => {
      expect(shouldDiagnose(status)).toBe(diagnose);
    },
  );
});

describe("settledStatus", () => {
  it.each<[readonly AttemptResult[], RunStatus | null]>([
    [["passed"], "passed"],
    [["failed", "passed"], "flaky"],
    [["failed", "failed"], "failed"],
    [[], "not_run"],
    [["failed"], null],
    [["passed", "passed"], null],
    [["failed", "failed", "failed"], null],
  ])(
    "%j -> %j (the status a finished run must have; null if it is unfinished or impossible)",
    (attempts, status) => {
      expect(settledStatus(attempts)).toBe(status);
    },
  );
});

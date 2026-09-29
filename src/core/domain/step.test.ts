import { describe, expect, it } from "vitest";
import { StepEvent, StepStatus } from "./step.ts";

const valid = {
  runId: "run-1",
  attempt: 1,
  step: "Click getByRole('button', { name: 'Add to cart' })",
  status: "passed",
  durationMs: 42,
  ts: "2026-09-29T17:00:00.000Z",
};

describe("StepEvent", () => {
  it("has a status for a step in progress and for each finished outcome", () => {
    expect(StepStatus.options).toStrictEqual(["running", "passed", "failed"]);
  });

  it("accepts a typed step event (reliability-rules §6, plus the attempt)", () => {
    expect(StepEvent.parse(valid)).toStrictEqual(valid);
  });

  it.each([
    ["an empty step name", { step: "" }],
    ["attempt 0", { attempt: 0 }],
    ["a fractional attempt", { attempt: 1.5 }],
    ["a negative duration", { durationMs: -1 }],
    ["a non-ISO time", { ts: "yesterday" }],
    ["a flaky step (only a run can be flaky)", { status: "flaky" }],
    ["a run id with spaces", { runId: "run 1" }],
  ])("rejects %s", (_name, change) => {
    expect(StepEvent.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});

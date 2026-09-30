import { describe, expect, it } from "vitest";
import { MAX_RUN_ATTEMPTS } from "./run-status.ts";
import { attemptTimeLimitMs, RUN_TIME_LIMIT_MS } from "./run-time-limit.ts";

describe("RUN_TIME_LIMIT_MS", () => {
  it("is 10 minutes for a whole run, retry included", () => {
    expect(RUN_TIME_LIMIT_MS).toBe(600_000);
  });
});

describe("attemptTimeLimitMs", () => {
  it.each<[number, number]>([
    [1, 300_000],
    [2, 300_000],
  ])("attempt %i may take at most %i ms (an equal share of the run)", (attempt, limit) => {
    expect(attemptTimeLimitMs(attempt)).toBe(limit);
  });

  it("the attempts together never exceed the run's limit", () => {
    let total = 0;
    for (let attempt = 1; attempt <= MAX_RUN_ATTEMPTS; attempt++)
      total += attemptTimeLimitMs(attempt);
    expect(total).toBeLessThanOrEqual(RUN_TIME_LIMIT_MS);
  });

  it.each([[0], [-1], [1.5], [MAX_RUN_ATTEMPTS + 1]])(
    "treats attempt %d as a runner bug",
    (attempt) => {
      expect(() => attemptTimeLimitMs(attempt)).toThrow(/runner bug/);
    },
  );
});

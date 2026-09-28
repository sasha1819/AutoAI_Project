import { describe, expect, it } from "vitest";
import { approximateCostUsd } from "./pricing.ts";

describe("approximateCostUsd", () => {
  it.each([
    ["claude-sonnet-5", 1_000_000, 100_000, 2 + 1],
    ["claude-opus-5", 10_000, 2_000, 0.05 + 0.05],
    ["claude-haiku-4-5", 0, 1_000_000, 5],
  ])("%s: %d in + %d out -> $%d", (model, inputTokens, outputTokens, usd) => {
    expect(approximateCostUsd(model, { inputTokens, outputTokens })).toBeCloseTo(usd, 10);
  });

  it("returns null for a model it has no price for, instead of guessing", () => {
    expect(approximateCostUsd("claude-future-9", { inputTokens: 1, outputTokens: 1 })).toBeNull();
  });
});

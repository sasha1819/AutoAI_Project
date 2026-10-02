import { describe, expect, it } from "vitest";
import { formatDuration, formatElapsed } from "./time.ts";

describe("formatDuration", () => {
  it.each([
    [0, "0.0s"],
    [800, "0.8s"],
    [1234, "1.2s"],
    [10_000, "10.0s"],
    [59_949, "59.9s"],
    [60_000, "1m 00s"],
    [65_400, "1m 05s"],
  ])("%d ms -> %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("refuses %s", (ms) => {
    expect(() => formatDuration(ms)).toThrow(/not a duration/);
  });
});

describe("formatElapsed", () => {
  it.each([
    [0, "00:00.0"],
    [1200, "00:01.2"],
    [6549, "00:06.5"],
    [724_000, "12:04.0"],
  ])("%d ms -> %s", (ms, text) => {
    expect(formatElapsed(ms)).toBe(text);
  });
  it("refuses a negative time", () => {
    expect(() => formatElapsed(-5)).toThrow(/not an elapsed time/);
  });
});

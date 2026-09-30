import { describe, expect, it } from "vitest";
import {
  clipFailureText,
  FAILURE_TEXT_LIMIT_CHARS,
  fitFilesToBudget,
  PROMPT_FILE_BUDGET_CHARS,
} from "./prompt-budget.ts";

const file = (path: string, size: number) => ({ path, text: "x".repeat(size) });

describe("fitFilesToBudget", () => {
  it("has a 60k-character budget for the file text of one prompt", () => {
    expect(PROMPT_FILE_BUDGET_CHARS).toBe(60_000);
  });

  it("keeps whole files in rank order while they fit", () => {
    const result = fitFilesToBudget([file("a", 40), file("b", 50), file("c", 10)], 100);
    expect(result.included.map((f) => f.path)).toStrictEqual(["a", "b", "c"]);
    expect(result.omitted).toStrictEqual([]);
  });

  it("omits (never cuts) a file that does not fit, and still takes smaller later ones", () => {
    const result = fitFilesToBudget([file("a", 60), file("big", 50), file("c", 30)], 100);
    expect(result.included.map((f) => f.path)).toStrictEqual(["a", "c"]);
    expect(result.omitted).toStrictEqual(["big"]);
    expect(result.included.every((f) => f.text.length === (f.path === "a" ? 60 : 30))).toBe(true);
  });

  it("omits a top file that alone is over budget", () => {
    const result = fitFilesToBudget([file("huge", 101), file("b", 10)], 100);
    expect(result).toStrictEqual({ included: [file("b", 10)], omitted: ["huge"] });
  });

  it("counts a file of exactly the remaining budget as fitting", () => {
    expect(fitFilesToBudget([file("a", 100)], 100).omitted).toStrictEqual([]);
  });

  it("uses PROMPT_FILE_BUDGET_CHARS by default", () => {
    const result = fitFilesToBudget([file("a", PROMPT_FILE_BUDGET_CHARS), file("b", 1)]);
    expect(result.omitted).toStrictEqual(["b"]);
  });
});

describe("clipFailureText", () => {
  it("is 20k characters per failure text (error, page snapshot)", () => {
    expect(FAILURE_TEXT_LIMIT_CHARS).toBe(20_000);
  });

  it.each<[string, number, string]>([
    ["short", 10, "short"],
    ["exactly10!", 10, "exactly10!"],
    ["line one\nline two\nline three", 12, "line one\n[... 2 more lines cut]"],
    ["abcdefghijklmnop", 10, "abcdefghij\n[... 6 more characters cut]"],
  ])("%j with limit %i -> %j (cut at a line when possible, and say so)", (text, limit, clipped) => {
    expect(clipFailureText(text, limit)).toBe(clipped);
  });
});

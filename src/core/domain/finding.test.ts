import { describe, expect, expectTypeOf, it } from "vitest";
import { Confidence, Evidence, FindingType, ReviewStatus } from "./finding.ts";

describe("Confidence", () => {
  it.each([0, 0.5, 0.7, 1])("accepts %d", (raw) => {
    expect(Confidence.parse(raw)).toBe(raw);
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY, "0.8", null, undefined])(
    "rejects %j",
    (raw) => {
      expect(Confidence.safeParse(raw).success).toBe(false);
    },
  );

  it("cannot be a plain number without parsing (compile time)", () => {
    // @ts-expect-error a raw number from the AI must be validated first
    const c: Confidence = 0.9;
    expectTypeOf(Confidence.parse(0.9)).toExtend<number>();
    expect(c).toBe(0.9);
  });
});

describe("Evidence", () => {
  const valid = { file: "src/cart/discounts.js", lines: [3, 7], snippet: "codes.get(code)" };

  it.each([
    ["a range", valid],
    ["a single line", { ...valid, lines: [5, 5] }],
  ])("accepts %s", (_name, raw) => {
    expect(Evidence.parse(raw)).toStrictEqual(raw);
  });

  it.each([
    ["an empty file", { ...valid, file: "" }],
    ["an empty snippet", { ...valid, snippet: "" }],
    ["a whitespace snippet", { ...valid, snippet: "  " }],
    ["line 0", { ...valid, lines: [0, 3] }],
    ["an end before the start", { ...valid, lines: [7, 3] }],
    ["fractional lines", { ...valid, lines: [1.5, 3] }],
    ["one line number", { ...valid, lines: [3] }],
    ["missing lines", { file: "a.js", snippet: "x" }],
  ])("rejects %s", (_name, raw) => {
    expect(Evidence.safeParse(raw).success).toBe(false);
  });
});

describe("FindingType and ReviewStatus", () => {
  it("use the lowercase vocabulary from ARCHITECTURE.md", () => {
    expect(FindingType.options).toStrictEqual(["match", "mismatch", "not_implemented"]);
    expect(ReviewStatus.options).toStrictEqual(["confirmed", "needs_review"]);
  });
});

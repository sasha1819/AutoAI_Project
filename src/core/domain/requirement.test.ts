import { describe, expect, it } from "vitest";
import { Requirement } from "./requirement.ts";

const valid = {
  tag: "Cart 2.4",
  area: "Cart",
  text: "Discount codes are case-insensitive.",
  source: { file: "prds/cart.md", line: 12 },
};

describe("Requirement schema", () => {
  it("accepts a complete requirement", () => {
    expect(Requirement.parse(valid)).toStrictEqual(valid);
  });

  it.each([
    ["empty tag", { ...valid, tag: "" }],
    ["empty area", { ...valid, area: "" }],
    ["empty text", { ...valid, text: "" }],
    ["empty source file", { ...valid, source: { file: "", line: 1 } }],
    ["line 0", { ...valid, source: { file: "a.md", line: 0 } }],
    ["fractional line", { ...valid, source: { file: "a.md", line: 1.5 } }],
    ["missing source", { tag: "Cart 2.4", area: "Cart", text: "x" }],
  ])("rejects %s", (_name, raw) => {
    expect(Requirement.safeParse(raw).success).toBe(false);
  });
});

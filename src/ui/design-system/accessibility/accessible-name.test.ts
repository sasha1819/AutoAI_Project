import { describe, expect, it } from "vitest";
import { assertAccessibleName, isBlank } from "./accessible-name.ts";

describe("assertAccessibleName", () => {
  it("accepts a real name", () => {
    expect(() => {
      assertAccessibleName("Close", "Thing");
    }).not.toThrow();
  });

  it.each([
    ["missing", undefined],
    ["not text", 42],
    ["empty", ""],
    ["spaces", "   "],
    ["a zero-width space", "\u200B"],
    ["a byte-order mark and a word joiner", "\uFEFF\u2060"],
    ["a soft hyphen and a vowel separator", "\u00AD\u180E"],
  ])("refuses a name that is %s", (_name, value) => {
    expect(() => {
      assertAccessibleName(value, "Thing");
    }).toThrow("Thing needs a non-empty label");
  });
});

describe("isBlank", () => {
  it.each([
    ["", true],
    ["  ", true],
    ["\u200B", true],
    ["Close", false],
    [" a ", false],
  ])("%j -> %s", (text, blank) => {
    expect(isBlank(text)).toBe(blank);
  });
});

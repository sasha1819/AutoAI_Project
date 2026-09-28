import { describe, expect, it } from "vitest";
import type { Evidence } from "../domain/finding.ts";
import {
  EVIDENCE_LINE_TOLERANCE,
  MAX_EVIDENCE_SPAN_LINES,
  MIN_SNIPPET_CHARS,
  verifyEvidence,
} from "./evidence.ts";

const discounts = [
  'const codes = new Map([["SAVE10", 0.1]]);',
  "",
  "export function findDiscount(input) {",
  "  const code = input.trim();",
  "  const rate = codes.get(code);",
  "  return rate === undefined ? null : { code, rate };",
  "}",
  "",
  "export function discountAmount(amount, discount) {",
  "  if (!discount) return 0;",
  "  return Math.round(amount * discount.rate * 100) / 100;",
  "}",
].join("\n");
const files = new Map([["src/cart/discounts.js", discounts]]);
const ev = (
  lines: [number, number],
  snippet: string,
  file = "src/cart/discounts.js",
): Evidence => ({
  file,
  lines,
  snippet,
});

describe("verifyEvidence", () => {
  it("allows lines off by 2, needs 8 non-space snippet characters, and at most 30 cited lines", () => {
    expect([EVIDENCE_LINE_TOLERANCE, MIN_SNIPPET_CHARS, MAX_EVIDENCE_SPAN_LINES]).toStrictEqual([
      2, 8, 30,
    ]);
  });

  it.each<[string, Evidence, boolean]>([
    ["exact line", ev([5, 5], "const rate = codes.get(code);"), true],
    ["part of a line", ev([5, 5], "codes.get(code)"), true],
    ["inside a range", ev([3, 7], "codes.get(code)"), true],
    [
      "a snippet spanning lines",
      ev([4, 5], "const code = input.trim();\n  const rate = codes.get(code);"),
      true,
    ],
    [
      "different whitespace",
      ev([4, 5], "const code = input.trim();   const rate =\tcodes.get(code);"),
      true,
    ],
    [
      "line numbers copied from the prompt",
      ev([5, 5], "   5 | const rate = codes.get(code);"),
      true,
    ],
    ["lines off by 2", ev([7, 7], "codes.get(code)"), true],
    ["lines off by 3", ev([8, 8], "codes.get(code)"), false],
    ["a snippet that is elsewhere in the file", ev([10, 11], "codes.get(code)"), false],
    ["a snippet not in the file", ev([5, 5], "codes.get(code.toUpperCase())"), false],
    ["lines past the end of the file", ev([40, 42], "codes.get(code)"), false],
    ["a file Claude was not shown", ev([5, 5], "codes.get(code)", "src/other.js"), false],
    ["a snippet of only line numbers", ev([5, 5], " 5 | "), false],
    ["a snippet of 8 non-space characters", ev([5, 5], "get(code"), true],
    ["a snippet too short to prove anything", ev([5, 5], "(code);"), false],
    ["a lone brace", ev([7, 7], "}"), false],
    ["a range of exactly 30 lines", ev([1, 30], "codes.get(code)"), true],
    ["a range wider than 30 lines", ev([1, 31], "codes.get(code)"), false],
  ])("%s -> %s", (_name, evidence, expected) => {
    expect(verifyEvidence(evidence, files)).toBe(expected);
  });

  it("handles Windows line endings", () => {
    const crlf = new Map([["a.js", "const a = 1;\r\nconst total = sum(a);\r\nexport { total };"]]);
    expect(
      verifyEvidence({ file: "a.js", lines: [2, 2], snippet: "const total = sum(a);" }, crlf),
    ).toBe(true);
  });
});

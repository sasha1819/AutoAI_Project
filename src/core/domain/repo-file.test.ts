import { describe, expect, it } from "vitest";
import { numberLine, splitLines, stripLineNumbers } from "./repo-file.ts";

describe("code line helpers", () => {
  it("split on LF and CRLF alike", () => {
    expect(splitLines("a\r\nb\nc")).toStrictEqual(["a", "b", "c"]);
  });

  it.each([
    [1, "const a = 1;", "   1 | const a = 1;"],
    [42, "", "  42 | "],
    [12345, "x", "12345 | x"],
  ])("number line %d", (no, line, shown) => {
    expect(numberLine(no, line)).toBe(shown);
  });

  it("strip every number prefix a model copied back, and nothing else", () => {
    const shown = [
      numberLine(4, "  const code = input.trim();"),
      numberLine(5, "  return 1 | 2;"),
    ].join("\n");
    expect(stripLineNumbers(shown)).toBe("  const code = input.trim();\n  return 1 | 2;");
    expect(stripLineNumbers("a | b")).toBe("a | b");
  });
});

import { describe, expect, it } from "vitest";
import type { Requirement } from "../core/domain/requirement.ts";
import type { GenerateTestsResult } from "../services/generate-tests.ts";
import { formatGenerate } from "./format-generate.ts";

const req = (tag: string): Requirement => ({
  tag,
  area: "Cart",
  text: "t",
  source: { file: "shop.md", line: 1 },
});
const base: GenerateTestsResult = {
  tests: [],
  skippedFindings: 0,
  notices: [],
  warnings: [],
  stoppedBy: null,
  models: ["claude-sonnet-5"],
  usage: { aiCalls: 5, inputTokens: 12000, outputTokens: 3000 },
};

describe("formatGenerate", () => {
  it("lists written, existing, needs-review and not-generated tests, then notices and AI usage", () => {
    const result: GenerateTestsResult = {
      ...base,
      skippedFindings: 2,
      tests: [
        {
          requirement: req("Cart 1.1"),
          fileName: "a.spec.ts",
          status: "written",
          path: "tests/autoai/a.spec.ts",
          title: "Quantity goes up",
        },
        {
          requirement: req("Cart 1.2"),
          fileName: "b.spec.ts",
          status: "exists",
          path: "tests/autoai/b.spec.ts",
        },
        {
          requirement: req("Cart 1.3"),
          fileName: "c.spec.ts",
          status: "needs_review",
          code: "x",
          problems: ["5:9 still broken", "No expect( assertion", "third"],
        },
        {
          requirement: req("Cart 1.4"),
          fileName: "d.spec.ts",
          status: "not_generated",
          problems: ["AI_REFUSED: declined"],
        },
      ],
      notices: ["Add @playwright/test."],
    };
    expect(formatGenerate(result, 0.071)).toBe(
      [
        "Generated tests for 4 of 6 findings (claude-sonnet-5)",
        "",
        "Written (1)\n  tests/autoai/a.spec.ts  Cart 1.1  Quantity goes up",
        "",
        "Already exists, left untouched (1)\n  tests/autoai/b.spec.ts  Cart 1.2  delete it to regenerate",
        "",
        "Needs review, not written (1)\n  tests/autoai/c.spec.ts  Cart 1.3  5:9 still broken  (+2 more problems)",
        "",
        "Not generated (1)\n  tests/autoai/d.spec.ts  Cart 1.4  AI_REFUSED: declined",
        "",
        "Notices\n  Add @playwright/test.",
        "",
        "AI: 5 calls, 12,000 input + 3,000 output tokens, about $0.07",
      ].join("\n"),
    );
  });

  it("explains that only confirmed matches and mismatches get tests when none qualify", () => {
    const result: GenerateTestsResult = {
      ...base,
      skippedFindings: 3,
      models: [],
      usage: { aiCalls: 0, inputTokens: 0, outputTokens: 0 },
    };
    expect(formatGenerate(result, null)).toBe(
      [
        "Generated tests for 0 of 3 findings",
        "",
        "Only confirmed matches and mismatches get a test; the others were skipped.",
        "",
        "AI: 0 calls",
      ].join("\n"),
    );
  });

  it("shows warnings and an early stop", () => {
    const result: GenerateTestsResult = {
      ...base,
      warnings: [{ code: "SOURCE_FILE_UNREADABLE", message: "src/x.js: denied" }],
      stoppedBy: { code: "AI_AUTH_FAILED", message: "The Anthropic API rejected the API key." },
    };
    const out = formatGenerate(result, null);
    expect(out).toContain("Warnings\n  SOURCE_FILE_UNREADABLE: src/x.js: denied");
    expect(out).toContain(
      "Stopped early: AI_AUTH_FAILED - The Anthropic API rejected the API key. Check ANTHROPIC_API_KEY.",
    );
  });
});

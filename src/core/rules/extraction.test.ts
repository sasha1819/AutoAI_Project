import { describe, expect, it } from "vitest";
import {
  claudeReadsPrd,
  judgeExtracted,
  MAX_EXTRACTION_CHARS,
  plannedExtractionCalls,
} from "./extraction.ts";

describe("judgeExtracted (ADR 0008: three outcomes)", () => {
  it.each([
    [{ quoteVerified: false, confidence: 0.95 }, "dropped"],
    [{ quoteVerified: false, confidence: 0.2 }, "dropped"],
    [{ quoteVerified: true, confidence: 0.7 }, "compare"],
    [{ quoteVerified: true, confidence: 0.99 }, "compare"],
    [{ quoteVerified: true, confidence: 0.69 }, "needs_review"],
    [{ quoteVerified: true, confidence: 0 }, "needs_review"],
  ] as const)("%o -> %s", (item, expected) => {
    expect(judgeExtracted(item)).toBe(expected);
  });
});

describe("plannedExtractionCalls", () => {
  it("is one call per file Claude will read (a retry, only if an answer is invalid, is extra)", () => {
    expect(plannedExtractionCalls(["will_read", "not_needed", "too_large", "will_read"])).toBe(2);
    expect(plannedExtractionCalls([])).toBe(0);
  });
});

describe("claudeReadsPrd", () => {
  it.each([
    [{ parsedRequirements: 3, chars: 500 }, "not_needed"],
    [{ parsedRequirements: 3, chars: MAX_EXTRACTION_CHARS * 2 }, "not_needed"],
    [{ parsedRequirements: 0, chars: 500 }, "will_read"],
    [{ parsedRequirements: 0, chars: MAX_EXTRACTION_CHARS }, "will_read"],
    [{ parsedRequirements: 0, chars: MAX_EXTRACTION_CHARS + 1 }, "too_large"],
    [{ parsedRequirements: 0, chars: 0 }, "not_needed"],
  ] as const)("%o -> %s", (file, expected) => {
    expect(claudeReadsPrd(file)).toBe(expected);
  });
});

import { describe, expect, it } from "vitest";
import { Confidence } from "../core/domain/finding.ts";
import { RunId } from "../core/domain/ids.ts";
import type { DiagnoseFailureResult } from "../services/diagnose-failure.ts";
import { formatDiagnosis } from "./format-diagnosis.ts";

const result = (
  over: Partial<DiagnoseFailureResult["diagnosis"]> = {},
  redactions = 0,
): DiagnoseFailureResult => ({
  runId: RunId.parse("run-1"),
  specPath: "tests/autoai/cart.spec.ts",
  diagnosis: {
    explanation: "findDiscount rejects lower-case codes.",
    likelyCause: "app_bug",
    suggestedFix: "Upper-case the code:\nconst key = code.toUpperCase();",
    confidence: Confidence.parse(0.92),
    reviewStatus: "confirmed",
    notes: [],
    ...over,
  },
  redactions,
  model: "claude-sonnet-5",
  usage: { aiCalls: 1, inputTokens: 3000, outputTokens: 200 },
});

describe("formatDiagnosis", () => {
  it("shows the cause, the explanation, the fix and the cost", () => {
    expect(formatDiagnosis(result(), 0.012)).toBe(
      [
        "tests/autoai/cart.spec.ts: diagnosis of a confirmed failure (run run-1)",
        "Likely cause: App bug: the app does not do what the test checks (confidence 0.92)",
        "findDiscount rejects lower-case codes.",
        "Suggested fix:\n  Upper-case the code:\n  const key = code.toUpperCase();",
        "AI: 1 calls, 3,000 input + 200 output tokens, about $0.01",
      ].join("\n\n"),
    );
  });

  it("labels a low-confidence diagnosis as a possible cause, with notes and the privacy count", () => {
    const text = formatDiagnosis(
      result(
        {
          reviewStatus: "needs_review",
          confidence: Confidence.parse(0.5),
          suggestedFix: null,
          notes: ["N1"],
        },
        3,
      ),
      null,
    );
    expect(text).toContain("Possible cause, not confirmed: App bug");
    expect(text).not.toContain("Suggested fix");
    expect(text).toContain("Note: N1");
    expect(text).toContain("Privacy: 3 values were hidden before anything was sent to the AI.");
  });
});

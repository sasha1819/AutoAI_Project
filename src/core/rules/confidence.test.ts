import { describe, expect, it } from "vitest";
import {
  Confidence,
  type Evidence,
  type FindingType,
  type ReviewReason,
  type ReviewStatus,
} from "../domain/finding.ts";
import { CONFIDENCE_THRESHOLD, isConfident, reviewFinding } from "./confidence.ts";

const evidence: Evidence = {
  file: "src/cart/discounts.js",
  lines: [3, 7],
  snippet: "codes.get(code)",
};
const c = (n: number) => Confidence.parse(n);

describe("isConfident", () => {
  it("uses 0.7 as the bar", () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.7);
  });

  it.each([
    [0, false],
    [0.5, false],
    [0.6999, false],
    [0.7, true],
    [0.1 * 7, true],
    [0.95, true],
    [1, true],
  ])("%d -> %s", (n, expected) => {
    expect(isConfident(c(n))).toBe(expected);
  });
});

describe("reviewFinding", () => {
  it.each<[FindingType, number, Evidence | null, boolean, ReviewStatus, readonly ReviewReason[]]>([
    ["mismatch", 0.9, evidence, true, "confirmed", []],
    ["mismatch", 0.7, evidence, true, "confirmed", []],
    ["mismatch", 0.69, evidence, true, "needs_review", ["LOW_CONFIDENCE"]],
    ["mismatch", 0.9, null, false, "needs_review", ["MISSING_EVIDENCE"]],
    ["mismatch", 0.3, null, false, "needs_review", ["LOW_CONFIDENCE", "MISSING_EVIDENCE"]],
    ["mismatch", 1, null, false, "needs_review", ["MISSING_EVIDENCE"]],
    ["mismatch", 0.9, evidence, false, "needs_review", ["UNVERIFIED_EVIDENCE"]],
    ["mismatch", 0.5, evidence, false, "needs_review", ["LOW_CONFIDENCE", "UNVERIFIED_EVIDENCE"]],
    ["match", 0.9, null, false, "confirmed", []],
    ["match", 0.9, evidence, true, "confirmed", []],
    ["match", 0.9, evidence, false, "needs_review", ["UNVERIFIED_EVIDENCE"]],
    ["match", 0.5, evidence, true, "needs_review", ["LOW_CONFIDENCE"]],
    ["not_implemented", 0.8, null, false, "confirmed", []],
    ["not_implemented", 0, null, false, "needs_review", ["LOW_CONFIDENCE"]],
  ])(
    "%s at %d, evidence=%j verified=%s -> %s %j",
    (type, confidence, ev, evidenceVerified, reviewStatus, reasons) => {
      expect(
        reviewFinding({ type, confidence: c(confidence), evidence: ev, evidenceVerified }),
      ).toStrictEqual({ reviewStatus, reasons });
    },
  );
});

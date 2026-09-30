import { describe, expect, it } from "vitest";
import type { LikelyCause } from "../domain/diagnosis.ts";
import { Confidence, type FindingType } from "../domain/finding.ts";
import { NOT_IMPLEMENTED_NOTE, reviewDiagnosis, setupProjectNote } from "./diagnosis.ts";

const answer = (confidence: number, likelyCause: LikelyCause = "app_bug") => ({
  explanation: "The code field rejects lower-case codes.",
  likelyCause,
  suggestedFix: null,
  confidence: Confidence.parse(confidence),
});
const noFacts = { skippedSetupProjects: [], findingType: null };

describe("reviewDiagnosis", () => {
  it.each<[number, string]>([
    [0.9, "confirmed"],
    [0.7, "confirmed"],
    [0.69, "needs_review"],
    [0, "needs_review"],
  ])(
    "confidence %d -> %s (below 0.7 it is shown as a possible cause, never as fact)",
    (confidence, status) => {
      expect(reviewDiagnosis(answer(confidence), noFacts).reviewStatus).toBe(status);
    },
  );

  it("keeps the answer and adds no notes when AutoAI knows nothing extra", () => {
    expect(reviewDiagnosis(answer(0.9), noFacts)).toStrictEqual({
      ...answer(0.9),
      reviewStatus: "confirmed",
      notes: [],
    });
  });

  it("always names setup projects the runner skipped, whatever the AI said", () => {
    const reviewed = reviewDiagnosis(answer(0.95), {
      skippedSetupProjects: ["setup", "login"],
      findingType: null,
    });
    expect(reviewed.notes).toStrictEqual([setupProjectNote(["setup", "login"])]);
    expect(reviewed.notes[0]).toBe(
      'This test may depend on Playwright setup projects that AutoAI does not run yet ("setup", "login"), for example a login step. If it needs them, the failure may come from that, not from the app or the test.',
    );
  });

  it.each<[LikelyCause, string]>([
    ["app_bug", "needs_review"],
    ["test_bug", "needs_review"],
    ["unclear", "needs_review"],
    ["environment", "confirmed"],
  ])(
    "with skipped setup projects, a confident %s is %s (a known environment gap is never hidden behind a confirmed verdict)",
    (cause, status) => {
      const reviewed = reviewDiagnosis(answer(0.95, cause), {
        skippedSetupProjects: ["login"],
        findingType: null,
      });
      expect(reviewed.reviewStatus).toBe(status);
    },
  );

  it.each<[FindingType | null, number]>([
    ["not_implemented", 1],
    ["mismatch", 0],
    ["match", 0],
    [null, 0],
  ])(
    "a %s scan finding adds %i not-implemented note (a fact from the scan, not the AI)",
    (findingType, notes) => {
      const reviewed = reviewDiagnosis(answer(0.8), { skippedSetupProjects: [], findingType });
      expect(reviewed.notes).toHaveLength(notes);
    },
  );

  it("puts the not-implemented note first when both apply", () => {
    const reviewed = reviewDiagnosis(answer(0.8), {
      skippedSetupProjects: ["login"],
      findingType: "not_implemented",
    });
    expect(reviewed.notes).toStrictEqual([NOT_IMPLEMENTED_NOTE, setupProjectNote(["login"])]);
    expect(NOT_IMPLEMENTED_NOTE).toBe(
      "The scan found this feature is not implemented, so this test cannot pass until it is built. That is missing work, not a bug in existing code.",
    );
  });
});

import type { Diagnosis, DiagnosisAnswer } from "../domain/diagnosis.ts";
import type { FindingType } from "../domain/finding.ts";
import { isConfident } from "./confidence.ts";

/**
 * The note added when the scan found the tested feature missing. The scan separates a missing feature from a wrong
 * one (not_implemented vs mismatch); the diagnosis keeps that distinction as a fact instead of leaving it to the AI.
 */
export const NOT_IMPLEMENTED_NOTE =
  "The scan found this feature is not implemented, so this test cannot pass until it is built. That is missing work, not a bug in existing code.";

/** The note added when the user's config has setup projects (e.g. a login step) the runner did not run. */
export function setupProjectNote(projects: readonly string[]): string {
  const names = projects.map((p) => `"${p}"`).join(", ");
  return `This test may depend on Playwright setup projects that AutoAI does not run yet (${names}), for example a login step. If it needs them, the failure may come from that, not from the app or the test.`;
}

/**
 * Turns Claude's answer into a diagnosis. It is confirmed only when confident AND nothing AutoAI knows contradicts
 * it: with setup projects skipped, any cause other than "environment" stays a possible cause, because the skipped
 * setup alone may explain the failure. Facts AutoAI knows for certain are added as notes, whatever the AI said.
 */
export function reviewDiagnosis(
  answer: DiagnosisAnswer,
  facts: {
    readonly skippedSetupProjects: readonly string[];
    /** The saved scan's verdict on the requirement this test checks, when known. */
    readonly findingType: FindingType | null;
  },
): Diagnosis {
  const setupSkipped = facts.skippedSetupProjects.length > 0;
  const confirmed =
    isConfident(answer.confidence) && (!setupSkipped || answer.likelyCause === "environment");
  return {
    ...answer,
    reviewStatus: confirmed ? "confirmed" : "needs_review",
    notes: [
      ...(facts.findingType === "not_implemented" ? [NOT_IMPLEMENTED_NOTE] : []),
      ...(setupSkipped ? [setupProjectNote(facts.skippedSetupProjects)] : []),
    ],
  };
}

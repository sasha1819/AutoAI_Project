import type { Confidence, Evidence, FindingType, ReviewStatus } from "../domain/finding.ts";

/** Below this, an AI judgement is never shown as fact. Also used for diagnoses ("possible cause"). */
export const CONFIDENCE_THRESHOLD = 0.7;

export type ReviewReason = "LOW_CONFIDENCE" | "MISSING_EVIDENCE";
export type ReviewDecision = {
  readonly reviewStatus: ReviewStatus;
  readonly reasons: readonly ReviewReason[];
};

/** True when an AI confidence is high enough to be presented as a finding rather than a suggestion. */
export function isConfident(confidence: Confidence): boolean {
  return confidence >= CONFIDENCE_THRESHOLD;
}

/** Decides whether a finding is confirmed or needs review; a mismatch must also cite code evidence. */
export function reviewFinding(finding: {
  readonly type: FindingType;
  readonly confidence: Confidence;
  readonly evidence: Evidence | null;
}): ReviewDecision {
  const reasons: ReviewReason[] = [];
  if (!isConfident(finding.confidence)) reasons.push("LOW_CONFIDENCE");
  // Only a mismatch claims the code is wrong, so only it must point at the code; a match or a missing feature
  // may still cite files in its explanation, but nothing is asserted against the user's code.
  if (finding.type === "mismatch" && finding.evidence === null) reasons.push("MISSING_EVIDENCE");
  return { reviewStatus: reasons.length === 0 ? "confirmed" : "needs_review", reasons };
}

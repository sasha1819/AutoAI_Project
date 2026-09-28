import type {
  Confidence,
  Evidence,
  FindingType,
  ReviewReason,
  ReviewStatus,
} from "../domain/finding.ts";

/** Below this, an AI judgement is never shown as fact. Also used for diagnoses ("possible cause"). */
export const CONFIDENCE_THRESHOLD = 0.7;

export type ReviewDecision = {
  readonly reviewStatus: ReviewStatus;
  readonly reasons: readonly ReviewReason[];
};

/** True when an AI confidence is high enough to be presented as a finding rather than a suggestion. */
export function isConfident(confidence: Confidence): boolean {
  return confidence >= CONFIDENCE_THRESHOLD;
}

/** Decides confirmed vs needs_review. The only place that sets a finding's review status. */
export function reviewFinding(finding: {
  readonly type: FindingType;
  readonly confidence: Confidence;
  readonly evidence: Evidence | null;
  /** Result of verifyEvidence; ignored when there is no evidence. */
  readonly evidenceVerified: boolean;
}): ReviewDecision {
  const reasons: ReviewReason[] = [];
  if (!isConfident(finding.confidence)) reasons.push("LOW_CONFIDENCE");
  // Only a mismatch claims the code is wrong, so only it must point at the code; a match or a missing feature
  // may still cite files in its explanation, but nothing is asserted against the user's code.
  if (finding.type === "mismatch" && finding.evidence === null) reasons.push("MISSING_EVIDENCE");
  // Evidence that is given must be real, whatever the type: an invented citation discredits the whole answer.
  if (finding.evidence !== null && !finding.evidenceVerified) reasons.push("UNVERIFIED_EVIDENCE");
  return { reviewStatus: reasons.length === 0 ? "confirmed" : "needs_review", reasons };
}

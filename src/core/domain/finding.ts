import { z } from "zod";
import { Confidence } from "./confidence.ts";
import { LineRange } from "./line-range.ts";
import { Requirement } from "./requirement.ts";

export const FindingType = z.enum(["match", "mismatch", "not_implemented"]);
export type FindingType = z.infer<typeof FindingType>;

export const Severity = z.enum(["high", "medium", "low"]);
export type Severity = z.infer<typeof Severity>;

export const ReviewStatus = z.enum(["confirmed", "needs_review"]);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

export const ReviewReason = z.enum(["LOW_CONFIDENCE", "MISSING_EVIDENCE", "UNVERIFIED_EVIDENCE"]);
export type ReviewReason = z.infer<typeof ReviewReason>;

export { Confidence } from "./confidence.ts";
export const Evidence = z
  .object({
    file: z.string().min(1),
    lines: LineRange,
    snippet: z.string().refine((s) => s.trim() !== "", "snippet must not be blank"),
  })
  .readonly();
export type Evidence = z.infer<typeof Evidence>;

export const Finding = z
  .object({
    requirement: Requirement,
    type: FindingType,
    severity: Severity.nullable(),
    explanation: z.string().min(1),
    evidence: Evidence.nullable(),
    confidence: Confidence,
    reviewStatus: ReviewStatus,
    reviewReasons: z.array(ReviewReason).readonly(),
  })
  .readonly();
export type Finding = z.infer<typeof Finding>;

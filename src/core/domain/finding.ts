import { z } from "zod";
import { Requirement } from "./requirement.ts";

export const FindingType = z.enum(["match", "mismatch", "not_implemented"]);
export type FindingType = z.infer<typeof FindingType>;

export const Severity = z.enum(["high", "medium", "low"]);
export type Severity = z.infer<typeof Severity>;

export const ReviewStatus = z.enum(["confirmed", "needs_review"]);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

export const ReviewReason = z.enum(["LOW_CONFIDENCE", "MISSING_EVIDENCE", "UNVERIFIED_EVIDENCE"]);
export type ReviewReason = z.infer<typeof ReviewReason>;

// Branded so an AI-supplied number has to pass through this schema before any rule can use it.
export const Confidence = z.number().min(0).max(1).brand<"Confidence">();
export type Confidence = z.infer<typeof Confidence>;

const lineNumber = z.number().int().positive();
export const Evidence = z
  .object({
    file: z.string().min(1),
    lines: z
      .tuple([lineNumber, lineNumber])
      .readonly()
      .refine(([start, end]) => start <= end, "lines must be [start, end] with start <= end"),
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

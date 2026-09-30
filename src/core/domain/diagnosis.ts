import { z } from "zod";
import { Confidence, ReviewStatus } from "./finding.ts";

/** Where the fault most likely is. An app bug means the app does not do what the test (and spec) expect. */
export const LikelyCause = z.enum(["app_bug", "test_bug", "environment", "unclear"]);
export type LikelyCause = z.infer<typeof LikelyCause>;

/**
 * An AI explanation of a confirmed failure (reliability-rules §5). It never changes the run's status: Playwright
 * decided that. Below the confidence bar it is shown as a "possible cause" (reviewStatus needs_review). `notes` are
 * facts AutoAI adds itself, never AI text.
 */
export const Diagnosis = z.object({
  explanation: z.string().min(1),
  likelyCause: LikelyCause,
  suggestedFix: z.string().min(1).nullable(),
  confidence: Confidence,
  reviewStatus: ReviewStatus,
  notes: z.array(z.string().min(1)).readonly(),
});
export type Diagnosis = z.infer<typeof Diagnosis>;

/** What the AI answers: a diagnosis before AutoAI reviews it (review status and notes are AutoAI's). */
export type DiagnosisAnswer = Pick<
  Diagnosis,
  "explanation" | "likelyCause" | "suggestedFix" | "confidence"
>;

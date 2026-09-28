import { z } from "zod";

export const FindingType = z.enum(["match", "mismatch", "not_implemented"]);
export type FindingType = z.infer<typeof FindingType>;

export const ReviewStatus = z.enum(["confirmed", "needs_review"]);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

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

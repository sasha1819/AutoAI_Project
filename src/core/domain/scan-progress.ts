import { z } from "zod";

/**
 * How far a scan has got, as the scan service reports it (PRD Flow: progress events streamed to the UI). Stages
 * come in this order; "matching" repeats once per requirement batch (one area at a time).
 */
export const ScanProgress = z.discriminatedUnion("stage", [
  z.strictObject({ stage: z.literal("reading_prds") }),
  z.strictObject({
    stage: z.literal("prds_read"),
    prdFiles: z.number().int().nonnegative(),
    requirements: z.number().int().nonnegative(),
  }),
  // Only when a PRD file had no requirements the parser could read (ADR 0008): Claude reads it, one file at a time.
  z.strictObject({
    stage: z.literal("extracting"),
    file: z.string().min(1),
    index: z.number().int().positive(),
    total: z.number().int().positive(),
  }),
  z.strictObject({
    stage: z.literal("extracted"),
    requirements: z.number().int().nonnegative(),
    needsReview: z.number().int().nonnegative(),
  }),
  z.strictObject({ stage: z.literal("reading_code") }),
  z.strictObject({ stage: z.literal("code_read"), sourceFiles: z.number().int().nonnegative() }),
  z.strictObject({
    stage: z.literal("matching"),
    area: z.string().min(1),
    batch: z.number().int().positive(),
    batches: z.number().int().positive(),
  }),
  z.strictObject({ stage: z.literal("done") }),
]);
export type ScanProgress = z.infer<typeof ScanProgress>;

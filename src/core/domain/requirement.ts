import { z } from "zod";
import { Confidence } from "./confidence.ts";
import { LineRange } from "./line-range.ts";

const Source = z.object({ file: z.string().min(1), line: z.number().int().positive() }).readonly();

/** The PRD text Claude quoted for a requirement it found (ADR 0008): verified verbatim against the file. */
export const Quote = z
  .object({
    lines: LineRange,
    snippet: z.string().min(1),
  })
  .readonly();
export type Quote = z.infer<typeof Quote>;

export const Requirement = z
  .object({
    // "Cart 2.4" for a tagged item; the heading title for a heading section; "<area> (AI) <n>" for one Claude
    // found. Not unique across or within files.
    tag: z.string().min(1),
    area: z.string().min(1),
    text: z.string().min(1),
    source: Source,
    /** Only on a requirement Claude found in a plain-prose PRD (ADR 0008); parsed requirements have none. */
    extraction: z
      .object({ confidence: z.number().min(0).max(1), quote: Quote })
      .readonly()
      .optional(),
  })
  .readonly();
export type Requirement = z.infer<typeof Requirement>;

/**
 * Something Claude found in a plain-prose PRD with a verified quote but low confidence (ADR 0008): shown as "found,
 * not compared, needs your review". It is not a Requirement, so the matcher can never receive it.
 */
export const RequirementCandidate = z
  .object({
    area: z.string().min(1),
    text: z.string().min(1),
    source: Source,
    quote: Quote,
    confidence: Confidence,
  })
  .readonly();
export type RequirementCandidate = z.infer<typeof RequirementCandidate>;

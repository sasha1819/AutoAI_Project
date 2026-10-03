import { CONFIDENCE_THRESHOLD } from "./confidence.ts";

/**
 * The most text one PRD file may have to be sent to Claude for extraction (ADR 0008): about 12k tokens, room for a
 * long PRD (AutoAI's own is about 15k characters). A larger file is not sent, split or cut; the user is told.
 */
export const MAX_EXTRACTION_CHARS = 50_000;

import type { ClaudeReads } from "../domain/claude-reads.ts";

/**
 * Claude reads a PRD file only when the parser found no requirements in it (always, no switch: user decision) and it
 * fits the cap. An empty file has nothing to read.
 */
export function claudeReadsPrd(file: {
  readonly parsedRequirements: number;
  readonly chars: number;
}): ClaudeReads {
  if (file.parsedRequirements > 0 || file.chars === 0) return "not_needed";
  return file.chars > MAX_EXTRACTION_CHARS ? "too_large" : "will_read";
}

/** The extra Claude calls a scan plans for reading PRDs: one per file Claude reads (said before Scan). */
export function plannedExtractionCalls(files: readonly ClaudeReads[]): number {
  return files.filter((f) => f === "will_read").length;
}

/** What becomes of one item Claude extracted (ADR 0008, user decision). */
export type ExtractionVerdict = "dropped" | "compare" | "needs_review";

/**
 * An unverified quote is dropped completely; a verified one at the review threshold or above becomes a requirement
 * and is compared with the code; a verified one below it is shown for review and never compared.
 */
export function judgeExtracted(item: {
  readonly quoteVerified: boolean;
  readonly confidence: number;
}): ExtractionVerdict {
  if (!item.quoteVerified) return "dropped";
  return item.confidence >= CONFIDENCE_THRESHOLD ? "compare" : "needs_review";
}

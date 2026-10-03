import { ok, type Result } from "../core/domain/result.ts";
import type { RepoReader } from "../core/ports/repo-reader.ts";
import type { ClaudeReads } from "../core/domain/claude-reads.ts";
import {
  claudeReadsPrd,
  MAX_EXTRACTION_CHARS,
  plannedExtractionCalls,
} from "../core/rules/extraction.ts";
import { type ExtractRequirementsError, extractRequirements } from "./extract-requirements.ts";

export type PrdSummary = {
  /**
   * Every PRD file found, in order: how many requirements the parser found (0 for plain prose), its size, and whether
   * Claude will read it during the scan (ADR 0008), so the screen can say the extra calls before Scan.
   */
  readonly files: readonly {
    readonly file: string;
    readonly requirements: number;
    readonly chars: number;
    readonly claude: ClaudeReads;
  }[];
  readonly requirements: number;
  readonly maxChars: number;
  /** Extra Claude calls the scan plans for reading these PRDs (core/rules/extraction). */
  readonly extraCalls: number;
};

/**
 * What a PRD folder holds, before any scan: reads and parses the PRDs only (no AI, no cost), so Add project can say
 * "0 requirements", "no PRD files" or how many files Claude will read before the user starts a paid scan.
 */
export async function summarizePrds(
  deps: { readonly repoReader: RepoReader },
  input: { readonly prdFolder: string },
): Promise<Result<PrdSummary, ExtractRequirementsError>> {
  const extracted = await extractRequirements(deps, input);
  if (!extracted.ok) return extracted;
  const { files, requirements } = extracted.value;
  const judged = files.map((f) => ({
    ...f,
    claude: claudeReadsPrd({ parsedRequirements: f.requirements, chars: f.chars }),
  }));
  return ok({
    files: judged,
    requirements: requirements.length,
    maxChars: MAX_EXTRACTION_CHARS,
    extraCalls: plannedExtractionCalls(judged.map((f) => f.claude)),
  });
}

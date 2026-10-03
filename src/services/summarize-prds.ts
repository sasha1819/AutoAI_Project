import { ok, type Result } from "../core/domain/result.ts";
import type { RepoReader } from "../core/ports/repo-reader.ts";
import { type ExtractRequirementsError, extractRequirements } from "./extract-requirements.ts";

export type PrdSummary = {
  /** Every PRD file found, in order, with how many requirements it holds (0 for plain prose). */
  readonly files: readonly { readonly file: string; readonly requirements: number }[];
  readonly requirements: number;
};

/**
 * What a PRD folder holds, before any scan: reads and parses the PRDs only (no AI, no cost), so Add project can say
 * "0 requirements" or "no PRD files" before the user starts a paid scan.
 */
export async function summarizePrds(
  deps: { readonly repoReader: RepoReader },
  input: { readonly prdFolder: string },
): Promise<Result<PrdSummary, ExtractRequirementsError>> {
  const extracted = await extractRequirements(deps, input);
  if (!extracted.ok) return extracted;
  const { prdFiles, requirements } = extracted.value;
  return ok({
    files: prdFiles.map((file) => ({
      file,
      requirements: requirements.filter((r) => r.source.file === file).length,
    })),
    requirements: requirements.length,
  });
}

import type { DomainError } from "../core/domain/domain-error.ts";
import type { Requirement } from "../core/domain/requirement.ts";
import { err, ok, type Result } from "../core/domain/result.ts";
import { parsePrd } from "../core/parsing/prd.ts";
import type { RepoReadErrorCode, RepoReader } from "../core/ports/repo-reader.ts";
import { isPrdFile, PRD_EXTENSIONS } from "../core/rules/prd-file.ts";

// NO_PRD_FILES means "this project has no spec", not a broken scan: per the PRD onboarding edge case,
// a scan continues without mismatches and still generates tests from code alone.
export type ExtractRequirementsError = DomainError<RepoReadErrorCode | "NO_PRD_FILES">;
export type ExtractedRequirements = {
  readonly prdFiles: readonly string[];
  readonly requirements: readonly Requirement[];
  /** Per PRD file, in order: its size in characters and how many requirements the parser found in it. */
  readonly files: readonly {
    readonly file: string;
    readonly chars: number;
    readonly requirements: number;
  }[];
};

/** Reads every PRD file in a folder and returns its requirements, in file then line order. */
export async function extractRequirements(
  deps: { readonly repoReader: RepoReader },
  input: { readonly prdFolder: string },
): Promise<Result<ExtractedRequirements, ExtractRequirementsError>> {
  const listed = await deps.repoReader.listFiles(input.prdFolder);
  if (!listed.ok) return listed;

  const prdFiles = listed.value.filter(isPrdFile);
  if (prdFiles.length === 0) {
    return err({
      code: "NO_PRD_FILES",
      message: `No PRD files (${PRD_EXTENSIONS.map((e) => `.${e}`).join(", ")}) in ${input.prdFolder}`,
    });
  }

  const requirements: Requirement[] = [];
  const files: ExtractedRequirements["files"][number][] = [];
  for (const file of prdFiles) {
    const read = await deps.repoReader.readText(input.prdFolder, file);
    if (!read.ok) return read;
    const found = parsePrd({ file, text: read.value });
    requirements.push(...found);
    files.push({ file, chars: read.value.length, requirements: found.length });
  }
  return ok({ prdFiles, requirements, files });
}

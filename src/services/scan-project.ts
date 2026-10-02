import type { DomainError } from "../core/domain/domain-error.ts";
import type { Finding } from "../core/domain/finding.ts";
import type { Requirement } from "../core/domain/requirement.ts";
import type { ScanProgress } from "../core/domain/scan-progress.ts";
import { err, ok, type Result } from "../core/domain/result.ts";
import { parseMatchingResponse } from "../core/parsing/finding.ts";
import type { AiError, AiProvider, AiUsage } from "../core/ports/ai-provider.ts";
import type { RepoReadErrorCode, RepoReader } from "../core/ports/repo-reader.ts";
import { buildMatchingPrompt } from "../core/prompts/matching.ts";
import { aiErrorAction, batchRequirements } from "../core/rules/batching.ts";
import { fitFilesToBudget } from "../core/rules/prompt-budget.ts";
import { indexFiles, rankFilesForBatch } from "../core/rules/relevance.ts";
import { askUntilValid, newAiTally, usageOf } from "./ask-ai.ts";
import { extractRequirements } from "./extract-requirements.ts";
import { loadSourceFiles, type SourceFileWarning } from "./source-files.ts";

export type ScanWarning =
  | SourceFileWarning
  | { readonly code: "NO_PRD_FILES" | "BATCH_NOT_SCANNED"; readonly message: string };
export type ScanResult = {
  readonly prdFiles: readonly string[];
  /** Source files found in the repo (unreadable ones are also listed in warnings). */
  readonly sourceFiles: number;
  readonly requirements: readonly Requirement[];
  readonly findings: readonly Finding[];
  /** Requirements no valid answer was obtained for (invalid answers, or the scan stopped first). */
  readonly notScanned: readonly Requirement[];
  readonly warnings: readonly ScanWarning[];
  /** The AI error that stopped the scan early; findings before it are kept. */
  readonly stoppedBy: AiError | null;
  readonly models: readonly string[];
  readonly usage: { readonly aiCalls: number } & AiUsage;
};
export type ScanProjectError = DomainError<RepoReadErrorCode>;
type Deps = { readonly repoReader: RepoReader; readonly aiProvider: AiProvider };

/** Reads the PRDs and the repo, asks Claude to classify each requirement area, and returns reviewed findings. */
export async function scanProject(
  deps: Deps,
  input: {
    readonly repoRoot: string;
    /** null when the project has no PRDs: the scan then finds nothing to compare (PRD Flow 1 edge case). */
    readonly prdFolder: string | null;
    /** Told how far the scan has got (the app streams it to the screen; the CLI leaves it out). */
    readonly onProgress?: (progress: ScanProgress) => void;
  },
): Promise<Result<ScanResult, ScanProjectError>> {
  const progress = input.onProgress ?? (() => undefined);
  const warnings: ScanWarning[] = [];
  progress({ stage: "reading_prds" });
  const extracted =
    input.prdFolder === null
      ? err({ code: "NO_PRD_FILES" as const, message: "No PRD folder was chosen." })
      : await extractRequirements(deps, { prdFolder: input.prdFolder });
  if (!extracted.ok && extracted.error.code !== "NO_PRD_FILES") {
    return err({ code: extracted.error.code, message: extracted.error.message });
  }
  // No PRD files is not a failed scan: the project simply has no spec to compare against (PRD onboarding).
  if (!extracted.ok) warnings.push({ code: "NO_PRD_FILES", message: extracted.error.message });
  const { prdFiles, requirements } = extracted.ok
    ? extracted.value
    : { prdFiles: [], requirements: [] };
  progress({ stage: "prds_read", prdFiles: prdFiles.length, requirements: requirements.length });

  progress({ stage: "reading_code" });
  const loaded = await loadSourceFiles(deps.repoReader, input.repoRoot, {
    readContents: requirements.length > 0,
  });
  if (!loaded.ok) return loaded;
  const { sourcePaths, files } = loaded.value;
  warnings.push(...loaded.value.warnings);
  progress({ stage: "code_read", sourceFiles: sourcePaths.length });

  const index = indexFiles(files);
  const byPath = new Map(files.map((f) => [f.path, f]));
  const findings: Finding[] = [];
  const notScanned: Requirement[] = [];
  const tally = newAiTally();
  let stoppedBy: AiError | null = null;

  const batches = batchRequirements(requirements);
  for (const [i, batch] of batches.entries()) {
    if (stoppedBy) {
      notScanned.push(...batch);
      continue;
    }
    progress({
      stage: "matching",
      area: areaOf(batch),
      batch: i + 1,
      batches: batches.length,
    });
    const ranked = rankFilesForBatch(batch, index).flatMap((p) => byPath.get(p) ?? []);
    const fitted = fitFilesToBudget(ranked);
    const prompt = buildMatchingPrompt({
      requirements: batch,
      files: fitted.included,
      omittedFiles: fitted.omitted,
      repoFiles: sourcePaths,
    });
    const answer = await askUntilValid(
      deps.aiProvider,
      { system: prompt.system, user: prompt.user, jsonSchema: prompt.answerSchema },
      (text) => parseMatchingResponse(text, prompt),
      tally,
    );
    if (answer.ok) {
      findings.push(...answer.value.value);
      continue;
    }
    notScanned.push(...batch);
    const { error } = answer;
    if (error.code !== "INVALID_AI_OUTPUT" && aiErrorAction(error.code) === "stop_scan") {
      stoppedBy = error;
      continue;
    }
    const problem =
      error.code === "INVALID_AI_OUTPUT" ? error.message : `${error.code}: ${error.message}`;
    warnings.push({ code: "BATCH_NOT_SCANNED", message: `${areaOf(batch)}: ${problem}` });
  }

  progress({ stage: "done" });
  return ok({
    prdFiles,
    sourceFiles: sourcePaths.length,
    requirements,
    findings,
    notScanned,
    warnings,
    stoppedBy,
    models: [...tally.models],
    usage: usageOf(tally),
  });
}

/** A batch's area, as the progress events and the warnings both name it. */
function areaOf(batch: readonly Requirement[]): string {
  return batch[0]?.area ?? "?";
}

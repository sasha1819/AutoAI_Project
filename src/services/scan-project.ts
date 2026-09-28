import type { DomainError } from "../core/domain/domain-error.ts";
import type { Finding } from "../core/domain/finding.ts";
import type { RepoFile } from "../core/domain/repo-file.ts";
import type { Requirement } from "../core/domain/requirement.ts";
import { err, ok, type Result } from "../core/domain/result.ts";
import { parseMatchingResponse } from "../core/parsing/finding.ts";
import type { AiError, AiProvider, AiUsage } from "../core/ports/ai-provider.ts";
import type { RepoReadErrorCode, RepoReader } from "../core/ports/repo-reader.ts";
import { buildMatchingPrompt } from "../core/prompts/matching.ts";
import {
  aiErrorAction,
  batchRequirements,
  INVALID_AI_OUTPUT_ATTEMPTS,
} from "../core/rules/batching.ts";
import { fitFilesToBudget } from "../core/rules/prompt-budget.ts";
import { indexFiles, rankFilesForBatch } from "../core/rules/relevance.ts";
import { isSourceFile } from "../core/rules/source-file.ts";
import { extractRequirements } from "./extract-requirements.ts";

export type ScanWarning = {
  readonly code: "NO_PRD_FILES" | "SOURCE_FILE_UNREADABLE" | "BATCH_NOT_SCANNED";
  readonly message: string;
};
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
  input: { readonly repoRoot: string; readonly prdFolder: string },
): Promise<Result<ScanResult, ScanProjectError>> {
  const warnings: ScanWarning[] = [];
  const extracted = await extractRequirements(deps, { prdFolder: input.prdFolder });
  if (!extracted.ok && extracted.error.code !== "NO_PRD_FILES") {
    return err({ code: extracted.error.code, message: extracted.error.message });
  }
  // No PRD files is not a failed scan: the project simply has no spec to compare against (PRD onboarding).
  if (!extracted.ok) warnings.push({ code: "NO_PRD_FILES", message: extracted.error.message });
  const { prdFiles, requirements } = extracted.ok
    ? extracted.value
    : { prdFiles: [], requirements: [] };

  const listed = await deps.repoReader.listFiles(input.repoRoot);
  if (!listed.ok) return listed;
  const sourcePaths = listed.value.filter(isSourceFile);
  const files =
    requirements.length === 0
      ? []
      : await readAll(deps.repoReader, input.repoRoot, sourcePaths, warnings);

  const index = indexFiles(files);
  const byPath = new Map(files.map((f) => [f.path, f]));
  const findings: Finding[] = [];
  const notScanned: Requirement[] = [];
  const models = new Set<string>();
  const usage = { aiCalls: 0, inputTokens: 0, outputTokens: 0 };
  let stoppedBy: AiError | null = null;

  for (const batch of batchRequirements(requirements)) {
    if (stoppedBy) {
      notScanned.push(...batch);
      continue;
    }
    const ranked = rankFilesForBatch(batch, index).flatMap((p) => byPath.get(p) ?? []);
    const fitted = fitFilesToBudget(ranked);
    const prompt = buildMatchingPrompt({
      requirements: batch,
      files: fitted.included,
      omittedFiles: fitted.omitted,
      repoFiles: sourcePaths,
    });
    let lastProblem = "";
    let scanned = false;
    for (let attempt = 1; attempt <= INVALID_AI_OUTPUT_ATTEMPTS; attempt++) {
      const reply = await deps.aiProvider.complete({
        system: prompt.system,
        user: prompt.user,
        jsonSchema: prompt.answerSchema,
      });
      if (!reply.ok) {
        if (aiErrorAction(reply.error.code) === "stop_scan") stoppedBy = reply.error;
        else lastProblem = `${reply.error.code}: ${reply.error.message}`;
        break;
      }
      usage.aiCalls += 1;
      usage.inputTokens += reply.value.usage.inputTokens;
      usage.outputTokens += reply.value.usage.outputTokens;
      models.add(reply.value.model);
      const parsed = parseMatchingResponse(reply.value.text, prompt);
      if (parsed.ok) {
        findings.push(...parsed.value);
        scanned = true;
        break;
      }
      lastProblem = parsed.error.message;
    }
    if (!scanned) {
      notScanned.push(...batch);
      if (!stoppedBy) {
        warnings.push({
          code: "BATCH_NOT_SCANNED",
          message: `${batch[0]?.area ?? "?"}: ${lastProblem}`,
        });
      }
    }
  }

  return ok({
    prdFiles,
    sourceFiles: sourcePaths.length,
    requirements,
    findings,
    notScanned,
    warnings,
    stoppedBy,
    models: [...models],
    usage,
  });
}

async function readAll(
  reader: RepoReader,
  root: string,
  paths: readonly string[],
  warnings: ScanWarning[],
): Promise<RepoFile[]> {
  const files: RepoFile[] = [];
  for (const path of paths) {
    const read = await reader.readText(root, path);
    if (read.ok) files.push({ path, text: read.value });
    else
      warnings.push({ code: "SOURCE_FILE_UNREADABLE", message: `${path}: ${read.error.message}` });
  }
  return files;
}

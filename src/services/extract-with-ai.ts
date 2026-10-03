import type { Requirement, RequirementCandidate } from "../core/domain/requirement.ts";
import type { ScanProgress } from "../core/domain/scan-progress.ts";
import { parseExtractionResponse } from "../core/parsing/extraction.ts";
import type { AiError, AiProvider } from "../core/ports/ai-provider.ts";
import type { RepoReader } from "../core/ports/repo-reader.ts";
import { buildExtractionPrompt } from "../core/prompts/extraction.ts";
import { aiErrorAction } from "../core/rules/batching.ts";
import { type AiTally, aiProblem, askUntilValid } from "./ask-ai.ts";

export type ExtractionWarning = { readonly code: "EXTRACTION_FAILED"; readonly message: string };

export type ExtractedWithAi = {
  /** Verified and confident: compared with the code like parsed requirements. */
  readonly requirements: readonly Requirement[];
  /** Verified but below the review threshold: shown for review, never compared (ADR 0008). */
  readonly needsReview: readonly RequirementCandidate[];
  /** Items whose quote was not in the PRD: discarded, only counted. */
  readonly dropped: number;
  /** Files Claude gave a usable answer for (fewer than asked when a file failed or the step stopped). */
  readonly filesRead: number;
  readonly warnings: readonly ExtractionWarning[];
  /** The AI error that stopped it (it would fail every later call too); what was found before it is kept. */
  readonly stoppedBy: AiError | null;
};

/**
 * Asks Claude for the requirements in each plain-prose PRD file (ADR 0008), one file per call, with the shared
 * invalid-output retry. The caller chooses the files (core/rules/extraction: parsed to 0 and within the size cap).
 */
export async function extractWithAi(
  deps: { readonly repoReader: RepoReader; readonly aiProvider: AiProvider },
  input: {
    readonly prdFolder: string;
    readonly files: readonly string[];
    readonly tally: AiTally;
    readonly onProgress: (progress: ScanProgress) => void;
  },
): Promise<ExtractedWithAi> {
  const requirements: Requirement[] = [];
  const needsReview: RequirementCandidate[] = [];
  const warnings: ExtractionWarning[] = [];
  let dropped = 0;
  let filesRead = 0;
  // Claude's tags are numbered per area across all files, so two files never both give "Checkout (AI) 1".
  const numbered = new Map<string, number>();
  for (const [i, file] of input.files.entries()) {
    input.onProgress({ stage: "extracting", file, index: i + 1, total: input.files.length });
    const read = await deps.repoReader.readText(input.prdFolder, file);
    if (!read.ok) {
      warnings.push({ code: "EXTRACTION_FAILED", message: `${file}: ${read.error.message}` });
      continue;
    }
    const prompt = buildExtractionPrompt({ path: file, text: read.value });
    const answer = await askUntilValid(
      deps.aiProvider,
      { system: prompt.system, user: prompt.user, jsonSchema: prompt.answerSchema },
      (text) => parseExtractionResponse(text, prompt, numbered),
      input.tally,
    );
    if (answer.ok) {
      filesRead += 1;
      for (const r of answer.value.value.requirements)
        numbered.set(r.area, (numbered.get(r.area) ?? 0) + 1);
      requirements.push(...answer.value.value.requirements);
      needsReview.push(...answer.value.value.needsReview);
      dropped += answer.value.value.dropped;
      continue;
    }
    const { error } = answer;
    if (aiErrorAction(error.code) === "stop_scan" && error.code !== "INVALID_AI_OUTPUT") {
      return { requirements, needsReview, dropped, filesRead, warnings, stoppedBy: error };
    }
    warnings.push({ code: "EXTRACTION_FAILED", message: `${file}: ${aiProblem(error)}` });
  }
  return { requirements, needsReview, dropped, filesRead, warnings, stoppedBy: null };
}
